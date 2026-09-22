"""M6 deterministic order-permutation research over verified close events."""

from __future__ import annotations

from decimal import Decimal, ROUND_CEILING
from hashlib import sha256
import json
from pathlib import Path

from . import CORE_VERSION
from .dataset_store import read_dataset
from .errors import CoreError
from .identities import stable_uuid
from .trade_analysis import close_event_summary, write_trade_artifact


POLICY_ID = "monte-carlo-close-event-order-permutation-v1"
CALCULATION_VERSION = "m6-monte-carlo-order-permutation-2"
PRNG_ID = "PCG32-v1"
MAX_PATH_COUNT = 10_000
MAX_DRAWDOWN_HISTOGRAM_BINS = 20
_UINT64_MAX = (1 << 64) - 1
_UINT32_RANGE = 1 << 32


def order_permutation_scenario(workspace_root: Path, dataset_ref: str, seed: str, path_count: int) -> dict[str, object]:
    """Generate seeded order permutations without altering source outcomes."""

    normalized_seed = _parse_seed(seed)
    _validate_path_count(path_count)
    dataset = read_dataset(workspace_root, dataset_ref)
    source_result, source_rows = close_event_summary(dataset)
    currency = source_result.get("currency")
    if not isinstance(currency, str) or not currency.strip():
        raise CoreError("E_MONTE_CARLO_INPUT_INVALID", "Monte Carlo requires a source currency.")
    if len(source_rows) < 2:
        raise CoreError("E_MONTE_CARLO_INPUT_INVALID", "Monte Carlo order permutation requires at least two verified close events.")

    source_artifact = write_trade_artifact(workspace_root, dataset_ref, "close-events", source_result, source_rows)
    population = [_decimal(row["net_pnl"]) for row in source_rows]
    source_total = sum(population, Decimal("0"))
    configuration = {
        "policy_id": POLICY_ID,
        "input_artifact": source_artifact["artifacts"]["table"],
        "input_artifact_sha256": source_artifact["artifacts"]["table_sha256"],
        "input_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "population": "all eligible verified close-event net P/L values",
        "currency": currency,
        "sampling_method": "ORDER_PERMUTATION_WITHOUT_REPLACEMENT",
        "path_count": path_count,
        "seed": str(normalized_seed),
        "prng": PRNG_ID,
        "shuffle": "FISHER_YATES_V1",
        "path_start": "0 cumulative close-event P/L",
        "drawdown": "maximum decline from cumulative path high-water mark",
        "quantiles": "nearest-rank p05, p50, p95",
    }
    configuration_hash = _configuration_hash(configuration)
    rng = _Pcg32(normalized_seed)
    rows: list[dict[str, object]] = []
    for path_index in range(1, path_count + 1):
        path = list(population)
        _fisher_yates(path, rng)
        running = Decimal("0")
        high_water = Decimal("0")
        maximum_drawdown = Decimal("0")
        for value in path:
            running += value
            high_water = max(high_water, running)
            maximum_drawdown = max(maximum_drawdown, high_water - running)
        if running != source_total:
            raise CoreError("E_MONTE_CARLO_INVARIANT", "A permutation path changed the source population total.")
        rows.append({
            "path_index": path_index,
            "final_cumulative_close_event_pnl": _format(running),
            "maximum_drawdown": _format(maximum_drawdown),
        })

    drawdowns = sorted(_decimal(row["maximum_drawdown"]) for row in rows)
    drawdown_histogram = _drawdown_histogram(drawdowns)
    analysis_id = stable_uuid("m6-monte-carlo", dataset_ref, POLICY_ID, configuration_hash, CALCULATION_VERSION, CORE_VERSION)
    root = workspace_root.resolve()
    source_sha256 = _source_sha256(dataset_ref)
    target = (root / "datasets" / source_sha256 / "analysis" / analysis_id).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Monte Carlo path escapes the worker workspace.") from error
    target.mkdir(parents=True, exist_ok=True)
    parquet_path = target / "order-permutation-paths.parquet"
    manifest_path = target / "manifest.json"
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for Monte Carlo artifact storage.") from error
    pq.write_table(pa.Table.from_pylist(rows), parquet_path, compression="zstd", use_dictionary=False, write_statistics=True)
    lowest = min(rows, key=lambda row: (_decimal(row["maximum_drawdown"]), int(row["path_index"])))
    highest = max(rows, key=lambda row: (_decimal(row["maximum_drawdown"]), -int(row["path_index"])))
    result = {
        "analysis_id": analysis_id,
        "analysis_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "policy_id": POLICY_ID,
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": dataset_ref,
        "currency": currency,
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "population_count": len(population),
        "source_total_close_event_pnl": _format(source_total),
        "invariant_final_pnl": _format(source_total),
        "drawdown_summary": {
            "minimum": _format(drawdowns[0]),
            "p05": _format(_nearest_rank(drawdowns, Decimal("0.05"))),
            "p50": _format(_nearest_rank(drawdowns, Decimal("0.50"))),
            "p95": _format(_nearest_rank(drawdowns, Decimal("0.95"))),
            "maximum": _format(drawdowns[-1]),
        },
        "drawdown_histogram": drawdown_histogram,
        "least_drawdown_path": {"path_index": int(lowest["path_index"]), "maximum_drawdown": str(lowest["maximum_drawdown"])},
        "worst_drawdown_path": {"path_index": int(highest["path_index"]), "maximum_drawdown": str(highest["maximum_drawdown"])},
        "warnings": [
            "Paths are seeded order permutations of the same historical verified close-event P/L values; every path retains the same final total.",
            "Drawdown is cumulative close-event P/L from a zero start. It is not account balance, intratrade equity, a percentage, or prop-firm compliance.",
            "Percentiles describe this generated finite path set only. They are not probabilities or forecasts of future performance.",
        ],
    }
    manifest = {
        "schema_version": "1.0",
        "analysis_kind": "monte-carlo-close-event-order-permutation",
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
            "table": f"{dataset_ref}:analysis:{analysis_id}:order-permutation-paths",
            "manifest": f"{dataset_ref}:analysis:{analysis_id}:manifest",
            "table_sha256": _sha256_file(parquet_path),
            "manifest_sha256": _sha256_file(manifest_path),
        },
    }


