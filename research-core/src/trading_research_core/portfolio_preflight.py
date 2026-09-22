"""Milestone 5 batch preflight; it never writes a combined portfolio artifact."""

from __future__ import annotations

from decimal import Decimal
from hashlib import sha256
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from .errors import CoreError
from .identities import stable_uuid
from .intake import intake_mt5_excel
from .dataset_store import read_dataset
from .time_risk import realised_balance_daily_drawdown


CALCULATION_VERSION = "m5-sequential-batch-preflight-2"


def preflight_mt5_excel_batch(workspace_root: Any, source_paths: list[str]) -> dict[str, object]:
    """Intake/reuse explicit sources and report eligibility without a batch write."""

    if len(source_paths) < 2:
        raise CoreError("E_REQUEST_INVALID", "M5 batch preflight requires at least two selected MT5 Excel reports.")
    intakes = [intake_mt5_excel(workspace_root, path) for path in source_paths]
    return _evaluate([_member(workspace_root, intake) for intake in intakes])


def preflight_datasets(workspace_root: Any, dataset_refs: list[str]) -> dict[str, object]:
    """Apply the same sequential checks to already-imported canonical datasets."""

    if len(dataset_refs) < 2:
        raise CoreError("E_REQUEST_INVALID", "Sequential preflight requires at least two datasets.")
    members = []
    for dataset_ref in dataset_refs:
        dataset = read_dataset(workspace_root, dataset_ref)
        metadata = dataset["metadata"]
        source = metadata.get("source", {}) if isinstance(metadata, dict) else {}
        settings = metadata.get("settings", {}) if isinstance(metadata, dict) else {}
        members.append(_member_from_dataset(dataset_ref, str(metadata.get("dataset_id", "")), str(source.get("sha256", "")), str(source.get("filename", "")), settings.get("Currency"), dataset))
    return _evaluate(members)


def _evaluate(members: list[dict[str, Any]]) -> dict[str, object]:
    findings: list[dict[str, object]] = []
    hashes = [member["source_sha256"] for member in members]
    if len(set(hashes)) != len(hashes):
        findings.append(_finding("BLOCKED", "DUPLICATE_SOURCE", "The same source SHA-256 was selected more than once."))
    currencies = {member["currency"] for member in members}
    if len(currencies) != 1:
        findings.append(_finding("BLOCKED", "CURRENCY_MISMATCH", "Selected reports do not share one source-reported currency."))
    ordered = sorted(members, key=lambda member: (member["first_timestamp"], member["source_sha256"]))
    if len({member["first_timestamp"] for member in ordered}) != len(ordered):
        findings.append(_finding("BLOCKED", "ORDER_AMBIGUOUS", "Two reports begin at the same source-reported timestamp; v1 does not infer an order."))
    seen_event_keys: dict[tuple[str, str], dict[str, Any]] = {}
    seen_deals: dict[str, dict[str, Any]] = {}
    duplicate_pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    reused_pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for member in ordered:
        duplicate_with = {id(seen_event_keys[key]): seen_event_keys[key] for key in member["source_event_keys"] if key in seen_event_keys}
        duplicate_pairs.extend((other, member) for other in duplicate_with.values())
        reused_with = {id(seen_deals[deal]): seen_deals[deal] for deal in member["source_deal_ids"] if deal in seen_deals}
        reused_pairs.extend((other, member) for other in reused_with.values() if id(other) not in duplicate_with)
        for key in member["source_event_keys"]:
            seen_event_keys.setdefault(key, member)
        for deal in member["source_deal_ids"]:
            seen_deals.setdefault(deal, member)
    for first, second in duplicate_pairs:
        findings.append(_finding("BLOCKED", "POTENTIAL_DUPLICATE_EVENTS", f"{_label(first)} and {_label(second)} contain matching source timestamp and deal identifier pairs; no deduplication was attempted.", [first, second]))
    if reused_pairs:
        involved = _unique([member for pair in reused_pairs for member in pair])
        findings.append(_finding("WARNING", "DEAL_ID_REUSED", f"Deal identifiers recur across {len(involved)} reports. MT5 Strategy Tester numbers deals per test run, so this alone is not treated as duplicate evidence.", involved))
    for index, earlier in enumerate(ordered):
        for later in ordered[index + 1:]:
            if later["first_timestamp"] <= earlier["last_timestamp"]:
                findings.append(_finding("BLOCKED", "COVERAGE_OVERLAP", f"{_label(earlier)} ({earlier['first_timestamp']} → {earlier['last_timestamp']}) overlaps {_label(later)} ({later['first_timestamp']} → {later['last_timestamp']}). Sequential batches cannot combine overlapping periods.", [earlier, later]))
    for previous, current in zip(ordered, ordered[1:]):
        if current["first_timestamp"] > previous["last_timestamp"] and Decimal(previous["final_reported_balance"]) != Decimal(current["opening_balance"]):
            findings.append(_finding("BLOCKED", "BALANCE_DISCONTINUITY", f"{_label(previous)} ends at balance {previous['final_reported_balance']} but {_label(current)} opens at {current['opening_balance']}; no funding adjustment was inferred.", [previous, current]))
    findings.append(_finding("WARNING", "GAP_UNDETERMINED", "Regular Deals exports establish event spans, not complete no-trade coverage; no continuous daily result is available across report boundaries in this preflight."))
    blocked = any(finding["severity"] == "BLOCKED" for finding in findings)
    identity = stable_uuid("m5-batch-preflight", *(member["dataset_ref"] for member in ordered), CALCULATION_VERSION)
    return {
        "preflight_id": identity,
        "calculation_version": CALCULATION_VERSION,
        "account_declaration": "USER_SUPPLIED_SINGLE_ACCOUNT",
        "status": "BLOCKED" if blocked else "ELIGIBLE",
        "members": [{key: value for key, value in member.items() if key not in {"source_deal_ids", "source_event_keys"}} for member in ordered],
        "findings": findings,
        "writes": "INDIVIDUAL_M1_INTAKE_ONLY; NO_COMBINED_ARTIFACT",
    }


