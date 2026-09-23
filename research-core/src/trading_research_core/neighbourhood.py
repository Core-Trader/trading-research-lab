"""Parameter neighbourhood analysis (PARAMETER_NEIGHBOURHOOD_SPEC.md, N1–N7).

Describes how the tested settings around one candidate behaved: coverage
first, the nearest tested settings, descriptive statistics only when enough
neighbours were tested, an isolated-peak flag with its numbers, and a 2-D
slice. Also renders a targeted neighbourhood `.set` for a full-grid MT5 run
and attaches that run's results. Nothing is scored or selected, and TRL never
runs backtests.
"""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal
from hashlib import sha256
from itertools import product
import json
from pathlib import Path
from typing import Any

from .errors import CoreError
from .identities import stable_uuid
from .mt5_set import read_schema
from .parameter_exploration import (
    _TITLE,
    _bounded,
    _decimal,
    _finding,
    _forward,
    _metric_catalogue,
    _normalised,
    _read_optimisation,
    _read_study,
    _single_tests,
)


NEIGHBOURHOOD_VERSION = "mvp-parameter-neighbourhood-1"
NEIGHBOURHOOD_SET_VERSION = "neighbourhood-set-1"
ROLES = ("ORDINAL", "CATEGORICAL", "HELD_FIXED")
MIN_TESTED = 4
MAX_RADIUS = 2
NEAREST_LIMIT = 5
MAX_SLICE_CELLS = 2500
MAX_SET_RUNS = 100_000
_STEP = Decimal("0.00000001")


