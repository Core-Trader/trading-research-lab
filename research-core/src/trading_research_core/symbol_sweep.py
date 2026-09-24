"""MT5 symbol sweeps ("All symbols selected in Market Watch"), SYMBOL_SWEEP_SPEC.md S1–S9.

A sweep runs one EA with fixed inputs once per symbol. The export is an MT5
"Tester Optimizator Results" table whose first column is Symbol and that has
no input columns. TRL keeps every metric exactly as MT5 reported it, never
ranks symbols, and never treats a sweep row as trades (S8): drawdown curves,
prop checks and Monte Carlo need the per-symbol single-test reports.
"""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET

from .errors import CoreError
from .identities import stable_uuid
from .mt5_optimisation import MT5_STATISTIC_COLUMNS, NAMESPACE, _atomic_json, _bounded, _cell_text, _ensure_snapshot
from .parameter_exploration import METRIC_CATALOGUE, _TITLE
from .pareto import evaluate as pareto_evaluate


ADAPTER_VERSION = "mt5-symbol-sweep-1"
FOLDER = "symbol-sweeps"
MAX_COMPARE = 6  # S9: readable columns and distinguishable colours; a design choice, not a sourced number
DEFAULT_OBJECTIVES = [{"metric": "net_profit", "direction": "MAX"}, {"metric": "equity_drawdown_pct", "direction": "MIN"}]
_NS = {"ss": NAMESPACE, "office": "urn:schemas-microsoft-com:office:office"}


def intake_symbol_sweep(workspace_root: Path, source_path: str, modelling_mode: str, set_path: str | None = None) -> dict[str, object]:
    """Snapshot and parse one sweep export; importing the same file again returns the existing record."""

    root = workspace_root.resolve()
    mode = str(modelling_mode).strip()
    if not mode:
        raise CoreError("E_REQUEST_INVALID", "Declare the modelling mode the sweep used (MT5 does not write it into the export).")
    source = Path(source_path).expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".xml":
        raise CoreError("E_SOURCE_NOT_FOUND", "Select the symbol sweep export (.xml) from MT5's Optimization results.")
    raw = source.read_bytes()
    source_hash = sha256(raw).hexdigest().upper()
    parsed = parse_symbol_sweep(raw)
    sweep_ref = f"sweep:{source_hash}"
    target = _bounded(root, FOLDER, source_hash)
    manifest_path = target / "manifest.json"
    if manifest_path.is_file():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        return existing | {"created": False}
    declared_set = None
    if set_path:
        from .mt5_set import intake_parameter_schema

        schema = intake_parameter_schema(root, set_path)
        declared_set = {"schema_ref": schema["schema_ref"], "filename": Path(set_path).name, "sha256": schema["source"]["sha256"], "parameter_count": schema["parameter_count"],
                        "inputs": schema["default"], "status": "DECLARED_NOT_VERIFIABLE", "note": "The sweep export lists no inputs, so TRL cannot confirm these were the inputs used."
                        + (f" The .set marks {len(schema['optimised_parameters'])} input(s) for optimisation, which a symbol sweep ignores." if schema["optimised_parameters"] else "")}
    _ensure_snapshot(_bounded(root, "raw", source_hash, "source.xml"), source, source_hash)
    target.mkdir(parents=True, exist_ok=True)
    import pyarrow as pa
    import pyarrow.parquet as pq

    pq.write_table(pa.Table.from_pylist(parsed["rows"]), target / "rows.parquet", compression="zstd", use_dictionary=False, write_statistics=True)
    manifest = {
        "sweep_ref": sweep_ref,
        "adapter_version": ADAPTER_VERSION,
        "source": {"filename": source.name, "sha256": source_hash, "byte_count": len(raw)},
        "imported_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "context": parsed["context"],
        "modelling_mode": mode,
        "modelling_mode_source": "USER_SUPPLIED",
        "declared_set": declared_set,
        "metrics": parsed["metrics"],
        "row_count": len(parsed["rows"]),
        "zero_trade_symbols": parsed["zero_trade_symbols"],
        "limitations": [
            "Metrics are MT5-reported and kept exactly as exported; TRL does not recompute them.",
            "A sweep row is a summary, not trades: drawdown curves, prop checks, Monte Carlo and Portfolio need a single-test report per symbol.",
            "The modelling mode is declared by you; the export does not record it." + ("" if declared_set else " No .set was attached, so the inputs used are not recorded."),
            "Nothing is ranked. Filters, frontier and shortlist are your choices.",
        ],
    }
    _atomic_json(manifest_path, manifest)
    return manifest | {"created": True}


