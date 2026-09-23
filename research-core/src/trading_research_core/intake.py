"""Milestone 1 immutable raw intake, provenance receipts, and dataset registry."""

from __future__ import annotations

import json
import os
import shutil
from hashlib import sha256
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from . import CORE_VERSION
from .dataset_store import CANONICAL_SCHEMA_VERSION, write_dataset
from .errors import CoreError
from .mt5_excel import file_sha256, import_mt5_excel
from .mt5_html import HTML_SUFFIXES, import_mt5_html


ADAPTER_ID = "mt5-strategy-tester-excel"
ADAPTER_VERSION = "1"
HTML_ADAPTER_ID = "mt5-strategy-tester-html"
HTML_ADAPTER_VERSION = "1"
REGISTRY_SCHEMA_VERSION = "1.0"
INTAKE_RECEIPT_SCHEMA_VERSION = "1.0"


def intake_mt5_report(workspace_root: Path, source_path: str) -> dict[str, object]:
    """Validate, snapshot, canonicalize, and register one MT5 report (.xlsx or HTML)."""

    root = workspace_root.resolve()
    original = Path(source_path).expanduser().resolve()
    html = original.suffix.lower() in HTML_SUFFIXES
    imported = import_mt5_html(source_path) if html else import_mt5_excel(source_path)  # Validate before creating writes.
    source = _mapping(imported, "source")
    source_hash = _string(source, "sha256")
    snapshot, created = _ensure_snapshot(root, original, source_hash, ".htm" if html else ".xlsx")
    try:
        dataset = write_dataset(root, imported)
        adapter = (HTML_ADAPTER_ID, HTML_ADAPTER_VERSION) if html else (ADAPTER_ID, ADAPTER_VERSION)
        receipt = _receipt(source, _mapping(imported, "settings"), _events(imported), original, snapshot, dataset, adapter, list(imported.get("source_checks", [])))
        _upsert_registry(root, receipt)
        return {**dataset, "intake_receipt": receipt, "intake_status": "SNAPSHOT_CREATED" if created else "REUSED_IDENTICAL_SOURCE"}
    except Exception:
        if created:
            snapshot.unlink(missing_ok=True)
        raise


# Kept for existing callers and the original IPC method; accepts HTML too.
intake_mt5_excel = intake_mt5_report


def list_registry(workspace_root: Path) -> dict[str, object]:
    """Active reports in `entries`; archived ones separately in `archived_entries`."""

    registry = _load_registry(workspace_root.resolve())
    entries = sorted(registry["entries"], key=lambda entry: str(entry["dataset_ref"]))
    return {
        "registry_schema_version": REGISTRY_SCHEMA_VERSION,
        "entries": [entry for entry in entries if not entry.get("archived")],
        "archived_entries": [entry for entry in entries if entry.get("archived")],
    }


def set_archived(workspace_root: Path, dataset_ref: str, archived: bool) -> dict[str, object]:
    """Archive or restore a report. Nothing is deleted: the raw snapshot, derived
    tables, and everything that uses the report keep working; archiving only
    hides it from the library and pickers.
    """

    root = workspace_root.resolve()
    registry = _load_registry(root)
    entry = next((item for item in registry["entries"] if item.get("dataset_ref") == dataset_ref), None)
    if entry is None:
        raise CoreError("E_DATASET_NOT_FOUND", "The report is not in the library.", details={"dataset_ref": dataset_ref})
    if archived:
        entry["archived"] = True
    else:
        entry.pop("archived", None)
    payload = {"registry_schema_version": REGISTRY_SCHEMA_VERSION, "entries": sorted(registry["entries"], key=lambda item: str(item["dataset_ref"]))}
    _atomic_json(_registry_path(root), payload)
    return {"dataset_ref": dataset_ref, "archived": archived, "used_by": dataset_usages(root, dataset_ref)}


