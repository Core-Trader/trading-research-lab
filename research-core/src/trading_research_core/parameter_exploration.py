"""Parameter exploration (PX-001–PX-007, PARAMETER_EXPLORATION_ARCHITECTURE.md).

A study joins one imported MT5 optimisation (candidate parameter sets with
MT5-reported metrics) with an optional `.set` schema (MT5-verified parameter
definitions and the default). `evaluate` applies owner-chosen objectives and
constraints through the shared Pareto layer. Descriptive only: the owner
chooses; nothing is selected or scored.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from .errors import CoreError
from .identities import stable_uuid
from .mt5_set import read_schema
from .pareto import evaluate as pareto_evaluate


STUDY_VERSION = "mvp-parameter-study-1"
EVALUATION_VERSION = "mvp-parameter-evaluation-1"

# MT5 optimisation column -> (TRL metric id, label, default direction or None, unit)
METRIC_CATALOGUE: dict[str, tuple[str, str, str | None, str]] = {
    "Profit": ("net_profit", "Net profit", "MAX", "currency"),
    "Equity DD %": ("equity_drawdown_pct", "Equity drawdown %", "MIN", "percent"),
    "Profit Factor": ("profit_factor", "Profit factor", "MAX", "ratio"),
    "Recovery Factor": ("recovery_factor", "Recovery factor", "MAX", "ratio"),
    "Expected Payoff": ("expected_payoff", "Expected payoff", "MAX", "currency per trade"),
    "Sharpe Ratio": ("mt5_sharpe", "Sharpe ratio (MT5 definition)", "MAX", "ratio"),
    "Trades": ("trades", "Trades", None, "count"),
    "Result": ("mt5_result", "Result (optimisation criterion)", None, "criterion"),
    "Custom": ("mt5_custom", "Custom criterion (EA-defined)", None, "criterion"),
}


def create_study(workspace_root: Path, optimisation_ref: str, schema_ref: str | None = None) -> dict[str, object]:
    """Assemble a study: candidates, metric catalogue, schema checks, default lookup."""

    manifest, rows = _read_optimisation(workspace_root, optimisation_ref)
    schema = read_schema(workspace_root, schema_ref) if schema_ref else None
    parameter_columns: list[str] = list(manifest["parameter_columns"])
    metrics = _metric_catalogue(manifest["metric_columns"])
    findings: list[dict[str, object]] = []
    default_signature: dict[str, str] | None = None
    default_pass_id: str | None = None
    parameters: list[dict[str, Any]] = [{"name": name, "kind": "NUMERIC" if all(_decimal(row[name]) is not None for row in rows) else "TEXT", "ordinal": None, "in_schema": None, "tested_values": _distinct(row[name] for row in rows)} for name in parameter_columns]

    if schema is not None:
        by_name = {item["name"]: item for item in schema["parameters"]}
        missing = [name for name in parameter_columns if name not in by_name]
        if missing:
            findings.append(_finding("BLOCKED", "PARAMETER_NOT_IN_SCHEMA", f"The optimisation varies {', '.join(missing)}, which the .set file does not define. Use the .set that belongs to this optimisation.", missing))
        schema_optimised = {name for name in schema["optimised_parameters"]}
        if schema_optimised != set(parameter_columns):
            findings.append(_finding("WARNING", "OPTIMISED_SET_DIFFERS", "The .set marks a different set of inputs as optimised than the optimisation varied; it may belong to another run.", sorted(schema_optimised ^ set(parameter_columns))))
        for parameter in parameters:
            definition = by_name.get(parameter["name"])
            if definition is None:
                continue
            parameter.update({"kind": definition["kind"], "ordinal": definition["ordinal"], "in_schema": True, "default": definition["value"], "start": definition["start"], "step": definition["step"], "stop": definition["stop"], "value_count": definition["value_count"]})
            off_grid = [value for value in parameter["tested_values"] if not _on_grid(value, definition)]
            if off_grid:
                findings.append(_finding("WARNING", "VALUES_OFF_SCHEMA_GRID", f"{parameter['name']}: {len(off_grid)} tested value(s) are outside the .set range/step (for example {off_grid[0]}).", [parameter["name"]]))
        if not missing:
            default_signature = {name: by_name[name]["value"] for name in parameter_columns}
            default_pass_id = next((row["trl_pass_id"] for row in rows if all(_same(row[name], default_signature[name]) for name in parameter_columns)), None)
            if default_pass_id is None:
                findings.append(_finding("NOTE", "DEFAULT_NOT_TESTED", "The .set default values were not among the optimisation passes (common with MT5 genetic optimisation). Run a single test with the default to compare it.", []))
        findings.append(_finding("NOTE", "FIXED_INPUTS_UNVERIFIABLE", "The optimisation export lists only the optimised inputs, so TRL cannot confirm that the other inputs matched this .set file.", []))
    else:
        findings.append(_finding("NOTE", "NO_SCHEMA", "No .set file: parameter ranges and the default reference point are unavailable.", []))

    identity = stable_uuid("parameter-study", optimisation_ref, schema_ref or "no-schema", STUDY_VERSION)
    study = {
        "study_ref": f"parameter-study:{identity}",
        "study_id": identity,
        "calculation_version": STUDY_VERSION,
        "optimisation_ref": optimisation_ref,
        "schema_ref": schema_ref,
        "context": {"title": manifest.get("report_metadata", {}).get("Title"), "deposit": manifest.get("report_metadata", {}).get("Deposit"), "modelling_mode": manifest.get("adapter", {}).get("modelling_mode"), "source_filename": manifest.get("source", {}).get("filename")},
        "pass_count": len(rows),
        "full_grid_size": None if schema is None else schema.get("full_grid_size"),
        "parameters": parameters,
        "metrics": metrics,
        "default": {"signature": default_signature, "pass_id": default_pass_id, "status": "NO_SCHEMA" if schema is None else "IN_OPTIMISATION" if default_pass_id else "NOT_TESTED"},
        "findings": findings,
        "status": "BLOCKED" if any(item["severity"] == "BLOCKED" for item in findings) else "READY",
    }
    target = _bounded(workspace_root.resolve(), "parameter-studies", identity)
    target.mkdir(parents=True, exist_ok=True)
    (target / "study.json").write_text(json.dumps(study, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return study


def evaluate(workspace_root: Path, study_ref: str, objectives: list[dict[str, str]], constraints: list[dict[str, str]] | None = None) -> dict[str, object]:
    """Constraint status and Pareto analysis for every candidate of a study."""

    study = _read_study(workspace_root, study_ref)
    if study["status"] != "READY":
        raise CoreError("E_STUDY_BLOCKED", "The study has blocking findings; resolve them before evaluating.", details={"findings": study["findings"]})
    constraints = constraints or []
    known = {metric["id"] for metric in study["metrics"]}
    unknown = sorted({item.get("metric") for item in [*objectives, *constraints]} - known)
    if unknown:
        raise CoreError("E_STUDY_METRIC_UNKNOWN", "Objectives and constraints must use study metrics.", details={"unknown": unknown, "available": sorted(known)})
    _, rows = _read_optimisation(workspace_root, study["optimisation_ref"])
    column_of = {metric["id"]: metric["column"] for metric in study["metrics"]}
    names = [parameter["name"] for parameter in study["parameters"]]
    candidates = [{"id": row["trl_pass_id"], "values": {metric_id: row.get(column) for metric_id, column in column_of.items()}} for row in rows]
    analysis = pareto_evaluate(candidates, objectives, constraints)
    status = {item["id"]: item for item in analysis["candidates"]}
    default_id = study["default"]["pass_id"]
    configuration = {"calculation_version": EVALUATION_VERSION, "study_ref": study_ref, "objectives": objectives, "constraints": constraints}
    configuration_hash = sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
    return {
        "evaluation_id": stable_uuid("parameter-evaluation", configuration_hash),
        "calculation_version": EVALUATION_VERSION,
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "study": {key: study[key] for key in ("study_ref", "context", "pass_count", "full_grid_size", "parameters", "metrics", "default", "findings")},
        "counts": analysis["counts"],
        "front_count": analysis["front_count"],
        "candidates": [
            {
                "id": row["trl_pass_id"],
                "pass": row.get("Pass"),
                "parameters": {name: row[name] for name in names},
                "metrics": {metric_id: row.get(column) for metric_id, column in column_of.items()},
                "is_default": row["trl_pass_id"] == default_id,
                "pareto": {key: status[row["trl_pass_id"]][key] for key in ("status", "rank", "dominated_by_count", "dominated_by_example", "violations")},
            }
            for row in rows
        ],
        "warnings": [
            "Metrics are MT5-reported for each optimisation pass; TRL does not recompute them. Equity DD % is MT5's equity drawdown.",
            "The Pareto frontier lists trade-offs no other pass beats on every chosen objective; it is not a recommendation and says nothing about future performance.",
            "Many passes over one history increase the chance that a good-looking pass is luck; check neighbouring parameters and forward results before trusting one.",
        ],
    }


def _read_optimisation(workspace_root: Path, optimisation_ref: str) -> tuple[dict[str, Any], list[dict[str, str]]]:
    source_hash = optimisation_ref.removeprefix("mt5-optimisation:")
    if not optimisation_ref.startswith("mt5-optimisation:") or len(source_hash) != 64 or any(character not in "0123456789ABCDEF" for character in source_hash):
        raise CoreError("E_REQUEST_INVALID", "Expected an mt5-optimisation:<SHA256> reference.")
    target = _bounded(workspace_root.resolve(), "optimisations", source_hash)
    manifest_path, table_path = target / "manifest.json", target / "passes.parquet"
    if not (manifest_path.is_file() and table_path.is_file()):
        raise CoreError("E_OPTIMISATION_NOT_FOUND", "The optimisation has not been imported.", details={"optimisation_ref": optimisation_ref})
    import pyarrow.parquet as pq
    return json.loads(manifest_path.read_text(encoding="utf-8")), pq.read_table(table_path).to_pylist()


def _read_study(workspace_root: Path, study_ref: str) -> dict[str, Any]:
    identity = study_ref.removeprefix("parameter-study:")
    if not study_ref.startswith("parameter-study:") or not identity:
        raise CoreError("E_REQUEST_INVALID", "Expected a parameter-study:<id> reference.")
    path = _bounded(workspace_root.resolve(), "parameter-studies", identity, "study.json")
    if not path.is_file():
        raise CoreError("E_STUDY_NOT_FOUND", "The parameter study does not exist; create it first.", details={"study_ref": study_ref})
    return json.loads(path.read_text(encoding="utf-8"))


def _metric_catalogue(columns: list[str]) -> list[dict[str, object]]:
    catalogue = []
    for column in columns:
        metric_id, label, direction, unit = METRIC_CATALOGUE.get(column, ("mt5:" + column, column, None, "unknown"))
        catalogue.append({"id": metric_id, "column": column, "label": label, "default_direction": direction, "unit": unit, "basis": "MT5_REPORTED"})
    return catalogue


def _on_grid(value: str, definition: dict[str, Any]) -> bool:
    number, start, step, stop = _decimal(value), _decimal(definition.get("start")), _decimal(definition.get("step")), _decimal(definition.get("stop"))
    if definition.get("kind") != "NUMERIC" or number is None or start is None or stop is None:
        return True
    if not start <= number <= stop:
        return False
    if step is None or step == 0:
        return number == number.to_integral_value()
    return (number - start) % step == 0


def _same(left: object, right: object) -> bool:
    a, b = _decimal(left), _decimal(right)
    return a == b if a is not None and b is not None else str(left).strip().lower() == str(right).strip().lower()


def _distinct(values: Any) -> list[str]:
    unique = {str(value) for value in values}
    return sorted(unique, key=lambda item: (_decimal(item) is None, _decimal(item) or Decimal(0), item))


def _decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    return parsed if parsed.is_finite() else None


def _finding(severity: str, code: str, message: str, subjects: list[str]) -> dict[str, object]:
    return {"severity": severity, "code": code, "message": message, "subjects": subjects}


def _bounded(root: Path, *parts: str) -> Path:
    candidate = root.joinpath(*parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Study path escapes the worker workspace.") from error
    return candidate