def create_combined_realised_balance(workspace_root: Path, source_paths: list[str]) -> dict[str, object]:
    """Write an explicit, bounded combined balance artifact only for eligible input."""

    preflight = preflight_mt5_excel_batch(workspace_root, source_paths)
    if preflight["status"] != "ELIGIBLE":
        raise CoreError("E_BATCH_BLOCKED", "Combined balance artifact was not created because batch preflight is blocked.", details={"findings": preflight["findings"]})
    root = workspace_root.resolve()
    members = preflight["members"]
    if not isinstance(members, list):
        raise CoreError("E_INTERNAL", "Eligible batch preflight has invalid member data.")
    rows: list[dict[str, object]] = []
    for order, member in enumerate(members, start=1):
        dataset = read_dataset(root, str(member["dataset_ref"]))
        for event in sorted(dataset["events"], key=lambda item: int(item["source_sequence"])):
            rows.append({"batch_order": order, "dataset_ref": str(member["dataset_ref"]), "source_sha256": str(member["source_sha256"]), "source_sequence": int(event["source_sequence"]), "timestamp": str(event["source_timestamp"]), "reported_balance": str(event["reported_balance"])})
    batch_id = str(preflight["preflight_id"])
    target = root / "batches" / batch_id
    target.mkdir(parents=True, exist_ok=True)
    table_path = target / "combined-realised-balance.parquet"
    manifest_path = target / "manifest.json"
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for combined balance storage.") from error
    pq.write_table(pa.Table.from_pylist(rows), table_path, compression="zstd", use_dictionary=False, write_statistics=True)
    table_hash = _file_sha256(table_path)
    manifest = {"schema_version": "1.0", "batch_id": batch_id, "calculation_version": CALCULATION_VERSION, "analysis_basis": "COMBINED_REALISED_BALANCE", "account_declaration": preflight["account_declaration"], "preflight": preflight, "row_count": len(rows), "artifacts": {"table": f"batch:{batch_id}:combined-realised-balance", "table_sha256": table_hash}, "limitations": ["Combined series contains source-reported realised balances only.", "Intratrade equity and equity drawdown remain unavailable.", "No research document was created." ]}
    _atomic_json(manifest_path, manifest)
    opening = Decimal(str(rows[0]["reported_balance"]))
    final = Decimal(str(rows[-1]["reported_balance"]))
    return {"batch_id": batch_id, "status": "CREATED", "analysis_basis": "COMBINED_REALISED_BALANCE", "currency": members[0].get("currency"), "row_count": len(rows), "opening_balance": format(opening, "f"), "final_reported_balance": format(final, "f"), "reported_balance_change": format(final - opening, "f"), "balance_points": [{"timestamp": row["timestamp"], "balance": row["reported_balance"]} for row in rows], "preflight": preflight, "artifacts": {"table": manifest["artifacts"]["table"], "manifest": f"batch:{batch_id}:manifest", "table_sha256": table_hash}}