def set_evidence_block(workspace_root: Path, dataset_ref: str, key: str, block: dict[str, object]) -> None:
    """Record companion evidence (equity log, settings check) on a report's registry entry."""

    if key not in {"equity", "set_check"}:
        raise CoreError("E_INTERNAL", "Unknown evidence block.", details={"key": key})
    root = workspace_root.resolve()
    registry = _load_registry(root)
    entry = next((item for item in registry["entries"] if item.get("dataset_ref") == dataset_ref), None)
    if entry is None:
        raise CoreError("E_DATASET_NOT_FOUND", "The report is not in the library.", details={"dataset_ref": dataset_ref})
    entry[key] = block
    _atomic_json(_registry_path(root), {"registry_schema_version": REGISTRY_SCHEMA_VERSION, "entries": sorted(registry["entries"], key=lambda item: str(item["dataset_ref"]))})


def set_equity_evidence(workspace_root: Path, dataset_ref: str, equity: dict[str, object]) -> None:
    """Record a verified equity log on the report's registry entry (PL-006)."""

    set_evidence_block(workspace_root, dataset_ref, "equity", equity)


def dataset_usages(workspace_root: Path, dataset_ref: str) -> list[dict[str, str]]:
    """TRL-managed items that reference a report (saved combinations, study
    single tests, sequential batches, report revisions). Vault notes are found
    by the plugin through their `trl_dataset_id`.
    """

    return [{key: item[key] for key in ("kind", "name")} for item in _dependents(workspace_root.resolve(), dataset_ref)]


DELETION_LOG_VERSION = "dataset-deletion-1"
DEPENDENT_MODES = {"DELETE", "KEEP"}


def deletion_preview(workspace_root: Path, dataset_ref: str) -> dict[str, object]:
    """What a permanent deletion would remove, before anything is removed."""

    root = workspace_root.resolve()
    entry = get_evidence(root, dataset_ref)
    source_hash = str(entry["source_sha256"])
    owned = [path for path in (_bounded(root, "raw", source_hash), _bounded(root, "datasets", source_hash)) if path.exists()]
    return {
        "dataset_ref": dataset_ref,
        "dataset_id": entry.get("dataset_id"),
        "original_filename": entry.get("original_filename"),
        "archived": bool(entry.get("archived")),
        "bytes": sum(_size(path) for path in owned),
        "dependents": [{key: item[key] for key in ("kind", "name")} for item in _dependents(root, dataset_ref)],
        "notes": [
            "Deletes TRL's copy of the report and everything derived from it. Your original file is not touched.",
            "Keeping dependents leaves them in place; saved combinations then show as unavailable and study attachments keep their recorded values.",
        ],
    }


def delete_dataset(workspace_root: Path, dataset_ref: str, dependents: str) -> dict[str, object]:
    """Permanently delete a report's TRL copy and derived data (DS-003).

    `dependents` is DELETE (also remove TRL-managed items that use it) or KEEP.
    The registry entry, raw snapshot, and canonical/derived tables are always
    removed; the original source file is never touched. Every deletion is
    appended to `registry/deletions.jsonl` for provenance.
    """

    if dependents not in DEPENDENT_MODES:
        raise CoreError("E_REQUEST_INVALID", "dependents must be DELETE or KEEP.")
    root = workspace_root.resolve()
    entry = get_evidence(root, dataset_ref)
    source_hash = str(entry["source_sha256"])
    found = _dependents(root, dataset_ref)
    removed: list[str] = []
    for path in (_bounded(root, "raw", source_hash), _bounded(root, "datasets", source_hash)):
        if path.exists():
            shutil.rmtree(path)
            removed.append(path.relative_to(root).as_posix())
    if dependents == "DELETE":
        for item in found:
            path = item["path"]
            if path.is_dir():
                shutil.rmtree(path)
            elif path.exists():
                path.unlink()
            removed.append(path.relative_to(root).as_posix())
    registry = _load_registry(root)
    payload = {"registry_schema_version": REGISTRY_SCHEMA_VERSION, "entries": sorted((item for item in registry["entries"] if item.get("dataset_ref") != dataset_ref), key=lambda item: str(item["dataset_ref"]))}
    _atomic_json(_registry_path(root), payload)
    from datetime import datetime, timezone

    record = {
        "log_version": DELETION_LOG_VERSION,
        "deleted_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset_ref": dataset_ref,
        "dataset_id": entry.get("dataset_id"),
        "source_sha256": source_hash,
        "original_filename": entry.get("original_filename"),
        "dependents_mode": dependents,
        "dependents": [{key: item[key] for key in ("kind", "name")} for item in found],
        "removed": removed,
    }
    with _bounded(root, "registry", "deletions.jsonl").open("a", encoding="utf-8") as log:
        log.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    return {key: value for key, value in record.items() if key != "log_version"} | {"kept_dependents": [] if dependents == "DELETE" else record["dependents"]}


