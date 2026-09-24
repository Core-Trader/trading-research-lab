"""Bootstrap Monte Carlo over verified close events (PROPOSAL_BOOTSTRAP.md, B1-B5).

Methods (sources in internal/references/REFERENCE_REGISTER.md):
- RESAMPLE: each path draws N close-event results with replacement, where N is
  the report's count (Efron 1979; NIST e-Handbook 1.3.3.4).
- BLOCK_RESAMPLE: moving-block bootstrap; each path joins blocks of l
  consecutive results, block starts drawn with replacement, truncated to N
  (Kunsch 1989). l is the user's own number (the source gives no value).

Unlike order permutation, the final total varies across paths, so the share
of paths ending below zero is defined. NIST warns that the bootstrap is not
appropriate for statistics that depend heavily on the tails; the result marks
the 99th percentile and the extremes as tail values.
The order-permutation method in monte_carlo.py is unchanged.
"""

from __future__ import annotations

from decimal import Decimal
import json
from pathlib import Path

from . import CORE_VERSION
from .dataset_store import read_dataset
from .errors import CoreError
from .identities import stable_uuid
from .monte_carlo import (
    DRAWDOWN_PERCENTILES, MAX_FAN_PATHS, PRNG_ID, _Pcg32, _configuration_hash, _decimal, _drawdown_histogram, _fan_sample_indices,
    _format, _maximum_drawdown, _nearest_rank, _opening_balance, _parse_seed, _q8, _sampled_cumulative, _sha256_file, _source_sha256,
    _validate_path_count,
)
from .trade_analysis import close_event_summary, write_trade_artifact


POLICY_ID = "monte-carlo-close-event-bootstrap-v1"
CALCULATION_VERSION = "m6-monte-carlo-bootstrap-1"
METHODS = {"RESAMPLE": "RESAMPLE_WITH_REPLACEMENT", "BLOCK_RESAMPLE": "MOVING_BLOCK_RESAMPLE"}
TAIL_VALUES = ("p99", "minimum", "maximum")  # NIST 1.3.3.4 tail caution
FINAL_PERCENTILES = ("05", "50", "95")


def _percent(count: int, total: int) -> str:
    """A share in percent with 8 decimals, never in exponent form (0 is 0.00000000)."""
    return format(_decimal(_q8(Decimal(count) / Decimal(total) * 100)), "f")


def draw_path(population: list[Decimal], method: str, block_length: int | None, rng: _Pcg32) -> list[Decimal]:
    """One bootstrap path of the same length as the population."""
    count = len(population)
    if method == "RESAMPLE":
        return [population[rng.below(count)] for _ in range(count)]
    assert block_length is not None
    path: list[Decimal] = []
    starts = count - block_length + 1
    while len(path) < count:
        start = rng.below(starts)
        path.extend(population[start:start + block_length])
    return path[:count]


