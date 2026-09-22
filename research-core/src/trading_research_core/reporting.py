"""M4 deterministic report payloads and controlled revision manifests."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from typing import Any
from uuid import UUID

from . import CORE_VERSION
from .analysis import basic_statistics, markdown_summary
from .errors import CoreError


REPORT_SCHEMA_VERSION = "1.0"
REPORT_PAYLOAD_VERSION = "m4-report-payload-1"


def prepare_report_payload(dataset: dict[str, object], *, analysis_run_id: str, report_id: str) -> dict[str, object]:
    """Return deterministic compact Markdown payload without writing a revision."""

    _require_uuid7(report_id, "report_id")
    _require_uuid(analysis_run_id, "analysis_run_id")
    statistics = basic_statistics(dataset, analysis_run_id=analysis_run_id)
    markdown = markdown_summary(statistics)
    identity = {
        "dataset_ref": statistics["dataset_ref"],
        "dataset_id": statistics["dataset_id"],
        "source_import_id": statistics["source_import_id"],
        "source_sha256": statistics["source_sha256"],
        "analysis_run_id": analysis_run_id,
        "core_version": CORE_VERSION,
        "calculation_version": statistics["calculation_version"],
        "report_payload_version": REPORT_PAYLOAD_VERSION,
    }
    return {
        **identity,
        "report_id": report_id,
        "markdown": markdown,
        "generated_block_hash": _hash_text(markdown),
        "configuration_hash": _hash_json(identity),
        "quality_state": "SOURCE_VERIFIED_BALANCE_AND_CLOSE_EVENTS",
        "availability": {"intratrade_equity": "UNAVAILABLE"},
        "warnings": ["The report payload is reproducible from the selected dataset and analysis identity."],
    }


def write_report_revision_manifest(workspace_root: Path, payload: dict[str, object], *, report_revision: int, prior_configuration_hash: str | None) -> dict[str, object]:
    """Write a versioned local manifest only after a changed report write."""

    if not isinstance(report_revision, int) or report_revision < 1:
        raise CoreError("E_REQUEST_INVALID", "report_revision must be a positive integer.")
    report_id = _required_string(payload, "report_id")
    _require_uuid7(report_id, "report_id")
    root = workspace_root.resolve()
    target = (root / "reports" / report_id / "revisions").resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Report manifest path escapes the worker workspace.") from error
    target.mkdir(parents=True, exist_ok=True)
    manifest_path = target / f"{report_revision:06d}.json"
    manifest = {
        "schema_version": REPORT_SCHEMA_VERSION,
        "report_id": report_id,
        "report_revision": report_revision,
        "prior_configuration_hash": prior_configuration_hash,
        "payload": payload,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {
        "report_id": report_id,
        "report_revision": report_revision,
        "manifest_ref": f"report:{report_id}:revision:{report_revision}",
        "manifest_sha256": _hash_file(manifest_path),
    }


def _require_uuid7(value: str, field: str) -> None:
    parsed = _require_uuid(value, field)
    if parsed.version != 7:
        raise CoreError("E_REQUEST_INVALID", f"{field} must be a UUIDv7.")


def _require_uuid(value: str, field: str) -> UUID:
    try:
        return UUID(value)
    except (ValueError, AttributeError) as error:
        raise CoreError("E_REQUEST_INVALID", f"{field} must be a UUID.") from error


def _required_string(mapping: dict[str, object], key: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value:
        raise CoreError("E_INTERNAL", f"Report payload is missing {key}.")
    return value


def _hash_text(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest().upper()


def _hash_json(value: dict[str, object]) -> str:
    return _hash_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def _hash_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()