def neighbourhood(workspace_root: Path, study_ref: str, candidate_id: str, objectives: list[dict[str, str]], roles: dict[str, str] | None = None, radius: int = 1, slice_axes: list[str] | None = None, slice_metric: str | None = None) -> dict[str, object]:
    """Neighbourhood of one candidate: coverage, nearest tested, statistics, flag, slice."""

    study = _ready_study(workspace_root, study_ref)
    grid = _grid(study, roles, radius)
    metric_ids = [metric["id"] for metric in study["metrics"]]
    unknown = sorted({item.get("metric") for item in objectives} - set(metric_ids))
    if not objectives or unknown:
        raise CoreError("E_STUDY_METRIC_UNKNOWN", "Objectives must use study metrics.", details={"unknown": unknown})
    pool, sources = _pool(workspace_root, study)
    by_id = {point["id"]: point for point in pool}
    candidate = by_id.get(candidate_id)
    if candidate is None:
        raise CoreError("E_STUDY_CANDIDATE_UNKNOWN", "The candidate is not part of this study.", details={"candidate_id": candidate_id})
    position = _position(grid, candidate["parameters"])
    if position is None:
        raise CoreError("E_NEIGHBOURHOOD_OFF_GRID", "The candidate's ordinal values are not on the .set grid, so it has no defined neighbours.")
    fixed = _fixed_signature(grid, candidate["parameters"])
    by_signature: dict[tuple[str, ...], dict[str, Any]] = {}
    for point in pool:
        by_signature.setdefault(_signature(grid, point["parameters"]), point)

    possible = _box(grid, position, radius)
    tested = []
    for offsets in possible:
        point = by_signature.get(_signature_at(grid, offsets, fixed))
        if point is not None and point["id"] != candidate_id:
            tested.append((max(abs(value - base) for value, base in zip(offsets, position)), offsets, point))
    tested.sort(key=lambda item: (item[0], item[1]))  # distance, then grid position (numeric, stable)
    sufficient = len(tested) >= MIN_TESTED
    forward = _forward(workspace_root, study)
    matches = forward["matches"] if forward else {}

    def describe(distance: int, point: dict[str, Any]) -> dict[str, object]:
        differs = {name: point["parameters"][name] for name in grid["names"] if _normalised(point["parameters"].get(name)) != _normalised(candidate["parameters"].get(name))}
        return {"id": point["id"], "label": point["label"], "source": point["source"], "distance": distance, "differs": differs, "metrics": point["metrics"], "forward": matches.get(point["id"])}

    nearest = []
    for point in pool:
        if point["id"] == candidate_id or _fixed_signature(grid, point["parameters"]) != fixed:
            continue
        other = _position(grid, point["parameters"])
        if other is not None:
            nearest.append((max(abs(a - b) for a, b in zip(other, position)), other, point))
    nearest.sort(key=lambda item: (item[0], item[1]))

    statistics = None
    isolated = None
    context = None
    if sufficient:
        statistics = {}
        margins = []
        for objective in objectives:
            metric, direction = objective["metric"], objective["direction"]
            values = sorted(value for value in (_decimal(point["metrics"].get(metric)) for _, _, point in tested) if value is not None)
            own = _decimal(candidate["metrics"].get(metric))
            if not values:
                statistics[metric] = {"direction": direction, "count": 0}
                margins.append(None)
                continue
            q1, median, q3 = _quantile(values, Decimal("0.25")), _quantile(values, Decimal("0.5")), _quantile(values, Decimal("0.75"))
            iqr = q3 - q1
            worse = None if own is None else sum(1 for value in values if (value < own if direction == "MAX" else value > own))
            best = values[-1] if direction == "MAX" else values[0]
            margin = None if own is None else (own - best if direction == "MAX" else best - own)
            statistics[metric] = {
                "direction": direction, "count": len(values), "median": _q(median), "q1": _q(q1), "q3": _q(q3), "iqr": _q(iqr),
                "candidate_value": None if own is None else _fmt(own), "candidate_better_than": worse,
                "best_neighbour": _fmt(best), "margin_over_best": None if margin is None else _fmt(margin),
            }
            margins.append(None if margin is None else (margin, iqr))
        assessable = all(item is not None for item in margins)
        isolated = {
            "assessed": assessable,
            "flag": assessable and all(item[0] > item[1] for item in margins if item is not None),
            "rule": "Better than every tested neighbour by more than the neighbours' interquartile range, on every objective.",
        }
        profits = [_decimal(point["metrics"].get("net_profit")) for _, _, point in tested]
        present = [value for value in profits if value is not None]
        drawdowns = [value for value in (_decimal(point["metrics"].get("equity_drawdown_pct")) for _, _, point in tested) if value is not None]
        context = {
            "profit_positive_share": None if not present else _q(Decimal(sum(1 for value in present if value > 0)) / Decimal(len(present))),
            "worst_equity_drawdown_pct": None if not drawdowns else _fmt(max(drawdowns)),
        }

    configuration = {
        "calculation_version": NEIGHBOURHOOD_VERSION, "study_ref": study_ref, "candidate_id": candidate_id, "objectives": objectives,
        "roles": grid["roles"], "radius": radius, "slice_axes": slice_axes, "slice_metric": slice_metric,
        "attached_runs": sorted(sources["runs"]), "single_tests": sorted(sources["singles"]), "forward": None if forward is None else forward["forward_optimisation_ref"],
    }
    configuration_hash = sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
    held = [name for name, role in grid["roles"].items() if role != "ORDINAL"]
    return {
        "neighbourhood_id": stable_uuid("parameter-neighbourhood", configuration_hash),
        "calculation_version": NEIGHBOURHOOD_VERSION,
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "candidate": {key: candidate[key] for key in ("id", "label", "source", "parameters", "metrics")},
        "roles": grid["roles"],
        "radius": radius,
        "coverage": {
            "possible": len(possible), "tested": len(tested), "minimum_for_statistics": MIN_TESTED, "sufficient": sufficient,
            "by_source": {source: sum(1 for _, _, point in tested if point["source"] == source) for source in ("OPTIMISATION", "SINGLE_TEST", "NEIGHBOURHOOD_RUN")},
            "held_equal": held,
        },
        "boundaries": [{"name": name, "steps_below": index, "steps_above": last - index} for name, index, last in zip(grid["ordinal"], position, grid["last"])],
        "neighbours": [describe(distance, point) for distance, _, point in tested],
        "nearest": [describe(distance, point) for distance, _, point in nearest[:NEAREST_LIMIT]],
        "statistics": statistics,
        "context": context,
        "isolated_peak": isolated,
        "slice": _slice(grid, position, fixed, by_signature, candidate_id, slice_axes, slice_metric or objectives[0]["metric"], metric_ids),
        "warnings": [
            "Neighbours are other tested settings within the chosen number of .set steps; untested settings are unknown, not bad.",
            "Statistics are descriptive; a plateau in the past does not guarantee future results.",
        ],
    }