def parse_symbol_sweep(raw: bytes) -> dict[str, Any]:
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as error:
        raise CoreError("E_SWEEP_XML_INVALID", "The selected file is not valid XML.") from error
    worksheet = root.find(".//ss:Worksheet[@ss:Name='Tester Optimizator Results']", _NS)
    if worksheet is None:
        raise CoreError("E_SWEEP_LAYOUT_UNSUPPORTED", "This is not an MT5 optimisation export (no 'Tester Optimizator Results' worksheet).")
    rows = worksheet.findall("./ss:Table/ss:Row", _NS)
    headers = [_cell_text(cell, _NS) for cell in rows[0].findall("./ss:Cell", _NS)] if rows else []
    if not headers or headers[0] != "Symbol":
        if headers and headers[0] == "Pass":
            raise CoreError("E_SWEEP_IS_PARAMETER_GRID", "This export is a parameter optimisation (it starts with Pass, not Symbol). Import it on the Parameters page.")
        raise CoreError("E_SWEEP_LAYOUT_UNSUPPORTED", "A symbol sweep export starts with a Symbol column.")
    if len(set(headers)) != len(headers):
        raise CoreError("E_SWEEP_LAYOUT_UNSUPPORTED", "The sweep header repeats a column.")
    inputs = [header for header in headers[1:] if header not in MT5_STATISTIC_COLUMNS]
    if inputs:
        raise CoreError("E_SWEEP_HAS_INPUT_COLUMNS", "This export varies EA inputs as well as symbols, which a symbol sweep does not do. Import parameter optimisations on the Parameters page.", details={"input_columns": inputs})
    if len(rows) < 2:
        raise CoreError("E_SWEEP_LAYOUT_UNSUPPORTED", "The sweep has no result rows.")
    metrics = [{"column": column, "id": METRIC_CATALOGUE[column][0], "label": METRIC_CATALOGUE[column][1], "default_direction": METRIC_CATALOGUE[column][2], "unit": METRIC_CATALOGUE[column][3]}
               for column in headers[1:] if column in METRIC_CATALOGUE]
    by_column = {metric["column"]: metric["id"] for metric in metrics}
    output: list[dict[str, str]] = []
    seen: set[str] = set()
    for sequence, row in enumerate(rows[1:], start=1):
        values = [_cell_text(cell, _NS) for cell in row.findall("./ss:Cell", _NS)]
        if len(values) != len(headers):
            raise CoreError("E_SWEEP_LAYOUT_UNSUPPORTED", "A sweep row does not match the header width.", details={"row": sequence})
        item = dict(zip(headers, values, strict=True))
        symbol = item["Symbol"].strip()
        if not symbol or symbol in seen:
            raise CoreError("E_SWEEP_SYMBOL_AMBIGUOUS", "Every sweep row needs a symbol, and each symbol may appear only once.", details={"symbol": symbol})
        seen.add(symbol)
        record = {"symbol": symbol, "pass": item.get("Pass", ""), "source_sequence": str(sequence)}
        for column, metric_id in by_column.items():
            record[metric_id] = item[column]
        output.append(record)
    properties = root.find(".//office:DocumentProperties", _NS)
    meta = {tag: (properties.findtext(f"office:{tag}", default="", namespaces=_NS) if properties is not None else "") for tag in ("Title", "Created", "Server", "Deposit", "Leverage", "Condition", "Build")}
    title = _TITLE.match(meta["Title"] or "")
    context = {
        "title": meta["Title"], "expert": title.group("expert") if title else None, "chart_symbol": title.group("symbol") if title else None,
        "timeframe": title.group("timeframe") if title else None, "start": title.group("start") if title else None, "end": title.group("end") if title else None,
        "server": meta["Server"] or None, "deposit": meta["Deposit"] or None, "leverage": meta["Leverage"] or None, "condition": meta["Condition"] or None,
        "build": meta["Build"] or None, "created": meta["Created"] or None,
    }
    zero = [row["symbol"] for row in output if row.get("trades") in ("0", "")]
    return {"context": context, "metrics": metrics, "rows": output, "zero_trade_symbols": zero}