def bootstrap_scenario(workspace_root: Path, dataset_ref: str, seed: str, path_count: int, method: str,
                       block_length: int | None = None, drawdown_limit: str | None = None) -> dict[str, object]:
    normalized_seed = _parse_seed(seed)
    _validate_path_count(path_count)
    if method not in METHODS:
        raise CoreError("E_MONTE_CARLO_CONFIG_INVALID", "method must be RESAMPLE or BLOCK_RESAMPLE.")
    dataset = read_dataset(workspace_root, dataset_ref)
    source_result, source_rows = close_event_summary(dataset)
    currency = source_result.get("currency")
    if not isinstance(currency, str) or not currency.strip():
        raise CoreError("E_MONTE_CARLO_INPUT_INVALID", "Monte Carlo requires a source currency.")
    population = [_decimal(row["net_pnl"]) for row in source_rows]
    if len(population) < 2:
        raise CoreError("E_MONTE_CARLO_INPUT_INVALID", "Resampling requires at least two verified close events.")
    if method == "BLOCK_RESAMPLE":
        if isinstance(block_length, bool) or not isinstance(block_length, int) or not 2 <= block_length < len(population):
            raise CoreError("E_MONTE_CARLO_CONFIG_INVALID", f"block_length must be a whole number from 2 to {len(population) - 1} (fewer than the report's closed trades).")
    else:
        block_length = None
    limit: Decimal | None = None
    if drawdown_limit is not None:
        try:
            limit = Decimal(drawdown_limit.strip())
        except Exception as error:
            raise CoreError("E_MONTE_CARLO_CONFIG_INVALID", "drawdown_limit must be a positive decimal amount.") from error
        if not limit.is_finite() or limit <= 0:
            raise CoreError("E_MONTE_CARLO_CONFIG_INVALID", "drawdown_limit must be a positive decimal amount.")

    source_artifact = write_trade_artifact(workspace_root, dataset_ref, "close-events", source_result, source_rows)
    source_total = sum(population, Decimal("0"))
    configuration = {
        "policy_id": POLICY_ID,
        "input_artifact": source_artifact["artifacts"]["table"],
        "input_artifact_sha256": source_artifact["artifacts"]["table_sha256"],
        "input_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "population": "all eligible verified close-event net P/L values",
        "currency": currency,
        "sampling_method": METHODS[method],
        "block_length": block_length,
        "path_length": "the report's close-event count",
        "path_count": path_count,
        "seed": str(normalized_seed),
        "prng": PRNG_ID,
        "path_start": "0 cumulative close-event P/L",
        "drawdown": "maximum decline from cumulative path high-water mark",
        "drawdown_limit": None if limit is None else _format(limit),
        "quantiles": "nearest-rank",
        "tail_values": list(TAIL_VALUES),
    }
    configuration_hash = _configuration_hash(configuration)
    rng = _Pcg32(normalized_seed)
    sample_indices = _fan_sample_indices(len(population) + 1)
    fan_paths: list[dict[str, object]] = []
    rows: list[dict[str, object]] = []
    for path_index in range(1, path_count + 1):
        path = draw_path(population, method, block_length, rng)
        running = high_water = maximum_drawdown = Decimal("0")
        cumulative = [running]
        for value in path:
            running += value
            high_water = max(high_water, running)
            maximum_drawdown = max(maximum_drawdown, high_water - running)
            cumulative.append(running)
        if path_index <= MAX_FAN_PATHS:
            fan_paths.append({"path_index": path_index, "values": [_format(cumulative[index]) for index in sample_indices]})
        rows.append({"path_index": path_index, "final_cumulative_close_event_pnl": _format(running), "maximum_drawdown": _format(maximum_drawdown)})

    finals = sorted(_decimal(row["final_cumulative_close_event_pnl"]) for row in rows)
    drawdowns = sorted(_decimal(row["maximum_drawdown"]) for row in rows)
    below_zero = sum(1 for value in finals if value < 0)
    historical_drawdown = _maximum_drawdown(population)
    opening = _opening_balance(dataset)
    median_drawdown = _nearest_rank(drawdowns, Decimal("0.50"))
    p95_drawdown = _nearest_rank(drawdowns, Decimal("0.95"))
    over_limit = None if limit is None else sum(1 for value in drawdowns if value > limit)

    analysis_id = stable_uuid("m6-monte-carlo-bootstrap", dataset_ref, POLICY_ID, configuration_hash, CALCULATION_VERSION, CORE_VERSION)
    root = workspace_root.resolve()
    target = (root / "datasets" / _source_sha256(dataset_ref) / "analysis" / analysis_id).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Monte Carlo path escapes the worker workspace.") from error
    target.mkdir(parents=True, exist_ok=True)
    parquet_path = target / "bootstrap-paths.parquet"
    manifest_path = target / "manifest.json"
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for Monte Carlo artifact storage.") from error
    pq.write_table(pa.Table.from_pylist(rows), parquet_path, compression="zstd", use_dictionary=False, write_statistics=True)

    result = {
        "analysis_id": analysis_id,
        "analysis_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "policy_id": POLICY_ID,
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": dataset_ref,
        "currency": currency,
        "method": method,
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "population_count": len(population),
        "source_total_close_event_pnl": _format(source_total),
        "final_summary": {
            "minimum": _format(finals[0]),
            **{f"p{level}": _format(_nearest_rank(finals, Decimal(level) / Decimal("100"))) for level in FINAL_PERCENTILES},
            "maximum": _format(finals[-1]),
        },
        "below_zero": {"count": below_zero, "percent": _percent(below_zero, path_count)},
        "historical_final_rank_percent": _percent(sum(1 for value in finals if value < source_total), path_count),
        "final_histogram": _drawdown_histogram(finals),
        "drawdown_summary": {
            "minimum": _format(drawdowns[0]),
            "p50": _format(median_drawdown),
            "p95": _format(p95_drawdown),
            "maximum": _format(drawdowns[-1]),
        },
        "drawdown_percentiles": [
            {"percentile": level, "maximum_drawdown": _format(_nearest_rank(drawdowns, Decimal(level) / Decimal("100")))}
            for level in DRAWDOWN_PERCENTILES
        ],
        "drawdown_histogram": _drawdown_histogram(drawdowns),
        "over_limit": None if over_limit is None else {"limit": _format(limit), "count": over_limit, "percent": _percent(over_limit, path_count)},
        "historical": {"maximum_drawdown": _format(historical_drawdown), "final": _format(source_total)},
        "path_fan": {"point_count": len(sample_indices), "event_indices": sample_indices,
                     "historical": [_format(value) for value in _sampled_cumulative(population, sample_indices)], "paths": fan_paths},
        "account": {
            "opening_balance": None if opening is None else _format(opening),
            "p50_percent_of_opening": None if opening is None else _q8(median_drawdown / opening * 100),
            "p95_percent_of_opening": None if opening is None else _q8(p95_drawdown / opening * 100),
        },
        "tail_values": list(TAIL_VALUES),
        "warnings": [
            "Paths resample this report's closed-trade results; they describe this sample, not future markets.",
            "The 99th percentile and the extremes depend on the tails, where the bootstrap is least reliable.",
            "Drawdown is cumulative closed-trade P/L from a zero start, not account equity.",
        ],
    }
    manifest = {
        "schema_version": "1.0", "analysis_kind": "monte-carlo-close-event-bootstrap", "analysis_id": analysis_id, "dataset_ref": dataset_ref,
        "input_artifact": source_artifact["artifacts"], "core_version": CORE_VERSION, "calculation_version": CALCULATION_VERSION,
        "configuration": configuration, "configuration_hash": configuration_hash, "record_count": len(rows), "result": result,
        "storage": {"parquet": parquet_path.name, "numeric_representation": "decimal_string"},
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {**result, "artifacts": {
        "table": f"{dataset_ref}:analysis:{analysis_id}:bootstrap-paths", "manifest": f"{dataset_ref}:analysis:{analysis_id}:manifest",
        "table_sha256": _sha256_file(parquet_path), "manifest_sha256": _sha256_file(manifest_path),
    }}


_METHOD_TEXT = {"RESAMPLE": "resampling single trades with replacement", "BLOCK_RESAMPLE": "resampling blocks of consecutive trades"}


def stored_bootstrap_result(workspace_root: Path, dataset_ref: str, analysis_id: str) -> dict[str, object]:
    """The stored result of an earlier run (no recalculation)."""
    root = workspace_root.resolve()
    manifest_path = (root / "datasets" / _source_sha256(dataset_ref) / "analysis" / analysis_id / "manifest.json").resolve()
    try:
        manifest_path.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Monte Carlo path escapes the worker workspace.") from error
    if not manifest_path.is_file():
        raise CoreError("E_MONTE_CARLO_NOT_FOUND", "That Monte Carlo run is not stored; run it again.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("analysis_kind") != "monte-carlo-close-event-bootstrap":
        raise CoreError("E_MONTE_CARLO_NOT_FOUND", "That stored run is not a resampling run.")
    return manifest["result"]


def bootstrap_note(result: dict[str, object], reason: str) -> dict[str, str]:
    """Markdown for "Monte Carlo checked" in an Experiment note (B7), from a stored result."""
    configuration = result["configuration"]
    currency = result["currency"]
    final, drawdown = result["final_summary"], result["drawdown_summary"]
    block = f" of {configuration['block_length']} trades" if configuration["block_length"] else ""
    lines = [
        "### Monte Carlo checked",
        "",
        f"- Report: `{result['dataset_ref']}`; {result['population_count']} closed trades; method: {_METHOD_TEXT[result['method']]}{block}",
        f"- Paths: {configuration['path_count']} (seed {configuration['seed']})",
        f"- Final result: median {final['p50']} {currency}; 5th to 95th percentile {final['p05']} to {final['p95']} {currency}",
        f"- Paths ending below zero: {result['below_zero']['percent']} %",
        f"- Drawdown: median {drawdown['p50']} {currency}; 95th percentile {drawdown['p95']} {currency}",
    ]
    if result["over_limit"]:
        lines.append(f"- Paths above your drawdown limit of {result['over_limit']['limit']} {currency}: {result['over_limit']['percent']} %")
    lines += [
        "- These paths resample this report's trades; they describe this sample, not future markets (Efron 1979; NIST 1.3.3.4).",
        f"- Your conclusion: {reason.strip() or '(none given)'}",
        f"- Calculation: `{result['calculation_version']}`, `{result['analysis_id']}`",
    ]
    return {"record_id": str(result["analysis_id"]), "markdown": "\n".join(lines)}
