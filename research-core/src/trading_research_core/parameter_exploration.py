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
EVALUATION_VERSION = "mvp-parameter-evaluation-2"

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
    singles = [item for item in _single_tests(workspace_root, study) if item["status"] == "READY"]
    forward = _forward(workspace_root, study)
    default_id = study["default"]["pass_id"] or next((item["candidate_id"] for item in singles if item["is_default"]), None)
    records = [
        {"id": row["trl_pass_id"], "pass": row.get("Pass"), "label": f"Pass {row.get('Pass')}", "source": "OPTIMISATION", "parameters": {name: row[name] for name in names}, "metrics": {metric_id: row.get(column) for metric_id, column in column_of.items()}}
        for row in rows
    ] + [
        {"id": item["candidate_id"], "pass": None, "label": f"Single test: {item['label']}", "source": "SINGLE_TEST", "parameters": item["parameters"], "metrics": {metric_id: item["metrics"].get(metric_id) for metric_id in column_of}}
        for item in singles
    ]
    analysis = pareto_evaluate([{"id": record["id"], "values": record["metrics"]} for record in records], objectives, constraints)
    status = {item["id"]: item for item in analysis["candidates"]}
    configuration = {"calculation_version": EVALUATION_VERSION, "study_ref": study_ref, "objectives": objectives, "constraints": constraints, "single_tests": sorted((item["candidate_id"], item["summary_version"]) for item in singles), "forward": None if forward is None else forward["forward_optimisation_ref"]}
    configuration_hash = sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
    default = dict(study["default"])
    if default["status"] == "NOT_TESTED" and default_id is not None:
        default["status"] = "SINGLE_TEST"
    return {
        "evaluation_id": stable_uuid("parameter-evaluation", configuration_hash),
        "calculation_version": EVALUATION_VERSION,
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "study": {**{key: study[key] for key in ("study_ref", "context", "pass_count", "full_grid_size", "parameters", "metrics", "findings")}, "default": default},
        "single_tests": [{key: item[key] for key in ("candidate_id", "label", "is_default", "findings", "notes")} for item in singles],
        "forward": None if forward is None else {key: forward[key] for key in ("forward_optimisation_ref", "forward_title", "period", "metrics", "matched_count", "in_sample_only_count", "forward_only_count", "findings")},
        "counts": analysis["counts"],
        "front_count": analysis["front_count"],
        "candidates": [
            {
                **record,
                "is_default": record["id"] == default_id,
                "forward": None if forward is None else forward["matches"].get(record["id"]),
                "pareto": {key: status[record["id"]][key] for key in ("status", "rank", "dominated_by_count", "dominated_by_example", "violations")},
            }
            for record in records
        ],
        "warnings": [
            "Metrics are MT5-reported for each optimisation pass; TRL does not recompute them. Equity DD % is MT5's equity drawdown.",
            "The Pareto frontier lists trade-offs no other pass beats on every chosen objective; it is not a recommendation and says nothing about future performance.",
            "Many passes over one history increase the chance that a good-looking pass is luck; check neighbouring parameters and forward results before trusting one.",
        ],
    }


_TITLE = __import__("re").compile(r"^(?P<expert>\S+)\s+(?P<symbol>[^,\s]+),(?P<timeframe>\S+)\s+(?P<start>\d{4}\.\d{2}\.\d{2})-(?P<end>\d{4}\.\d{2}\.\d{2})")