def list_symbol_sweeps(workspace_root: Path) -> dict[str, object]:
    folder = workspace_root.resolve() / FOLDER
    manifests = []
    if folder.is_dir():
        for path in sorted(folder.glob("*/manifest.json")):
            manifests.append(json.loads(path.read_text(encoding="utf-8")))
    manifests.sort(key=lambda item: ((item["context"].get("expert") or "").casefold(), item["context"].get("start") or "", item["sweep_ref"]))
    return {"adapter_version": ADAPTER_VERSION, "sweeps": manifests, "max_compare": MAX_COMPARE}


def evaluate_symbol_sweep(workspace_root: Path, sweep_ref: str, objectives: list[dict[str, str]] | None = None, constraints: list[dict[str, str]] | None = None) -> dict[str, object]:
    """Rows as reported plus descriptive Pareto status for the chosen objectives and the user's constraints (S3)."""

    manifest, rows = _load(workspace_root, sweep_ref)
    objectives = objectives or DEFAULT_OBJECTIVES
    constraints = constraints or []
    known = {metric["id"] for metric in manifest["metrics"]}
    unknown = sorted({item.get("metric") for item in [*objectives, *constraints]} - known)
    if unknown:
        raise CoreError("E_PARETO_CONFIG_INVALID", f"This sweep has no metric: {', '.join(str(item) for item in unknown)}.")
    analysis = pareto_evaluate([{"id": row["symbol"], "values": {metric: row.get(metric) or None for metric in known}} for row in rows], objectives, constraints)
    by_id = {item["id"]: item for item in analysis["candidates"]}
    configuration = {"sweep_ref": sweep_ref, "adapter_version": ADAPTER_VERSION, "pareto": analysis["configuration"]}
    configuration_hash = sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
    return {
        "sweep": manifest,
        "evaluation_id": stable_uuid("symbol-sweep-evaluation", configuration_hash),
        "configuration": configuration,
        "counts": analysis["counts"],
        "front_count": analysis["front_count"],
        "rows": [row | {"pareto": {key: by_id[row["symbol"]][key] for key in ("status", "rank", "dominated_by_count", "dominated_by_example", "violations")}, "zero_trades": row["symbol"] in manifest["zero_trade_symbols"]} for row in rows],
        "warnings": [
            "The frontier marks trade-offs no other symbol beats on both chosen metrics. It is not a recommendation.",
            "Scanning many symbols makes it more likely that some look good by luck; re-test the shortlist with real ticks.",
        ],
    }


def compare_symbol_sweeps(workspace_root: Path, sweep_refs: list[str], metric: str) -> dict[str, object]:
    """Symbol × sweep matrix for one metric (S4); differences in period, timeframe, deposit, leverage or mode are listed."""

    if not isinstance(sweep_refs, list) or not 2 <= len(sweep_refs) <= MAX_COMPARE or len(set(sweep_refs)) != len(sweep_refs):
        raise CoreError("E_SWEEP_COMPARE_INVALID", f"Compare 2 to {MAX_COMPARE} different sweeps at a time.")
    loaded = [_load(workspace_root, ref) for ref in sweep_refs]
    for manifest, _ in loaded:
        if metric not in {item["id"] for item in manifest["metrics"]}:
            raise CoreError("E_SWEEP_COMPARE_INVALID", f"Sweep {manifest['context'].get('expert')} has no metric {metric}.")
    fields = [("period", lambda m: f"{m['context'].get('start')}–{m['context'].get('end')}"), ("timeframe", lambda m: m["context"].get("timeframe")), ("deposit", lambda m: m["context"].get("deposit")),
              ("leverage", lambda m: m["context"].get("leverage")), ("server", lambda m: m["context"].get("server")), ("modelling mode", lambda m: m["modelling_mode"])]
    differences = []
    for name, read in fields:
        values = [read(manifest) for manifest, _ in loaded]
        if len(set(values)) > 1:
            differences.append({"field": name, "values": values})
    symbols = sorted({row["symbol"] for _, rows in loaded for row in rows})
    lookup = [{row["symbol"]: row for row in rows} for _, rows in loaded]
    matrix = [{"symbol": symbol, "values": [(table[symbol].get(metric) if symbol in table else None) for table in lookup], "tested": [symbol in table for table in lookup]} for symbol in symbols]
    label = next(item["label"] for item in loaded[0][0]["metrics"] if item["id"] == metric)
    return {
        "metric": metric, "metric_label": label,
        "sweeps": [{"sweep_ref": manifest["sweep_ref"], "expert": manifest["context"].get("expert"), "filename": manifest["source"]["filename"]} for manifest, _ in loaded],
        "comparable": not any(item["field"] in {"period", "timeframe", "deposit", "leverage"} for item in differences),
        "differences": differences,
        "matrix": matrix,
        "warnings": ["Values are MT5-reported. Sweeps with a different period, timeframe, deposit or leverage are not like-for-like; differences are listed above the matrix."],
    }