def render_neighbourhood_set(workspace_root: Path, study_ref: str, candidate_id: str, roles: dict[str, str] | None = None, radius: int = 1) -> dict[str, object]:
    """The `.set` text covering the candidate's neighbourhood box, for a full-grid MT5 run."""

    study = _ready_study(workspace_root, study_ref)
    grid = _grid(study, roles, radius)
    pool, _ = _pool(workspace_root, study)
    candidate = next((point for point in pool if point["id"] == candidate_id), None)
    if candidate is None:
        raise CoreError("E_STUDY_CANDIDATE_UNKNOWN", "The candidate is not part of this study.", details={"candidate_id": candidate_id})
    position = _position(grid, candidate["parameters"])
    if position is None:
        raise CoreError("E_NEIGHBOURHOOD_OFF_GRID", "The candidate's ordinal values are not on the .set grid.")
    schema = read_schema(workspace_root, study["schema_ref"])
    varied: dict[str, dict[str, str]] = {}
    runs = 1
    for name, index, last in zip(grid["ordinal"], position, grid["last"]):
        low, high = max(0, index - radius), min(last, index + radius)
        start, step = grid["start"][name], grid["step"][name]
        varied[name] = {"start": _grid_text(start + step * low, step), "step": _fmt(step), "stop": _grid_text(start + step * high, step)}
        runs *= high - low + 1
    if runs > MAX_SET_RUNS:
        raise CoreError("E_NEIGHBOURHOOD_TOO_LARGE", "The neighbourhood box is too large for a targeted run.", details={"runs": runs})
    fixed = {name: str(candidate["parameters"][name]).strip() for name in grid["names"] if name not in varied}
    lines = [f"; Trading Research Lab neighbourhood run ({NEIGHBOURHOOD_SET_VERSION}): +/-{radius} step(s) around {candidate['label']}.", "; Run in MT5 with the 'Slow complete algorithm' on the same symbol, timeframe, dates, deposit and modelling mode."]
    for definition in schema["parameters"]:
        name = definition["name"]
        if name in varied:
            box = varied[name]
            lines.append(f"{name}={str(candidate['parameters'][name]).strip()}||{box['start']}||{box['step']}||{box['stop']}||Y")
        elif definition["start"] is None:
            lines.append(f"{name}={fixed.get(name, definition['value'])}")
        else:
            lines.append(f"{name}={fixed.get(name, definition['value'])}||{definition['start']}||{definition['step']}||{definition['stop']}||N")
    text = "\r\n".join(lines) + "\r\n"
    box = {"set_version": NEIGHBOURHOOD_SET_VERSION, "study_ref": study_ref, "candidate_id": candidate_id, "radius": radius, "roles": grid["roles"], "varied": varied, "fixed": fixed, "runs": runs}
    box_id = stable_uuid("neighbourhood-set", json.dumps(box, sort_keys=True))
    title = _TITLE.match(study["context"].get("title") or "")
    expert = title.group("expert") if title else "EA"
    return {**box, "box_id": box_id, "set_text": text, "suggested_filename": f"{expert}_neighbourhood_{_slug(candidate['label'])}_r{radius}.set"}