def add_single_test(workspace_root: Path, study_ref: str, dataset_ref: str) -> dict[str, object]:
    """Attach one imported single-test report to a study as an extra candidate.

    Its MT5 Results summary supplies the same metric ids as optimisation passes.
    The report lists every input, so fixed inputs are checked against the .set
    and the test is recognised as the default only when all inputs match it.
    """

    from .intake import get_evidence, verify_raw_snapshot
    from .mt5_report_summary import read_report_summary

    study = _read_study(workspace_root, study_ref)
    verification = verify_raw_snapshot(workspace_root, dataset_ref)
    if not verification["verified"]:
        raise CoreError("E_RAW_SNAPSHOT_MISMATCH", "The report snapshot no longer matches its recorded hash.")
    evidence = get_evidence(workspace_root, dataset_ref)
    summary = read_report_summary(Path(str(evidence["raw_snapshot_path"])))
    findings: list[dict[str, object]] = []

    title = _TITLE.match(study["context"].get("title") or "")
    if title:
        expected = {key: title.group(key) for key in ("expert", "symbol", "timeframe", "start", "end")}
        differing = [key for key, value in expected.items() if (summary.get(key) or "") != value]
        if differing:
            findings.append(_finding("BLOCKED", "CONTEXT_DIFFERS", "The single test does not match the optimisation's " + ", ".join(f"{key} ({summary.get(key)} vs {expected[key]})" for key in differing) + "; its metrics are not comparable.", differing))
    else:
        findings.append(_finding("WARNING", "CONTEXT_UNVERIFIABLE", "The optimisation title could not be read, so expert, symbol, period and dates were not compared.", []))
    deposit = (study["context"].get("deposit") or "").split(" ")[0]
    if deposit and not _same(deposit, summary.get("initial_deposit")):
        findings.append(_finding("WARNING", "DEPOSIT_DIFFERS", f"Initial deposit {summary.get('initial_deposit')} differs from the optimisation's {deposit}.", []))

    names = [parameter["name"] for parameter in study["parameters"]]
    missing = [name for name in names if name not in summary["inputs"]]
    if missing:
        findings.append(_finding("BLOCKED", "INPUT_MISSING", "The report does not list " + ", ".join(missing) + ".", missing))
    signature = {name: summary["inputs"].get(name, "") for name in names}

    fixed_differences: list[str] = []
    schema = read_schema(workspace_root, study["schema_ref"]) if study.get("schema_ref") else None
    if schema is not None:
        for definition in schema["parameters"]:
            if not definition["optimise"] and definition["name"] in summary["inputs"] and not _same(summary["inputs"][definition["name"]], definition["value"]):
                fixed_differences.append(definition["name"])
        if fixed_differences:
            findings.append(_finding("WARNING", "FIXED_INPUTS_DIFFER", f"{len(fixed_differences)} non-optimised input(s) differ from the .set file (for example {fixed_differences[0]}).", fixed_differences))
    default_signature = study["default"]["signature"]
    is_default = bool(default_signature) and not missing and not fixed_differences and all(_same(signature[name], default_signature[name]) for name in names)

    _, rows = _read_optimisation(workspace_root, study["optimisation_ref"])
    matching_pass = next((row["Pass"] for row in rows if all(_same(row[name], signature[name]) for name in names)), None)
    if matching_pass is not None:
        findings.append(_finding("NOTE", "MATCHES_PASS", f"These parameters were also tested as optimisation pass {matching_pass}; both points are shown.", []))

    attachment = {
        "dataset_ref": dataset_ref,
        "candidate_id": f"single:{dataset_ref}",
        "label": str(evidence.get("original_filename") or dataset_ref),
        "summary_version": summary["summary_version"],
        "parameters": signature,
        "metrics": summary["metrics"],
        "is_default": is_default,
        "findings": findings,
        "status": "BLOCKED" if any(item["severity"] == "BLOCKED" for item in findings) else "READY",
        "notes": summary["notes"],
    }
    target = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"], "single-tests")
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{dataset_ref.removeprefix('mt5:')}.json").write_text(json.dumps(attachment, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return attachment


