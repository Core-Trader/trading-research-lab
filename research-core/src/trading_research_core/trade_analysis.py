"""Deterministic M2 close-event and inferred-lifecycle analysis.

Regular MT5 Strategy Tester Excel reports provide deal events, not proven
position identities. This module therefore keeps source-verified close-event
analysis separate from optional, explicitly labelled inferred lifecycles.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal, localcontext
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from . import CORE_VERSION
from .errors import CoreError
from .identities import stable_uuid


POLICY_ID = "mt5-excel-hedging-fifo-v1"
CALCULATION_VERSION = "m2-trade-event-analysis-1"
_QUALITY_ORDER = ("MT5_VERIFIED", "INFERRED", "UNPAIRED", "AMBIGUOUS")


def close_event_summary(dataset: dict[str, object]) -> tuple[dict[str, object], list[dict[str, object]]]:
    """Return source-verified closing-deal economics and compact metrics only."""

    metadata, events = _dataset_parts(dataset)
    rows: list[dict[str, object]] = []
    for event in events:
        if event.get("event_type") != "POSITION_CLOSE":
            continue
        profit = _decimal(event.get("source_profit"))
        commission = _decimal(event.get("source_commission"))
        swap = _decimal(event.get("source_swap"))
        rows.append({
            "source_sequence": int(event["source_sequence"]),
            "source_deal_id": str(event.get("source_deal_id") or ""),
            "timestamp": str(event["source_timestamp"]),
            "symbol": str(event.get("symbol") or ""),
            "direction": str(event.get("side") or ""),
            "volume": _format_decimal(_decimal(event.get("volume"))),
            "profit": _format_decimal(profit),
            "commission": _format_decimal(commission),
            "swap": _format_decimal(swap),
            "net_pnl": _format_decimal(profit + commission + swap),
            "source_quality": "MT5_VERIFIED",
        })
    return {
        "analysis_basis": "VERIFIED_CLOSE_EVENTS",
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": metadata["dataset_ref"],
        "currency": _currency(metadata),
        "summary": _metrics(rows),
        "quality_counts": {"MT5_VERIFIED": len(rows), "INFERRED": 0, "UNPAIRED": 0, "AMBIGUOUS": 0},
        "warnings": [
            "Verified close events are source deal facts, not reconstructed position lifecycles.",
            "Distribution values are stored in the controlled close-event artifact; IPC returns compact metrics only.",
        ],
    }, rows


def reconstruct_lifecycles(dataset: dict[str, object], *, account_mode: str) -> tuple[dict[str, object], list[dict[str, object]]]:
    """Apply the owner-approved declared-hedging FIFO inference policy.

    A result is never marked MT5_VERIFIED because this adapter does not expose
    unambiguous position identity. Non-hedging declarations intentionally do
    not enter inference and return no lifecycle records.
    """

    metadata, events = _dataset_parts(dataset)
    normalized_mode = account_mode.strip().upper()
    configuration = {
        "policy_id": POLICY_ID,
        "account_mode": normalized_mode,
        "account_mode_source": "USER_SUPPLIED",
        "matching": "chronological FIFO within identical symbol and direction",
        "partial_economics": "Decimal volume-proportional allocation; final full-event allocation receives deterministic remainder",
    }
    configuration_hash = _configuration_hash(configuration)
    if normalized_mode != "HEDGING":
        return {
            "analysis_basis": "INFERRED_LIFECYCLES",
            "calculation_version": CALCULATION_VERSION,
            "dataset_ref": metadata["dataset_ref"],
            "currency": _currency(metadata),
            "policy": configuration,
            "policy_configuration_hash": configuration_hash,
            "eligible": False,
            "summary": _metrics([]),
            "quality_counts": {"MT5_VERIFIED": 0, "INFERRED": 0, "UNPAIRED": 0, "AMBIGUOUS": 0},
            "warnings": [
                "No inferred lifecycles were created: rebuilding trades needs you to declare the account as a hedging account.",
                f"Received account-mode declaration: {normalized_mode or 'UNDECLARED'}.",
            ],
        }, []

    openings: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    allocations: list[dict[str, Any]] = []
    unpaired: list[dict[str, object]] = []
    for event in events:
        event_type = str(event.get("event_type"))
        if event_type == "POSITION_OPEN":
            openings[_event_key(event)].append({"event": event, "remaining": _decimal(event.get("volume"))})
            continue
        if event_type != "POSITION_CLOSE":
            continue
        remaining_close = _decimal(event.get("volume"))
        candidates = openings[_event_key(event)]
        for opening in candidates:
            if remaining_close <= 0:
                break
            if opening["remaining"] <= 0:
                continue
            allocated = min(opening["remaining"], remaining_close)
            allocations.append({"opening": opening["event"], "closing": event, "volume": allocated})
            opening["remaining"] -= allocated
            remaining_close -= allocated
        if remaining_close > 0:
            unpaired.append(_unpaired_record(event, remaining_close, "CLOSING_EVENT_HAS_NO_FIFO_OPENING"))

    for queued_openings in openings.values():
        for opening in queued_openings:
            if opening["remaining"] > 0:
                unpaired.append(_unpaired_record(opening["event"], opening["remaining"], "OPENING_EVENT_HAS_NO_FIFO_CLOSE"))

    economics = _allocate_event_economics(allocations)
    lifecycles: list[dict[str, object]] = []
    for ordinal, allocation in enumerate(allocations, start=1):
        opening = allocation["opening"]
        closing = allocation["closing"]
        open_components = economics[("open", ordinal)]
        close_components = economics[("close", ordinal)]
        profit = open_components["profit"] + close_components["profit"]
        commission = open_components["commission"] + close_components["commission"]
        swap = open_components["swap"] + close_components["swap"]
        duration = _duration_seconds(str(opening["source_timestamp"]), str(closing["source_timestamp"]))
        lifecycle_id = stable_uuid(
            "m2-inferred-lifecycle",
            str(metadata["dataset_ref"]),
            POLICY_ID,
            configuration_hash,
            str(opening["source_sequence"]),
            str(closing["source_sequence"]),
            str(ordinal),
        )
        lifecycles.append({
            "lifecycle_id": lifecycle_id,
            "source_quality": "INFERRED",
            "policy_id": POLICY_ID,
            "policy_configuration_hash": configuration_hash,
            "account_mode": "HEDGING",
            "account_mode_source": "USER_SUPPLIED",
            "symbol": str(opening.get("symbol") or ""),
            "direction": str(opening.get("side") or ""),
            "allocated_volume": _format_decimal(allocation["volume"]),
            "open_source_sequence": int(opening["source_sequence"]),
            "close_source_sequence": int(closing["source_sequence"]),
            "source_sequences": [int(opening["source_sequence"]), int(closing["source_sequence"])],
            "open_timestamp": str(opening["source_timestamp"]),
            "close_timestamp": str(closing["source_timestamp"]),
            "holding_duration_seconds": duration,
            "profit": _format_decimal(profit),
            "commission": _format_decimal(commission),
            "swap": _format_decimal(swap),
            "net_pnl": _format_decimal(profit + commission + swap),
        })

    records = [*lifecycles, *unpaired]
    quality_counts = {quality: sum(record["source_quality"] == quality for record in records) for quality in _QUALITY_ORDER}
    warnings = [
        "All lifecycle records are INFERRED under the declared hedging FIFO policy; regular MT5 Excel reports do not establish MT5_VERIFIED position identity.",
        "UNPAIRED records intentionally have no inferred P/L or holding duration.",
    ]
    if unpaired:
        warnings.append(f"{len(unpaired)} unpaired event allocation(s) were retained without guessed lifecycle economics.")
    return {
        "analysis_basis": "INFERRED_LIFECYCLES",
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": metadata["dataset_ref"],
        "currency": _currency(metadata),
        "policy": configuration,
        "policy_configuration_hash": configuration_hash,
        "eligible": True,
        "summary": _metrics(lifecycles),
        "quality_counts": quality_counts,
        "warnings": warnings,
    }, records


def write_trade_artifact(workspace_root: Path, dataset_ref: str, kind: str, result: dict[str, object], rows: list[dict[str, object]]) -> dict[str, object]:
    """Persist an M2 artifact under the bounded dataset workspace only."""

    if kind not in {"close-events", "lifecycles"}:
        raise CoreError("E_INTERNAL", "Unsupported M2 artifact kind.")
    source_sha256 = _source_sha256(dataset_ref)
    result_identity = str(result.get("policy_configuration_hash") or CALCULATION_VERSION)
    analysis_id = stable_uuid("m2-analysis", dataset_ref, kind, result_identity, CORE_VERSION)
    root = workspace_root.resolve()
    target = (root / "datasets" / source_sha256 / "analysis" / analysis_id).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "M2 analysis path escapes the worker workspace.") from error
    target.mkdir(parents=True, exist_ok=True)
    parquet_path = target / f"{kind}.parquet"
    manifest_path = target / "manifest.json"
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for M2 artifact storage.") from error
    table = pa.Table.from_pylist(rows) if rows else pa.table({"record_count": pa.array([], type=pa.int64())})
    pq.write_table(table, parquet_path, compression="zstd", use_dictionary=False, write_statistics=True)
    manifest = {
        "schema_version": "1.0",
        "analysis_id": analysis_id,
        "analysis_kind": kind,
        "dataset_ref": dataset_ref,
        "core_version": CORE_VERSION,
        "calculation_version": CALCULATION_VERSION,
        "record_count": len(rows),
        "result": result,
        "storage": {"parquet": parquet_path.name, "numeric_representation": "decimal_string"},
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    artifact_ref = f"{dataset_ref}:analysis:{analysis_id}:{kind}"
    return {
        **result,
        "analysis_id": analysis_id,
        "artifacts": {
            "table": artifact_ref,
            "manifest": f"{dataset_ref}:analysis:{analysis_id}:manifest",
            "table_sha256": _file_sha256(parquet_path),
            "manifest_sha256": _file_sha256(manifest_path),
        },
    }


def _dataset_parts(dataset: dict[str, object]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    metadata = dataset.get("metadata")
    events = dataset.get("events")
    if not isinstance(metadata, dict) or not isinstance(events, list) or not isinstance(metadata.get("dataset_ref"), str):
        raise CoreError("E_INTERNAL", "Canonical dataset is malformed.")
    ordered = sorted((event for event in events if isinstance(event, dict)), key=lambda event: int(event["source_sequence"]))
    return metadata, ordered


def _event_key(event: dict[str, Any]) -> tuple[str, str]:
    symbol = str(event.get("symbol") or "")
    side = str(event.get("side") or "")
    if not symbol or side not in {"BUY", "SELL"}:
        raise CoreError("E_DATASET_INVALID", "M2 requires supported symbol and Buy/Sell event direction.", details={"source_sequence": event.get("source_sequence")})
    return symbol, side


def _allocate_event_economics(allocations: list[dict[str, Any]]) -> dict[tuple[str, int], dict[str, Decimal]]:
    by_event: dict[tuple[str, int], list[tuple[int, Decimal, dict[str, Any]]]] = defaultdict(list)
    for ordinal, allocation in enumerate(allocations, start=1):
        by_event[("open", int(allocation["opening"]["source_sequence"]))].append((ordinal, allocation["volume"], allocation["opening"]))
        by_event[("close", int(allocation["closing"]["source_sequence"]))].append((ordinal, allocation["volume"], allocation["closing"]))
    results: dict[tuple[str, int], dict[str, Decimal]] = {}
    for role_and_sequence, pieces in by_event.items():
        total_volume = _decimal(pieces[0][2].get("volume"))
        allocated_volume = sum((piece[1] for piece in pieces), Decimal("0"))
        prior = {component: Decimal("0") for component in ("profit", "commission", "swap")}
        fully_allocated = allocated_volume == total_volume
        for index, (ordinal, volume, event) in enumerate(pieces):
            values: dict[str, Decimal] = {}
            for component, field in (("profit", "source_profit"), ("commission", "source_commission"), ("swap", "source_swap")):
                amount = _decimal(event.get(field))
                if fully_allocated and index == len(pieces) - 1:
                    values[component] = amount - prior[component]
                else:
                    with localcontext() as context:
                        context.prec = 50
                        values[component] = amount * volume / total_volume
                    prior[component] += values[component]
            results[(role_and_sequence[0], ordinal)] = values
    return results


def _unpaired_record(event: dict[str, Any], volume: Decimal, reason: str) -> dict[str, object]:
    return {
        "lifecycle_id": None,
        "source_quality": "UNPAIRED",
        "policy_id": POLICY_ID,
        "policy_configuration_hash": None,
        "account_mode": "HEDGING",
        "account_mode_source": "USER_SUPPLIED",
        "symbol": str(event.get("symbol") or ""),
        "direction": str(event.get("side") or ""),
        "allocated_volume": _format_decimal(volume),
        "open_source_sequence": int(event["source_sequence"]) if event.get("event_type") == "POSITION_OPEN" else None,
        "close_source_sequence": int(event["source_sequence"]) if event.get("event_type") == "POSITION_CLOSE" else None,
        "source_sequences": [int(event["source_sequence"])],
        "open_timestamp": str(event["source_timestamp"]) if event.get("event_type") == "POSITION_OPEN" else None,
        "close_timestamp": str(event["source_timestamp"]) if event.get("event_type") == "POSITION_CLOSE" else None,
        "holding_duration_seconds": None,
        "profit": None,
        "commission": None,
        "swap": None,
        "net_pnl": None,
        "unpaired_reason": reason,
    }


def _metrics(rows: list[dict[str, object]]) -> dict[str, object]:
    values = [_decimal(row.get("net_pnl")) for row in rows if row.get("net_pnl") is not None]
    wins = sum(value > 0 for value in values)
    losses = sum(value < 0 for value in values)
    breakeven = len(values) - wins - losses
    gross_profit = sum((value for value in values if value > 0), Decimal("0"))
    gross_loss = sum((value for value in values if value < 0), Decimal("0"))
    count = len(values)
    return {
        "count": count,
        "net_pnl": _format_decimal(sum(values, Decimal("0"))),
        "gross_profit": _format_decimal(gross_profit),
        "gross_loss": _format_decimal(gross_loss),
        "win_count": wins,
        "loss_count": losses,
        "breakeven_count": breakeven,
        "win_rate": _format_decimal(Decimal(wins) / Decimal(count) * Decimal("100")) if count else None,
        "loss_rate": _format_decimal(Decimal(losses) / Decimal(count) * Decimal("100")) if count else None,
        "breakeven_rate": _format_decimal(Decimal(breakeven) / Decimal(count) * Decimal("100")) if count else None,
    }


def _configuration_hash(configuration: dict[str, object]) -> str:
    canonical = json.dumps(configuration, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(canonical.encode("utf-8")).hexdigest().upper()


def _source_sha256(dataset_ref: str) -> str:
    prefix = "mt5:"
    value = dataset_ref.removeprefix(prefix)
    if not dataset_ref.startswith(prefix) or len(value) != 64 or any(character not in "0123456789ABCDEF" for character in value):
        raise CoreError("E_DATASET_INVALID", "dataset_ref contains an invalid SHA-256 identity.")
    return value


def _currency(metadata: dict[str, Any]) -> str | None:
    settings = metadata.get("settings")
    return settings.get("Currency") if isinstance(settings, dict) and isinstance(settings.get("Currency"), str) else None


def _duration_seconds(open_timestamp: str, close_timestamp: str) -> int | None:
    try:
        return int((datetime.fromisoformat(close_timestamp) - datetime.fromisoformat(open_timestamp)).total_seconds())
    except ValueError:
        return None


def _decimal(value: object) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _format_decimal(value: Decimal) -> str:
    return format(value, "f")


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()