def write_neighbourhood_set(workspace_root: Path, study_ref: str, candidate_id: str, target_path: str, roles: dict[str, str] | None = None, radius: int = 1) -> dict[str, object]:
    """Write the neighbourhood `.set` (UTF-16 LE with BOM, as MT5 writes) to a new file only."""

    rendered = render_neighbourhood_set(workspace_root, study_ref, candidate_id, roles, radius)
    target = Path(target_path).expanduser()
    if target.suffix.lower() != ".set":
        raise CoreError("E_SET_TARGET_INVALID", "The file name must end in .set.")
    if not target.parent.is_dir():
        raise CoreError("E_SET_TARGET_INVALID", "The target folder does not exist.")
    data = b"\xff\xfe" + str(rendered["set_text"]).encode("utf-16-le")
    try:
        with open(target, "xb") as handle:  # never overwrite an existing file
            handle.write(data)
    except FileExistsError as error:
        raise CoreError("E_SET_TARGET_EXISTS", "A file with that name already exists; TRL never overwrites files.", details={"path": str(target)}) from error
    study = _read_study(workspace_root, study_ref)
    record = {key: rendered[key] for key in ("set_version", "study_ref", "candidate_id", "radius", "roles", "varied", "fixed", "runs", "box_id")} | {"sha256": sha256(data).hexdigest().upper(), "filename": target.name}
    folder = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"], "neighbourhood-sets")
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{rendered['box_id']}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {**record, "path": str(target.resolve()), "bytes": len(data)}


def attach_neighbourhood_run(workspace_root: Path, study_ref: str, optimisation_ref: str) -> dict[str, object]:
    """Join a full-grid MT5 run of a written neighbourhood `.set` to the study.

    The run must match the study's EA, symbol, timeframe and dates, and one
    recorded neighbourhood box (its varied inputs and ranges). The held inputs
    come from that box, because MT5 exports only the varied inputs.
    """

    study = _ready_study(workspace_root, study_ref)
    manifest, rows = _read_optimisation(workspace_root, optimisation_ref)
    findings: list[dict[str, object]] = []
    in_title = _TITLE.match(study["context"].get("title") or "")
    run_title = _TITLE.match(manifest.get("report_metadata", {}).get("Title") or "")
    if in_title and run_title:
        differing = [key for key in ("expert", "symbol", "timeframe", "start", "end") if in_title.group(key) != run_title.group(key)]
        if differing:
            findings.append(_finding("BLOCKED", "CONTEXT_DIFFERS", "The run differs from the study in " + ", ".join(differing) + "; neighbours must be tested on the same EA, market and dates.", differing))
    else:
        findings.append(_finding("WARNING", "CONTEXT_UNVERIFIABLE", "The export titles could not be read, so EA, market and dates were not compared.", []))
    columns = set(manifest["parameter_columns"])
    boxes = [box for box in _boxes(workspace_root, study) if set(box["varied"]) == columns and all(_in_box(row, box) for row in rows)]
    box = None
    if not boxes:
        findings.append(_finding("BLOCKED", "NO_MATCHING_NEIGHBOURHOOD_SET", "No neighbourhood .set written by TRL for this study matches the run's varied inputs and ranges.", sorted(columns)))
    elif len(boxes) > 1:
        boxes.sort(key=lambda item: item["runs"])
        if boxes[0]["runs"] == boxes[1]["runs"]:
            findings.append(_finding("BLOCKED", "AMBIGUOUS_NEIGHBOURHOOD_SET", "More than one neighbourhood .set matches this run equally.", []))
        else:
            box = boxes[0]
    else:
        box = boxes[0]
    metrics = _metric_catalogue(manifest["metric_columns"])
    names = [parameter["name"] for parameter in study["parameters"]]
    points = []
    if box is not None:
        for row in rows:
            parameters = {name: (row[name] if name in columns else box["fixed"][name]) for name in names}
            points.append({"id": row["trl_pass_id"], "pass": row.get("Pass"), "parameters": parameters, "metrics": {metric["id"]: row.get(metric["column"]) for metric in metrics}})
        if len(rows) < box["runs"]:
            findings.append(_finding("NOTE", "RUN_INCOMPLETE", f"The run has {len(rows)} of the {box['runs']} settings in the neighbourhood .set (a full-grid run should have all).", []))
        _, study_rows = _read_optimisation(workspace_root, study["optimisation_ref"])
        study_metrics = {metric["id"]: metric["column"] for metric in study["metrics"]}
        by_signature = {tuple(_normalised(row[name]) for name in names): row for row in study_rows}
        differing_results = 0
        for point in points:
            existing = by_signature.get(tuple(_normalised(point["parameters"][name]) for name in names))
            if existing is not None and any(_decimal(existing.get(column)) != _decimal(point["metrics"].get(metric_id)) for metric_id, column in study_metrics.items() if metric_id in point["metrics"]):
                differing_results += 1
        if differing_results:
            findings.append(_finding("WARNING", "RESULTS_DIFFER_FROM_STUDY", f"{differing_results} setting(s) also in the study show different results; the study's pass is used for them.", []))
    attachment = {
        "optimisation_ref": optimisation_ref,
        "box_id": None if box is None else box["box_id"],
        "candidate_id": None if box is None else box["candidate_id"],
        "run_count": len(rows),
        "points": points,
        "findings": findings,
        "status": "BLOCKED" if any(item["severity"] == "BLOCKED" for item in findings) else "READY",
    }
    if attachment["status"] == "READY":
        folder = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"], "neighbourhood-runs")
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{optimisation_ref.removeprefix('mt5-optimisation:')}.json").write_text(json.dumps(attachment, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {key: value for key, value in attachment.items() if key != "points"}


