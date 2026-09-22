"""Canonical Parquet storage with a tightly bounded local write surface."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .errors import CoreError
from .identities import stable_uuid


CANONICAL_SCHEMA_VERSION = "1.1"


def dataset_directory(workspace_root: Path, source_sha256: str) -> Path:
    """Return a deterministic dataset location inside the approved workspace."""

    root = workspace_root.resolve()
    candidate = (root / "datasets" / source_sha256).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Dataset path escapes the worker workspace.") from error
    return candidate


def write_dataset(workspace_root: Path, imported: dict[str, object]) -> dict[str, object]:
    """Write source-preserving event rows and deterministic metadata to Parquet/JSON."""

    source = _mapping(imported, "source")
    source_sha256 = _string(source, "sha256")
    target = dataset_directory(workspace_root, source_sha256)
    target.mkdir(parents=True, exist_ok=True)
    metadata_path = target / "metadata.json"
    parquet_path = target / "events.parquet"
    if metadata_path.is_file() and parquet_path.is_file():
        existing = json.loads(metadata_path.read_text(encoding="utf-8"))
        if (
            existing.get("source", {}).get("sha256") == source_sha256
            and existing.get("schema_version") == CANONICAL_SCHEMA_VERSION
        ):
            return {
                "dataset_ref": existing["dataset_ref"],
                "dataset_id": existing["dataset_id"],
                "source_import_id": existing["source_import_id"],
                "artifacts": {"events": f"{existing['dataset_ref']}:events", "manifest": f"{existing['dataset_ref']}:manifest"},
                "event_count": existing["event_count"],
                "source": existing["source"],
                "cache_status": "REUSED_IDENTICAL_SOURCE",
            }
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for canonical Parquet storage.") from error

    events = imported.get("events")
    if not isinstance(events, list):
        raise CoreError("E_INTERNAL", "Imported events are malformed.")
    canonical_events = [
        {
            "event_id": stable_uuid("canonical-event", source_sha256, str(event["source_sequence"])),
            **event,
        }
        for event in events
    ]
    table = pa.Table.from_pylist(canonical_events)
    pq.write_table(table, parquet_path, compression="zstd", use_dictionary=False, write_statistics=True)
    metadata = {
        "schema_version": CANONICAL_SCHEMA_VERSION,
        "dataset_ref": f"mt5:{source_sha256}",
        "dataset_id": stable_uuid("canonical-dataset", source_sha256),
        "source_import_id": stable_uuid("source-import", source_sha256),
        "source": source,
        "settings": imported.get("settings"),
        "event_count": len(canonical_events),
        "storage": {"events_parquet": "events.parquet", "numeric_representation": "decimal_string"},
    }
    metadata_path = target / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {
        "dataset_ref": metadata["dataset_ref"],
        "dataset_id": metadata["dataset_id"],
        "source_import_id": metadata["source_import_id"],
        "artifacts": {"events": f"{metadata['dataset_ref']}:events", "manifest": f"{metadata['dataset_ref']}:manifest"},
        "event_count": len(canonical_events),
        "source": source,
    }


def read_dataset(workspace_root: Path, dataset_ref: str) -> dict[str, object]:
    """Load one M0 dataset only from the worker's bounded workspace."""

    prefix = "mt5:"
    if not isinstance(dataset_ref, str) or not dataset_ref.startswith(prefix):
        raise CoreError("E_DATASET_INVALID", "dataset_ref must use the mt5:<SHA256> form.")
    source_sha256 = dataset_ref.removeprefix(prefix)
    if len(source_sha256) != 64 or any(character not in "0123456789ABCDEF" for character in source_sha256):
        raise CoreError("E_DATASET_INVALID", "dataset_ref contains an invalid SHA-256 identity.")
    target = dataset_directory(workspace_root, source_sha256)
    metadata_path = target / "metadata.json"
    events_path = target / "events.parquet"
    if not metadata_path.is_file() or not events_path.is_file():
        raise CoreError("E_DATASET_NOT_FOUND", "Canonical dataset is not available in this worker workspace.", details={"dataset_ref": dataset_ref})
    try:
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for canonical Parquet storage.") from error
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    events = pq.read_table(events_path).to_pylist()
    return {"metadata": metadata, "events": events}


def _mapping(value: dict[str, object], key: str) -> dict[str, Any]:
    candidate = value.get(key)
    if not isinstance(candidate, dict):
        raise CoreError("E_INTERNAL", f"Missing internal {key} mapping.")
    return candidate


def _string(value: dict[str, Any], key: str) -> str:
    candidate = value.get(key)
    if not isinstance(candidate, str):
        raise CoreError("E_INTERNAL", f"Missing internal {key} string.")
    return candidate