def _dependents(root: Path, dataset_ref: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for path in sorted((root / "portfolio-combinations").glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        if any(dataset_ref in track for track in record.get("tracks", [])):
            found.append({"kind": "SAVED_COMBINATION", "name": str(record.get("name", path.stem)), "path": path})
    single = f"{dataset_ref.removeprefix('mt5:')}.json"
    for path in sorted((root / "parameter-studies").glob(f"*/single-tests/{single}")):
        found.append({"kind": "PARAMETER_STUDY_SINGLE_TEST", "name": path.parent.parent.name, "path": path})
    for folder in sorted(path for path in (root / "batches").glob("*") if path.is_dir()):
        if any(dataset_ref in path.read_text(encoding="utf-8", errors="replace") for path in folder.glob("*.json")):
            found.append({"kind": "SEQUENTIAL_BATCH", "name": folder.name, "path": folder})
    for folder in sorted(path for path in (root / "reports").glob("*") if path.is_dir()):
        if any(dataset_ref in path.read_text(encoding="utf-8", errors="replace") for path in folder.rglob("*.json")):
            found.append({"kind": "REPORT_REVISIONS", "name": folder.name, "path": folder})
    return found


def _size(path: Path) -> int:
    return path.stat().st_size if path.is_file() else sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def get_evidence(workspace_root: Path, dataset_ref: str) -> dict[str, object]:
    for entry in _load_registry(workspace_root.resolve())["entries"]:
        if entry.get("dataset_ref") == dataset_ref:
            return entry
    raise CoreError("E_DATASET_NOT_FOUND", "Dataset evidence is not available.", details={"dataset_ref": dataset_ref})


def verify_raw_snapshot(workspace_root: Path, dataset_ref: str) -> dict[str, object]:
    evidence = get_evidence(workspace_root, dataset_ref)
    snapshot = Path(str(evidence["raw_snapshot_path"]))
    if not snapshot.is_file():
        raise CoreError("E_RAW_SNAPSHOT_MISSING", "Managed raw snapshot is missing.", details={"dataset_ref": dataset_ref})
    observed = file_sha256(snapshot)
    expected = str(evidence["source_sha256"])
    return {"dataset_ref": dataset_ref, "expected_sha256": expected, "observed_sha256": observed, "verified": observed == expected}


def _ensure_snapshot(root: Path, original: Path, source_hash: str, suffix: str = ".xlsx") -> tuple[Path, bool]:
    target = _bounded(root, "raw", source_hash, f"source{suffix}")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file():
        if file_sha256(target) != source_hash:
            raise CoreError("E_RAW_SNAPSHOT_MISMATCH", "Existing managed raw snapshot hash does not match the selected source.")
        return target, False
    with NamedTemporaryFile(delete=False, dir=target.parent, prefix="snapshot-", suffix=".tmp") as temporary:
        temporary_path = Path(temporary.name)
    try:
        shutil.copyfile(original, temporary_path)
        if file_sha256(temporary_path) != source_hash:
            raise CoreError("E_RAW_SNAPSHOT_MISMATCH", "Copied raw snapshot hash does not match the selected source.")
        os.replace(temporary_path, target)
    finally:
        temporary_path.unlink(missing_ok=True)
    return target, True


def _receipt(
    source: dict[str, Any],
    settings: dict[str, Any],
    events: list[dict[str, object]],
    original: Path,
    snapshot: Path,
    dataset: dict[str, object],
    adapter: tuple[str, str] = (ADAPTER_ID, ADAPTER_VERSION),
    source_checks: list[str] | None = None,
) -> dict[str, object]:
    configuration = {"adapter_id": adapter[0], "adapter_version": adapter[1], "intake_mode": "MANAGED_SNAPSHOT"}
    configuration_hash = sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode()).hexdigest().upper()
    return {
        "receipt_schema_version": INTAKE_RECEIPT_SCHEMA_VERSION,
        "dataset_ref": dataset["dataset_ref"], "dataset_id": dataset["dataset_id"], "source_import_id": dataset["source_import_id"],
        "source_sha256": source["sha256"], "original_filename": source["filename"], "original_selected_path": str(original),
        "raw_snapshot_path": str(snapshot), "raw_snapshot_status": "VERIFIED", "byte_count": source["byte_count"],
        "adapter": configuration, "configuration_sha256": configuration_hash, "core_version": CORE_VERSION,
        "canonical_schema_version": CANONICAL_SCHEMA_VERSION, "worksheet_name": source["worksheet_name"],
        "event_count": dataset["event_count"], "source_quality": "MT5_VERIFIED", "warnings": [],
        "supplied_facts": {
            "symbol": settings.get("Symbol"), "currency": settings.get("Currency"),
            "period": settings.get("Period"), "initial_deposit": settings.get("Initial Deposit"),
            "leverage": settings.get("Leverage"),
        },
        "source_layout": {"worksheet_name": source["worksheet_name"], "section_name": "Deals", "adapter_schema_version": adapter[1]},
        "source_checks": source_checks or [],
        "observed_price_scales": sorted({scale for event in events if (scale := event.get("source_price_scale")) is not None}),
        "artifacts": dataset["artifacts"],
        "limitations": ["Source timestamps are preserved as reported; broker timezone is not inferred in Milestone 1."],
    }


def _registry_path(root: Path) -> Path:
    return _bounded(root, "registry", "datasets.json")


def _load_registry(root: Path) -> dict[str, list[dict[str, object]]]:
    path = _registry_path(root)
    if not path.is_file():
        return {"entries": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get("entries"), list):
        raise CoreError("E_REGISTRY_INVALID", "Dataset registry has an invalid entries field.")
    return {"entries": data["entries"]}


def _upsert_registry(root: Path, receipt: dict[str, object]) -> None:
    path = _registry_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    registry = _load_registry(root)
    # Importing a report again is an explicit act: it also restores it from the archive.
    entries = [entry for entry in registry["entries"] if entry.get("dataset_ref") != receipt["dataset_ref"]]
    entries.append(receipt)
    payload = {"registry_schema_version": REGISTRY_SCHEMA_VERSION, "entries": sorted(entries, key=lambda entry: str(entry["dataset_ref"]))}
    _atomic_json(path, payload)


def _atomic_json(path: Path, value: object) -> None:
    with NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8", prefix="registry-", suffix=".tmp") as temporary:
        json.dump(value, temporary, ensure_ascii=False, indent=2, sort_keys=True)
        temporary.write("\n")
        temporary_path = Path(temporary.name)
    os.replace(temporary_path, path)


def _bounded(root: Path, *parts: str) -> Path:
    candidate = root.joinpath(*parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Intake path escapes the worker workspace.") from error
    return candidate


def _mapping(value: dict[str, object], key: str) -> dict[str, Any]:
    result = value.get(key)
    if not isinstance(result, dict):
        raise CoreError("E_INTERNAL", f"Missing intake {key} mapping.")
    return result


def _events(value: dict[str, object]) -> list[dict[str, object]]:
    result = value.get("events")
    if not isinstance(result, list) or not all(isinstance(event, dict) for event in result):
        raise CoreError("E_INTERNAL", "Missing intake events.")
    return result


def _string(value: dict[str, Any], key: str) -> str:
    result = value.get(key)
    if not isinstance(result, str) or not result:
        raise CoreError("E_INTERNAL", f"Missing intake {key} string.")
    return result