def summary_lines(result: dict[str, Any]) -> list[str]:
    """Markdown lines for the recorded choice block (N7)."""

    coverage = result["coverage"]
    held = ", ".join(coverage["held_equal"]) or "none"
    flag = result["isolated_peak"]
    peak = "not assessed (too few tested neighbours)" if flag is None else ("yes" if flag["flag"] else "no") if flag["assessed"] else "not assessed (a value is missing)"
    return [
        f"- Neighbourhood (±{result['radius']} step(s); held equal: {held}): {coverage['tested']} of {coverage['possible']} neighbouring settings tested; statistics {'shown' if coverage['sufficient'] else 'not shown (fewer than ' + str(coverage['minimum_for_statistics']) + ')'}; isolated peak: {peak}",
        f"- Neighbourhood configuration: `{result['configuration_hash'][:16]}` ({result['calculation_version']})",
    ]


def _ready_study(workspace_root: Path, study_ref: str) -> dict[str, Any]:
    study = _read_study(workspace_root, study_ref)
    if study["status"] != "READY":
        raise CoreError("E_STUDY_BLOCKED", "The study has blocking findings.")
    if not study.get("schema_ref"):
        raise CoreError("E_NEIGHBOURHOOD_NO_SCHEMA", "Neighbourhoods need the .set file (its ranges and steps define the grid).")
    return study


def _grid(study: dict[str, Any], roles: dict[str, str] | None, radius: int) -> dict[str, Any]:
    if not isinstance(radius, int) or isinstance(radius, bool) or not 1 <= radius <= MAX_RADIUS:
        raise CoreError("E_NEIGHBOURHOOD_CONFIG_INVALID", f"radius must be 1 to {MAX_RADIUS} steps.")
    parameters = {parameter["name"]: parameter for parameter in study["parameters"]}
    roles = dict(roles or {})
    unknown = sorted(set(roles) - set(parameters))
    if unknown or any(role not in ROLES for role in roles.values()):
        raise CoreError("E_NEIGHBOURHOOD_CONFIG_INVALID", "Roles must name study parameters and be ORDINAL, CATEGORICAL or HELD_FIXED.", details={"unknown": unknown})
    resolved: dict[str, str] = {}
    for name, parameter in parameters.items():
        steppable = bool(parameter.get("ordinal")) and (_decimal(parameter.get("step")) or 0) > 0
        role = roles.get(name, "ORDINAL" if steppable else "CATEGORICAL")
        if role == "ORDINAL" and not steppable:
            raise CoreError("E_NEIGHBOURHOOD_CONFIG_INVALID", f"{name} has no .set step, so it cannot be ordinal.", details={"parameter": name})
        resolved[name] = role
    ordinal = [name for name, role in resolved.items() if role == "ORDINAL"]
    if not ordinal:
        raise CoreError("E_NEIGHBOURHOOD_CONFIG_INVALID", "At least one parameter must be ordinal to define neighbours.")
    start = {name: _decimal(parameters[name]["start"]) for name in ordinal}
    step = {name: _decimal(parameters[name]["step"]) for name in ordinal}
    last = [int((_decimal(parameters[name]["stop"]) - start[name]) / step[name]) for name in ordinal]  # type: ignore[operator]
    return {"names": list(parameters), "roles": resolved, "ordinal": ordinal, "start": start, "step": step, "last": last}