def attach_forward(workspace_root: Path, study_ref: str, forward_optimisation_ref: str) -> dict[str, object]:
    """Join a forward (out-of-sample) MT5 optimisation to the study by parameter signature.

    Periods come from the MT5 titles of both exports. Overlapping periods are
    flagged: such forward metrics are not out-of-sample evidence.
    """

    from datetime import date

    study = _read_study(workspace_root, study_ref)
    manifest, forward_rows = _read_optimisation(workspace_root, forward_optimisation_ref)
    _, rows = _read_optimisation(workspace_root, study["optimisation_ref"])
    names = [parameter["name"] for parameter in study["parameters"]]
    findings: list[dict[str, object]] = []
    in_title = _TITLE.match(study["context"].get("title") or "")
    out_title = _TITLE.match(manifest.get("report_metadata", {}).get("Title") or "")
    period = None
    if in_title and out_title:
        differing = [key for key in ("expert", "symbol", "timeframe") if in_title.group(key) != out_title.group(key)]
        if differing:
            findings.append(_finding("BLOCKED", "CONTEXT_DIFFERS", "The forward export is for a different " + ", ".join(differing) + ".", differing))
        to_date = lambda text: date(*(int(part) for part in text.split(".")))
        in_start, in_end, out_start, out_end = (to_date(in_title.group("start")), to_date(in_title.group("end")), to_date(out_title.group("start")), to_date(out_title.group("end")))
        period = {"in_sample": [in_title.group("start"), in_title.group("end")], "forward": [out_title.group("start"), out_title.group("end")], "source": "MT5_TITLE"}
        if out_start <= in_end:
            findings.append(_finding("WARNING", "PERIODS_OVERLAP", f"The forward period {out_title.group('start')}–{out_title.group('end')} overlaps the in-sample period {in_title.group('start')}–{in_title.group('end')}; these forward metrics are not out-of-sample evidence.", []))
        elif (out_start - in_end).days > 1:
            findings.append(_finding("NOTE", "PERIOD_GAP", f"There is a gap between the in-sample end ({in_title.group('end')}) and the forward start ({out_title.group('start')}).", []))
        if out_end < in_start:
            findings.append(_finding("WARNING", "FORWARD_BEFORE_IN_SAMPLE", "The forward period ends before the in-sample period starts.", []))
    else:
        findings.append(_finding("WARNING", "PERIODS_UNVERIFIABLE", "The export titles could not be read, so the periods were not compared.", []))
    if set(manifest["parameter_columns"]) != set(names):
        findings.append(_finding("BLOCKED", "PARAMETERS_DIFFER", "The forward export varies different inputs than the study's optimisation.", sorted(set(manifest["parameter_columns"]) ^ set(names))))

    metrics = _metric_catalogue(manifest["metric_columns"])
    signature = lambda row: tuple(_normalised(row.get(name)) for name in names)
    forward_by_signature: dict[tuple[str, ...], dict[str, str]] = {}
    duplicates = 0
    for row in forward_rows:
        key = signature(row)
        if key in forward_by_signature:
            duplicates += 1
        forward_by_signature.setdefault(key, row)
    matched: dict[str, dict[str, object]] = {}
    for row in rows:
        forward = forward_by_signature.get(signature(row))
        if forward is not None:
            matched[row["trl_pass_id"]] = {"pass": forward.get("Pass"), "metrics": {metric["id"]: forward.get(metric["column"]) for metric in metrics}}
    if duplicates:
        findings.append(_finding("WARNING", "FORWARD_DUPLICATE_SIGNATURES", f"{duplicates} forward row(s) repeat a parameter signature; the first occurrence was used.", []))
    attachment = {
        "forward_optimisation_ref": forward_optimisation_ref,
        "forward_title": manifest.get("report_metadata", {}).get("Title"),
        "period": period,
        "metrics": metrics,
        "matched_count": len(matched),
        "in_sample_only_count": len(rows) - len(matched),
        "forward_only_count": len({signature(row) for row in forward_rows}) - len(matched),
        "matches": matched,
        "findings": findings,
        "status": "BLOCKED" if any(item["severity"] == "BLOCKED" for item in findings) else "READY",
    }
    if attachment["status"] != "READY":
        # A blocked attempt never replaces an earlier usable attachment.
        return {key: value for key, value in attachment.items() if key != "matches"}
    target = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"])
    (target / "forward.json").write_text(json.dumps(attachment, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {key: value for key, value in attachment.items() if key != "matches"}


def _forward(workspace_root: Path, study: dict[str, Any]) -> dict[str, Any] | None:
    path = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"], "forward.json")
    if not path.is_file():
        return None
    attachment = json.loads(path.read_text(encoding="utf-8"))
    return attachment if attachment["status"] == "READY" else None


def _normalised(value: object) -> str:
    number = _decimal(value)
    return format(number.normalize(), "f") if number is not None else str(value).strip().lower()


def _single_tests(workspace_root: Path, study: dict[str, Any]) -> list[dict[str, Any]]:
    folder = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"], "single-tests")
    if not folder.is_dir():
        return []
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted(folder.glob("*.json"))]


def render_choice(workspace_root: Path, study_ref: str, objectives: list[dict[str, str]], constraints: list[dict[str, str]] | None, candidate_id: str, reason: str, neighbourhood: dict[str, Any] | None = None) -> dict[str, object]:
    """Markdown recording the owner's chosen candidate, re-derived from a fresh evaluation.

    The Core re-evaluates, so the recorded status and values are authentic; the
    owner's reason is quoted verbatim. The text describes a choice, not a
    recommendation. With `neighbourhood` ({roles, radius}) the neighbourhood
    coverage and isolated-peak flag are recorded too (N7).
    """

    result = evaluate(workspace_root, study_ref, objectives, constraints)
    chosen = next((candidate for candidate in result["candidates"] if candidate["id"] == candidate_id), None)
    if chosen is None:
        raise CoreError("E_STUDY_CANDIDATE_UNKNOWN", "The chosen candidate is not part of this study.", details={"candidate_id": candidate_id})
    study = result["study"]
    labels = {metric["id"]: metric["label"] for metric in study["metrics"]}
    default = study["default"]["signature"] or {}
    reason_lines = [line.rstrip() for line in reason.strip().splitlines()] or ["(no reason given)"]
    lines = [
        "## Chosen parameter set",
        "",
        f"- Study: `{study['study_ref']}` ({study['context'].get('title') or 'MT5 optimisation'}, {study['pass_count']} passes)",
        f"- Evaluation: `{result['evaluation_id']}` ({EVALUATION_VERSION})",
        "- Objectives: " + ", ".join(f"{labels.get(item['metric'], item['metric'])} {'↑' if item['direction'] == 'MAX' else '↓'}" for item in objectives),
        "- Constraints: " + (", ".join(f"{labels.get(item['metric'], item['metric'])} {item['operator']} {item['threshold']}" for item in constraints or []) or "none"),
        f"- Candidate: {'MT5 pass ' + str(chosen['pass']) if chosen['pass'] is not None else chosen['label']} — {_status_text(chosen['pareto'])}{' — this is the default' if chosen['is_default'] else ''}",
        *_neighbourhood_lines(workspace_root, study_ref, candidate_id, objectives, neighbourhood),
        "",
        "| Parameter | Chosen | Default |",
        "| --- | --- | --- |",
        *[f"| {name} | {value} | {default.get(name, '—')} |" for name, value in chosen["parameters"].items()],
        "",
        "| Metric (MT5-reported) | Value |",
        "| --- | --- |",
        *[f"| {labels.get(metric_id, metric_id)} | {value if value is not None else '—'} |" for metric_id, value in chosen["metrics"].items()],
        "",
        "Owner's reason:",
        "",
        *[f"> {line}" for line in reason_lines],
        "",
        "_Recorded as the owner's choice among descriptive trade-offs; not a recommendation or a forecast. Metrics are historical MT5 backtest values._",
        "",
    ]
    return {"evaluation_id": result["evaluation_id"], "candidate_id": candidate_id, "markdown": "\n".join(lines)}


def _neighbourhood_lines(workspace_root: Path, study_ref: str, candidate_id: str, objectives: list[dict[str, str]], settings: dict[str, Any] | None) -> list[str]:
    if settings is None:
        return []
    from .neighbourhood import neighbourhood, summary_lines

    try:
        return summary_lines(neighbourhood(workspace_root, study_ref, candidate_id, objectives, settings.get("roles"), int(settings.get("radius", 1))))
    except CoreError as error:
        return [f"- Neighbourhood: not available ({error.message})"]


def _status_text(pareto: dict[str, Any]) -> str:
    if pareto["status"] == "PARETO":
        return "on the Pareto frontier"
    if pareto["status"] == "DOMINATED":
        return f"dominated by {pareto['dominated_by_count']} pass(es) (front {pareto['rank']})"
    if pareto["status"] == "CONSTRAINED":
        return "fails " + ", ".join(f"{item['metric']} {item['operator']} {item['threshold']}" for item in pareto["violations"])
    return "missing an objective value"


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