def combined_daily_drawdown(workspace_root: Path, source_paths: list[str]) -> dict[str, object]:
    """Return qualified source-clock daily drawdown for an eligible batch; no write."""
    preflight = preflight_mt5_excel_batch(workspace_root, source_paths)
    if preflight["status"] != "ELIGIBLE":
        raise CoreError("E_BATCH_BLOCKED", "Combined daily drawdown was not calculated because batch preflight is blocked.")
    events: list[dict[str, object]] = []
    for member in preflight["members"]:
        events.extend(read_dataset(workspace_root, str(member["dataset_ref"]))["events"])
    events = sorted(events, key=lambda event: (str(event["source_timestamp"]), int(event["source_sequence"])))
    for sequence, event in enumerate(events, start=1): event["source_sequence"] = sequence
    result, rows = realised_balance_daily_drawdown({"metadata": {"dataset_ref": f"batch:{preflight['preflight_id']}", "settings": {"Currency": preflight["members"][0]["currency"]}}, "events": events})
    result["warnings"].append("Batch boundary coverage is GAP_UNDETERMINED; daily rows use observed report-clock dates only and are not a continuous equity or prop-firm result.")
    return {**result, "batch_id": preflight["preflight_id"], "rows": rows, "preflight": preflight}


def _member(workspace_root: Any, intake: dict[str, object]) -> dict[str, Any]:
    dataset_ref = str(intake["dataset_ref"])
    receipt = intake["intake_receipt"]
    if not isinstance(receipt, dict):
        raise CoreError("E_INTERNAL", "Batch preflight could not read complete intake evidence.")
    currency = receipt["supplied_facts"].get("currency") if isinstance(receipt.get("supplied_facts"), dict) else None
    return _member_from_dataset(dataset_ref, str(intake["dataset_id"]), str(receipt["source_sha256"]), str(receipt["original_filename"]), currency, read_dataset(workspace_root, dataset_ref))


def _member_from_dataset(dataset_ref: str, dataset_id: str, source_sha256: str, filename: str, currency: Any, dataset: dict[str, Any]) -> dict[str, Any]:
    events = sorted(dataset["events"], key=lambda event: int(event["source_sequence"]))
    if not events:
        raise CoreError("E_INTERNAL", "Batch preflight could not read complete intake evidence.")
    return {
        "dataset_ref": dataset_ref,
        "dataset_id": dataset_id,
        "source_sha256": source_sha256,
        "filename": filename,
        "currency": currency,
        "first_timestamp": str(events[0]["source_timestamp"]),
        "last_timestamp": str(events[-1]["source_timestamp"]),
        "opening_balance": str(events[0]["reported_balance"]),
        "final_reported_balance": str(events[-1]["reported_balance"]),
        "event_count": len(events),
        "source_deal_ids": {str(event["source_deal_id"]) for event in events},
        "source_event_keys": {(str(event["source_timestamp"]), str(event["source_deal_id"])) for event in events},
    }


def _finding(severity: str, code: str, message: str, members: list[dict[str, Any]] | None = None) -> dict[str, object]:
    finding: dict[str, object] = {"severity": severity, "code": code, "message": message}
    if members is not None:
        finding["members"] = [{"dataset_ref": member["dataset_ref"], "filename": member["filename"]} for member in members]
    return finding


def _label(member: dict[str, Any]) -> str:
    return f"'{member['filename']}'"


def _unique(members: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for member in members:
        seen.setdefault(str(member["dataset_ref"]), member)
    return list(seen.values())


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _atomic_json(path: Path, value: object) -> None:
    with NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8", prefix="manifest-", suffix=".tmp") as temporary:
        json.dump(value, temporary, ensure_ascii=False, indent=2, sort_keys=True)
        temporary.write("\n")
        temporary_path = Path(temporary.name)
    try:
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)