def _position(grid: dict[str, Any], parameters: dict[str, Any]) -> tuple[int, ...] | None:
    indices = []
    for name, last in zip(grid["ordinal"], grid["last"]):
        value = _decimal(parameters.get(name))
        if value is None:
            return None
        offset = (value - grid["start"][name]) / grid["step"][name]
        if offset != offset.to_integral_value() or not 0 <= offset <= last:
            return None
        indices.append(int(offset))
    return tuple(indices)


def _fixed_signature(grid: dict[str, Any], parameters: dict[str, Any]) -> tuple[str, ...]:
    return tuple(_normalised(parameters.get(name)) for name in grid["names"] if grid["roles"][name] != "ORDINAL")


def _signature(grid: dict[str, Any], parameters: dict[str, Any]) -> tuple[str, ...]:
    return tuple(_normalised(parameters.get(name)) for name in grid["names"])


def _signature_at(grid: dict[str, Any], offsets: tuple[int, ...], fixed: tuple[str, ...]) -> tuple[str, ...]:
    ordinal = {name: _normalised(grid["start"][name] + grid["step"][name] * index) for name, index in zip(grid["ordinal"], offsets)}
    held = iter(fixed)
    return tuple(ordinal[name] if name in ordinal else next(held) for name in grid["names"])


def _box(grid: dict[str, Any], position: tuple[int, ...], radius: int) -> list[tuple[int, ...]]:
    ranges = [range(max(0, index - radius), min(last, index + radius) + 1) for index, last in zip(position, grid["last"])]
    return [offsets for offsets in product(*ranges) if offsets != position]


