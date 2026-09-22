"""M3 source-clock realised-balance analysis with explicit equity limits."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from . import CORE_VERSION
from .errors import CoreError
from .identities import stable_uuid


CALCULATION_VERSION = "m3-realised-balance-daily-drawdown-1"
TIME_BASIS = "SOURCE_REPORTED_CLOCK"
POLICY_ID = "generic-realised-balance-daily-drawdown-v1"


def validate_time_profile() -> dict[str, object]:
    """Return the M3 default without claiming the report clock is a timezone."""

    configuration = {"time_basis": TIME_BASIS, "conversion": "NONE", "calendar": "report timestamp date"}
    return {
        "time_basis": TIME_BASIS,
        "profile": None,
        "configuration_hash": _configuration_hash(configuration),
        "warnings": [
            "MT5 report timestamps are used exactly as supplied; no UTC or broker-timezone conversion was performed.",
            "Optional broker-time profiles are not implemented in the M3 basic report-supported path.",
        ],
    }


def equity_availability(dataset: dict[str, object]) -> dict[str, object]:
    """State why the input cannot support intratrade equity reconstruction."""

    metadata = _metadata(dataset)
    return {
        "dataset_ref": metadata["dataset_ref"],
        "status": "UNAVAILABLE",
        "basis": "INTRATRADE_EQUITY",
        "reason": "MT5 Deals exports provide reported balances after deal events, not timestamped floating P/L or a complete equity series.",
        "required_evidence": "Timestamped account-equity samples or an approved source providing balance plus floating P/L through time.",
        "warnings": ["No equity drawdown or prop-firm equity-loss result was calculated."],
    }


def realised_balance_daily_drawdown(dataset: dict[str, object]) -> tuple[dict[str, object], list[dict[str, object]]]:
    """Calculate report-clock daily drawdown from verified reported balances only."""

    metadata = _metadata(dataset)
    events = _events(dataset)
    days: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        timestamp = str(event.get("source_timestamp") or "")
        try:
            date_key = datetime.fromisoformat(timestamp).date().isoformat()
        except ValueError as error:
            raise CoreError("E_DATASET_INVALID", "M3 requires ISO source timestamps.", details={"source_sequence": event.get("source_sequence")}) from error
        days[date_key].append(event)
    if not days:
        raise CoreError("E_DATASET_INVALID", "Canonical dataset has no balance points.")

    ordered_days = sorted(days)
    rows: list[dict[str, object]] = []
    for index, date_key in enumerate(ordered_days):
        points = sorted(days[date_key], key=lambda event: int(event["source_sequence"]))
        reference = _decimal(points[0].get("reported_balance"))
        high_water = reference
        maximum_drawdown = Decimal("0")
        for point in points:
            balance = _decimal(point.get("reported_balance"))
            high_water = max(high_water, balance)
            maximum_drawdown = max(maximum_drawdown, high_water - balance)
        coverage = "PARTIAL_COVERAGE_AT_DATASET_EDGE" if index in {0, len(ordered_days) - 1} else "OBSERVED_DAY_POINTS"
        rows.append({
            "date": date_key,
            "time_basis": TIME_BASIS,
            "basis": "REALISED_BALANCE_ONLY",
            "daily_reference_balance": _format(reference),
            "daily_closing_balance": _format(_decimal(points[-1].get("reported_balance"))),
            "daily_high_water_balance": _format(high_water),
            "maximum_drawdown": _format(maximum_drawdown),
            "maximum_drawdown_percent": _format(maximum_drawdown / reference * Decimal("100")) if reference != 0 else None,
            "source_point_count": len(points),
            "coverage": coverage,
        })
    worst = max(rows, key=lambda row: _decimal(row["maximum_drawdown"]))
    configuration = {"policy_id": POLICY_ID, "time_basis": TIME_BASIS, "daily_reference": "first source-reported balance in report-clock date", "drawdown": "daily running realised-balance high-water decline"}
    return {
        "analysis_basis": "REALISED_BALANCE_ONLY",
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": metadata["dataset_ref"],
        "currency": _currency(metadata),
        "time_basis": TIME_BASIS,
        "policy_id": POLICY_ID,
        "configuration_hash": _configuration_hash(configuration),
        "daily_row_count": len(rows),
        "worst_day": worst,
        "warnings": [
            "Daily grouping uses the report timestamp date exactly as supplied; it is not UTC or a claimed broker timezone.",
            "Result basis is realised balance only. It is not intratrade equity drawdown or prop-firm compliance.",
            "The first and last report dates are labelled as potentially partial coverage.",
        ],
    }, rows


def write_daily_drawdown_artifact(workspace_root: Path, dataset_ref: str, result: dict[str, object], rows: list[dict[str, object]]) -> dict[str, object]:
    """Write M3 daily rows and manifest under the worker-controlled dataset path."""

    source_sha256 = _source_sha256(dataset_ref)
    analysis_id = stable_uuid("m3-analysis", dataset_ref, str(result["policy_id"]), str(result["configuration_hash"]), CORE_VERSION)
    root = workspace_root.resolve()
    target = (root / "datasets" / source_sha256 / "analysis" / analysis_id).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "M3 analysis path escapes the worker workspace.") from error
    target.mkdir(parents=True, exist_ok=True)
    parquet_path = target / "daily-realised-balance-drawdown.parquet"
    manifest_path = target / "manifest.json"
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for M3 artifact storage.") from error
    pq.write_table(pa.Table.from_pylist(rows), parquet_path, compression="zstd", use_dictionary=False, write_statistics=True)
    manifest = {
        "schema_version": "1.0",
        "analysis_id": analysis_id,
        "analysis_kind": "daily-realised-balance-drawdown",
        "dataset_ref": dataset_ref,
        "core_version": CORE_VERSION,
        "calculation_version": CALCULATION_VERSION,
        "record_count": len(rows),
        "result": result,
        "storage": {"parquet": parquet_path.name, "numeric_representation": "decimal_string"},
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {
        **result,
        "analysis_id": analysis_id,
        "artifacts": {
            "table": f"{dataset_ref}:analysis:{analysis_id}:daily-realised-balance-drawdown",
            "manifest": f"{dataset_ref}:analysis:{analysis_id}:manifest",
            "table_sha256": _file_sha256(parquet_path),
            "manifest_sha256": _file_sha256(manifest_path),
        },
    }


def _metadata(dataset: dict[str, object]) -> dict[str, Any]:
    metadata = dataset.get("metadata")
    if not isinstance(metadata, dict) or not isinstance(metadata.get("dataset_ref"), str):
        raise CoreError("E_INTERNAL", "Canonical dataset is malformed.")
    return metadata


def _events(dataset: dict[str, object]) -> list[dict[str, Any]]:
    events = dataset.get("events")
    if not isinstance(events, list):
        raise CoreError("E_INTERNAL", "Canonical dataset is malformed.")
    return sorted((event for event in events if isinstance(event, dict)), key=lambda event: int(event["source_sequence"]))


def _currency(metadata: dict[str, Any]) -> str | None:
    settings = metadata.get("settings")
    return settings.get("Currency") if isinstance(settings, dict) and isinstance(settings.get("Currency"), str) else None


def _source_sha256(dataset_ref: str) -> str:
    source_sha256 = dataset_ref.removeprefix("mt5:")
    if not dataset_ref.startswith("mt5:") or len(source_sha256) != 64 or any(character not in "0123456789ABCDEF" for character in source_sha256):
        raise CoreError("E_DATASET_INVALID", "dataset_ref contains an invalid SHA-256 identity.")
    return source_sha256


def _configuration_hash(configuration: dict[str, object]) -> str:
    return sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()


def _decimal(value: object) -> Decimal:
    return Decimal(str(value))


def _format(value: Decimal) -> str:
    return format(value, "f")


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()