class _Pcg32:
    """Small specified PRNG; no dependency on runtime random implementation."""

    _MULTIPLIER = 6364136223846793005
    _INCREMENT = 1442695040888963407

    def __init__(self, seed: int) -> None:
        self.state = 0
        self.next_uint32()
        self.state = (self.state + seed) & _UINT64_MAX
        self.next_uint32()

    def next_uint32(self) -> int:
        oldstate = self.state
        self.state = (oldstate * self._MULTIPLIER + self._INCREMENT) & _UINT64_MAX
        xorshifted = (((oldstate >> 18) ^ oldstate) >> 27) & 0xFFFFFFFF
        rotation = (oldstate >> 59) & 31
        return ((xorshifted >> rotation) | (xorshifted << ((-rotation) & 31))) & 0xFFFFFFFF

    def below(self, upper_exclusive: int) -> int:
        limit = _UINT32_RANGE - (_UINT32_RANGE % upper_exclusive)
        while True:
            value = self.next_uint32()
            if value < limit:
                return value % upper_exclusive


def _fisher_yates(values: list[Decimal], rng: _Pcg32) -> None:
    for index in range(len(values) - 1, 0, -1):
        other = rng.below(index + 1)
        values[index], values[other] = values[other], values[index]


def _nearest_rank(values: list[Decimal], percentile: Decimal) -> Decimal:
    rank = int((Decimal(len(values)) * percentile).to_integral_value(rounding=ROUND_CEILING))
    return values[max(0, rank - 1)]


def _drawdown_histogram(drawdowns: list[Decimal]) -> dict[str, object]:
    """Return bounded deterministic display data from existing path summaries."""

    if not drawdowns:
        raise CoreError("E_MONTE_CARLO_INVARIANT", "Monte Carlo produced no path drawdowns.")
    minimum, maximum = drawdowns[0], drawdowns[-1]
    if minimum == maximum:
        return {
            "binning": "EQUAL_WIDTH_V1",
            "bin_count": 1,
            "buckets": [{"lower_bound": _format(minimum), "upper_bound": _format(maximum), "count": len(drawdowns)}],
        }

    bin_count = min(MAX_DRAWDOWN_HISTOGRAM_BINS, len(drawdowns))
    width = (maximum - minimum) / Decimal(bin_count)
    counts = [0] * bin_count
    for value in drawdowns:
        index = int((value - minimum) / width)
        counts[min(index, bin_count - 1)] += 1
    buckets = []
    for index, count in enumerate(counts):
        lower = minimum + (width * index)
        upper = maximum if index == bin_count - 1 else minimum + (width * (index + 1))
        buckets.append({"lower_bound": _format(lower), "upper_bound": _format(upper), "count": count})
    return {"binning": "EQUAL_WIDTH_V1", "bin_count": bin_count, "buckets": buckets}


def _parse_seed(value: str) -> int:
    normalized = value.strip()
    if not normalized.isdigit():
        raise CoreError("E_MONTE_CARLO_CONFIG_INVALID", "seed must be a non-negative uint64 decimal integer.")
    parsed = int(normalized)
    if parsed > _UINT64_MAX:
        raise CoreError("E_MONTE_CARLO_CONFIG_INVALID", "seed exceeds the unsigned 64-bit integer range.")
    return parsed


def _validate_path_count(value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > MAX_PATH_COUNT:
        raise CoreError("E_MONTE_CARLO_CONFIG_INVALID", f"path_count must be an integer from 1 to {MAX_PATH_COUNT}.")


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