def render_symbol_shortlist(workspace_root: Path, sweep_refs: list[str], symbols: list[str], reason: str) -> dict[str, object]:
    """Markdown for the Experiment note (S5): the shortlist, the sweeps it came from, and the next step."""

    if not isinstance(symbols, list) or not symbols or not all(isinstance(item, str) and item.strip() for item in symbols):
        raise CoreError("E_REQUEST_INVALID", "Tick at least one symbol for the shortlist.")
    loaded = [_load(workspace_root, ref)[0] for ref in sweep_refs]
    known = {row_symbol for ref in sweep_refs for row_symbol in (row["symbol"] for row in _load(workspace_root, ref)[1])}
    missing = sorted(set(symbols) - known)
    if missing:
        raise CoreError("E_REQUEST_INVALID", f"Not in the selected sweeps: {', '.join(missing)}.")
    shortlist_id = stable_uuid("symbol-shortlist", *sorted(sweep_refs), *sorted(symbols))
    lines = [
        "### Symbol shortlist",
        "",
        f"- Symbols: {', '.join(sorted(symbols))}",
        f"- Reason: {reason.strip() or '(none given)'}",
        "- From sweeps:",
        *[f"  - {manifest['context'].get('expert')}, {manifest['context'].get('timeframe')} {manifest['context'].get('start')}–{manifest['context'].get('end')}, {manifest['context'].get('deposit')}, {manifest['modelling_mode']} (`{manifest['source']['filename']}`, `{manifest['sweep_ref']}`)" for manifest in loaded],
        "- Next step: run a single test for each symbol with \"Every tick based on real ticks\" and your broker's commissions, then import the reports (Research workflow, step 3).",
        f"- Recorded by TRL {ADAPTER_VERSION}; the choice is yours, TRL does not rank symbols.",
    ]
    return {"shortlist_id": shortlist_id, "markdown": "\n".join(lines)}


def delete_symbol_sweep(workspace_root: Path, sweep_ref: str) -> dict[str, object]:
    """Remove TRL's copy of a sweep (its rows and manifest). The raw snapshot is kept, as for other imports."""

    manifest, _ = _load(workspace_root, sweep_ref)
    target = _bounded(workspace_root.resolve(), FOLDER, manifest["source"]["sha256"])
    import shutil

    shutil.rmtree(target)
    return {"sweep_ref": sweep_ref, "deleted": True}


def _load(workspace_root: Path, sweep_ref: str) -> tuple[dict[str, Any], list[dict[str, str]]]:
    if not isinstance(sweep_ref, str) or not sweep_ref.startswith("sweep:") or len(sweep_ref) != 70:
        raise CoreError("E_SWEEP_NOT_FOUND", "Unknown symbol sweep.")
    target = _bounded(workspace_root.resolve(), FOLDER, sweep_ref[6:])
    if not (target / "manifest.json").is_file():
        raise CoreError("E_SWEEP_NOT_FOUND", "That symbol sweep is not in the library (it may have been deleted).")
    import pyarrow.parquet as pq

    manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
    return manifest, pq.read_table(target / "rows.parquet").to_pylist()