def _pool(workspace_root: Path, study: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Every tested setting: optimisation passes, READY single tests, READY neighbourhood runs."""

    names = [parameter["name"] for parameter in study["parameters"]]
    column_of = {metric["id"]: metric["column"] for metric in study["metrics"]}
    _, rows = _read_optimisation(workspace_root, study["optimisation_ref"])
    pool = [{"id": row["trl_pass_id"], "label": f"Pass {row.get('Pass')}", "source": "OPTIMISATION", "parameters": {name: row[name] for name in names}, "metrics": {metric_id: row.get(column) for metric_id, column in column_of.items()}} for row in rows]
    singles = [item for item in _single_tests(workspace_root, study) if item["status"] == "READY"]
    pool += [{"id": item["candidate_id"], "label": f"Single test: {item['label']}", "source": "SINGLE_TEST", "parameters": item["parameters"], "metrics": {metric_id: item["metrics"].get(metric_id) for metric_id in column_of}} for item in singles]
    runs = []
    folder = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"], "neighbourhood-runs")
    if folder.is_dir():
        for path in sorted(folder.glob("*.json")):
            run = json.loads(path.read_text(encoding="utf-8"))
            runs.append(run["optimisation_ref"])
            pool += [{"id": point["id"], "label": f"Neighbourhood run pass {point['pass']}", "source": "NEIGHBOURHOOD_RUN", "parameters": point["parameters"], "metrics": {metric_id: point["metrics"].get(metric_id) for metric_id in column_of}} for point in run["points"]]
    return pool, {"singles": [item["candidate_id"] for item in singles], "runs": runs}


def _slice(grid: dict[str, Any], position: tuple[int, ...], fixed: tuple[str, ...], by_signature: dict[tuple[str, ...], dict[str, Any]], candidate_id: str, axes: list[str] | None, metric: str, metric_ids: list[str]) -> dict[str, object] | None:
    ordinal = grid["ordinal"]
    if axes is None:
        if len(ordinal) < 2:
            return None
        # Default: the two ordinal inputs with the fewest grid values (a readable map), in study order.
        smallest = sorted(range(len(ordinal)), key=lambda index: (grid["last"][index], index))[:2]
        axes = [ordinal[index] for index in sorted(smallest)]
    if len(axes) != 2 or axes[0] == axes[1] or any(axis not in ordinal for axis in axes):
        raise CoreError("E_NEIGHBOURHOOD_CONFIG_INVALID", "The slice needs two different ordinal parameters.", details={"axes": axes})
    if metric not in metric_ids:
        raise CoreError("E_STUDY_METRIC_UNKNOWN", "The slice metric is not a study metric.", details={"metric": metric})
    x_index, y_index = ordinal.index(axes[0]), ordinal.index(axes[1])

    def window(index: int) -> range:
        last, own = grid["last"][index], position[index]
        span = max(1, int((MAX_SLICE_CELLS ** 0.5) // 2))
        return range(0, last + 1) if (grid["last"][x_index] + 1) * (grid["last"][y_index] + 1) <= MAX_SLICE_CELLS else range(max(0, own - span), min(last, own + span) + 1)

    xs, ys = window(x_index), window(y_index)
    cells = []
    for y in ys:
        row = []
        for x in xs:
            offsets = list(position)
            offsets[x_index], offsets[y_index] = x, y
            point = by_signature.get(_signature_at(grid, tuple(offsets), fixed))
            row.append({"value": None if point is None else point["metrics"].get(metric), "tested": point is not None, "id": None if point is None else point["id"], "is_candidate": tuple(offsets) == position})
        cells.append(row)
    value = lambda axis, index: _normalised(grid["start"][axis] + grid["step"][axis] * index)
    return {"axes": axes, "metric": metric, "x_values": [value(axes[0], x) for x in xs], "y_values": [value(axes[1], y) for y in ys], "cells": cells, "windowed": len(xs) <= grid["last"][x_index] or len(ys) <= grid["last"][y_index]}


def _boxes(workspace_root: Path, study: dict[str, Any]) -> list[dict[str, Any]]:
    folder = _bounded(workspace_root.resolve(), "parameter-studies", study["study_id"], "neighbourhood-sets")
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted(folder.glob("*.json"))] if folder.is_dir() else []


def _in_box(row: dict[str, Any], box: dict[str, Any]) -> bool:
    for name, limits in box["varied"].items():
        value, start, step, stop = _decimal(row.get(name)), Decimal(limits["start"]), Decimal(limits["step"]), Decimal(limits["stop"])
        if value is None or not start <= value <= stop or (value - start) % step != 0:
            return False
    return True


def _quantile(values: list[Decimal], fraction: Decimal) -> Decimal:
    """Linear interpolation between order statistics (Hyndman–Fan type 7; Excel QUARTILE.INC)."""

    if len(values) == 1:
        return values[0]
    position = fraction * (len(values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(values) - 1)
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def _grid_text(value: Decimal, step: Decimal) -> str:
    exponent = step.normalize().as_tuple().exponent
    return format(value.quantize(Decimal(1).scaleb(min(0, exponent))), "f") if isinstance(exponent, int) else format(value, "f")


def _slug(text: str) -> str:
    return "".join(character if character.isalnum() else "_" for character in text).strip("_").lower() or "candidate"


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN).normalize(), "f")


def _fmt(value: Decimal) -> str:
    return format(value.normalize(), "f")
