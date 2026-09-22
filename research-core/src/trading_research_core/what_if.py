"""M6 deterministic What-If scenarios over qualified M2 close-event facts."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from . import CORE_VERSION
from .dataset_store import read_dataset
from .errors import CoreError
from .identities import stable_uuid
from .trade_analysis import close_event_summary, write_trade_artifact


POLICY_ID = "what-if-fixed-close-event-cost-v1"
CALCULATION_VERSION = "m6-what-if-fixed-close-event-cost-1"


def fixed_close_event_cost_scenario(
    workspace_root: Path,
    dataset_ref: str,
    additional_cost_per_close_event: str,
) -> dict[str, object]:
    """Apply an explicit fixed cost to each verified close event only.

    The source M2 close-event artifact is deterministically created/reused first,
    then a distinct M6 scenario artifact is written. Neither artifact mutates
    source snapshots or canonical events.
    """

    cost = _non_negative_decimal(additional_cost_per_close_event)
    dataset = read_dataset(workspace_root, dataset_ref)
    source_result, source_rows = close_event_summary(dataset)
    currency = source_result.get("currency")
    if not isinstance(currency, str) or not currency.strip():
        raise CoreError("E_SCENARIO_INPUT_INVALID", "M6 fixed-cost scenarios require a source currency.")
    if not source_rows:
        raise CoreError("E_SCENARIO_INPUT_INVALID", "M6 fixed-cost scenarios require at least one verified close event.")

    source_artifact = write_trade_artifact(workspace_root, dataset_ref, "close-events", source_result, source_rows)
    configuration = {
        "policy_id": POLICY_ID,
        "input_artifact": source_artifact["artifacts"]["table"],
        "input_artifact_sha256": source_artifact["artifacts"]["table_sha256"],
        "input_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "currency": currency,
        "additional_cost_per_close_event": _format(cost),
        "rounding": "preserve source Decimal precision; no implicit currency rounding",
        "event_selection": "all eligible verified close events in recorded source order",
    }
    configuration_hash = _configuration_hash(configuration)
    rows = [
        {
            "source_sequence": int(row["source_sequence"]),
            "source_deal_id": str(row["source_deal_id"]),
            "timestamp": str(row["timestamp"]),
            "source_quality": "MT5_VERIFIED",
            "source_net_pnl": str(row["net_pnl"]),
            "additional_cost": _format(cost),
            "scenario_net_pnl": _format(_decimal(row["net_pnl"]) - cost),
        }
        for row in source_rows
    ]
    source_metrics = _metrics([_decimal(row["net_pnl"]) for row in source_rows])
    scenario_metrics = _metrics([_decimal(row["scenario_net_pnl"]) for row in rows])
    analysis_id = stable_uuid("m6-what-if", dataset_ref, POLICY_ID, configuration_hash, CORE_VERSION)
    root = workspace_root.resolve()
    source_sha256 = _source_sha256(dataset_ref)
    target = (root / "datasets" / source_sha256 / "analysis" / analysis_id).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "M6 scenario path escapes the worker workspace.") from error
    target.mkdir(parents=True, exist_ok=True)
    parquet_path = target / "fixed-close-event-cost.parquet"
    manifest_path = target / "manifest.json"
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for M6 scenario storage.") from error
    pq.write_table(pa.Table.from_pylist(rows), parquet_path, compression="zstd", use_dictionary=False, write_statistics=True)
    result = {
        "analysis_id": analysis_id,
        "analysis_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "policy_id": POLICY_ID,
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": dataset_ref,
        "currency": currency,
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "source_summary": source_metrics,
        "scenario_summary": scenario_metrics,
        "net_pnl_delta": _format(_decimal(scenario_metrics["net_pnl"]) - _decimal(source_metrics["net_pnl"])),
        "warnings": [
            "Additional cost is a USER_SUPPLIED analytical assumption, not verified broker data.",
            "Scenario output is a historical close-event sensitivity result, not a forecast, execution model, or trading recommendation.",
            "No balance curve, drawdown, equity, position sizing, margin, prop-firm, or currency-conversion result was calculated.",
        ],
    }
    manifest = {
        "schema_version": "1.0",
        "analysis_kind": "what-if-fixed-close-event-cost",
        "analysis_id": analysis_id,
        "dataset_ref": dataset_ref,
        "input_artifact": source_artifact["artifacts"],
        "core_version": CORE_VERSION,
        "calculation_version": CALCULATION_VERSION,
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "record_count": len(rows),
        "result": result,
        "storage": {"parquet": parquet_path.name, "numeric_representation": "decimal_string"},
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {
        **result,
        "artifacts": {
            "table": f"{dataset_ref}:analysis:{analysis_id}:fixed-close-event-cost",
            "manifest": f"{dataset_ref}:analysis:{analysis_id}:manifest",
            "table_sha256": _sha256_file(parquet_path),
            "manifest_sha256": _sha256_file(manifest_path),
        },
    }


def _non_negative_decimal(value: str) -> Decimal:
    try:
        parsed = Decimal(value.strip())
    except (AttributeError, InvalidOperation) as error:
        raise CoreError("E_SCENARIO_CONFIG_INVALID", "additional_cost_per_close_event must be a non-negative Decimal string.") from error
    if not parsed.is_finite() or parsed < 0:
        raise CoreError("E_SCENARIO_CONFIG_INVALID", "additional_cost_per_close_event must be a non-negative finite Decimal string.")
    return parsed


def _metrics(values: list[Decimal]) -> dict[str, object]:
    wins = sum(value > 0 for value in values)
    losses = sum(value < 0 for value in values)
    return {
        "count": len(values),
        "net_pnl": _format(sum(values, Decimal("0"))),
        "gross_profit": _format(sum((value for value in values if value > 0), Decimal("0"))),
        "gross_loss": _format(sum((value for value in values if value < 0), Decimal("0"))),
        "win_count": wins,
        "loss_count": losses,
        "breakeven_count": len(values) - wins - losses,
    }


def _source_sha256(dataset_ref: str) -> str:
    value = dataset_ref.removeprefix("mt5:")
    if not dataset_ref.startswith("mt5:") or len(value) != 64 or any(character not in "0123456789ABCDEF" for character in value):
        raise CoreError("E_DATASET_INVALID", "dataset_ref contains an invalid SHA-256 identity.")
    return value


def _configuration_hash(configuration: dict[str, object]) -> str:
    canonical = json.dumps(configuration, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(canonical.encode("utf-8")).hexdigest().upper()


def _decimal(value: object) -> Decimal:
    return Decimal(str(value))


def _format(value: Decimal) -> str:
    return format(value, "f")


def _sha256_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()
