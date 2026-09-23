from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from trading_research_core.dataset_store import read_dataset, write_dataset
from trading_research_core.errors import CoreError
from trading_research_core.monte_carlo import MAX_PATH_COUNT, order_permutation_scenario


def _imported(values: list[str] | None = None) -> dict[str, object]:
    outcomes = values or ["3", "-2", "-1"]
    return {
        "source": {"sha256": "D" * 64, "filename": "synthetic.xlsx", "byte_count": 1, "worksheet_name": "Report"},
        "settings": {"Currency": "USD"},
        "events": [
            {"source_sequence": index, "source_timestamp": f"2026-01-{index:02d}T00:00:00", "event_type": "POSITION_CLOSE", "side": "BUY", "symbol": "EURUSD", "volume": "1", "source_profit": value, "source_commission": "0", "source_swap": "0", "reported_balance": str(1000 + index), "source_deal_id": str(index)}
            for index, value in enumerate(outcomes, start=1)
        ],
    }


def test_seeded_order_permutations_are_exact_immutable_and_deterministic(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported())["dataset_ref"])
    before = read_dataset(tmp_path, dataset_ref)
    first = order_permutation_scenario(tmp_path, dataset_ref, "42", 12)
    table = next((tmp_path / "datasets").rglob("order-permutation-paths.parquet"))
    first_bytes = table.read_bytes()
    second = order_permutation_scenario(tmp_path, dataset_ref, "42", 12)
    second_bytes = table.read_bytes()

    summary = first["drawdown_summary"]
    assert first["population_count"] == 3
    assert first["source_total_close_event_pnl"] == "0"
    assert first["invariant_final_pnl"] == "0"
    assert first["configuration"]["seed"] == "42"
    assert first["configuration"]["prng"] == "PCG32-v1"
    assert float(summary["minimum"]) <= float(summary["p05"]) <= float(summary["p50"]) <= float(summary["p95"]) <= float(summary["maximum"])
    histogram = first["drawdown_histogram"]
    assert histogram["binning"] == "EQUAL_WIDTH_V1"
    assert histogram["bin_count"] <= 12
    assert sum(bucket["count"] for bucket in histogram["buckets"]) == 12
    assert histogram == second["drawdown_histogram"]
    assert first["analysis_id"] == second["analysis_id"]
    assert first_bytes == second_bytes
    assert read_dataset(tmp_path, dataset_ref) == before


def test_changed_seed_or_path_count_creates_distinct_identity(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported())["dataset_ref"])
    first = order_permutation_scenario(tmp_path, dataset_ref, "1", 10)
    second = order_permutation_scenario(tmp_path, dataset_ref, "2", 10)
    third = order_permutation_scenario(tmp_path, dataset_ref, "1", 11)
    assert first["analysis_id"] != second["analysis_id"]
    assert first["analysis_id"] != third["analysis_id"]


@pytest.mark.parametrize("seed,path_count", [("-1", 10), ("not-a-seed", 10), (str(1 << 64), 10), ("1", 0), ("1", MAX_PATH_COUNT + 1)])
def test_invalid_seed_or_path_count_blocks_without_partial_monte_carlo_artifact(tmp_path: Path, seed: str, path_count: int) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported())["dataset_ref"])
    with pytest.raises(CoreError) as raised:
        order_permutation_scenario(tmp_path, dataset_ref, seed, path_count)
    assert raised.value.code == "E_MONTE_CARLO_CONFIG_INVALID"
    assert list((tmp_path / "datasets").rglob("order-permutation-paths.parquet")) == []


def test_one_close_event_blocks(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported(["1"]))["dataset_ref"])
    with pytest.raises(CoreError) as raised:
        order_permutation_scenario(tmp_path, dataset_ref, "1", 10)
    assert raised.value.code == "E_MONTE_CARLO_INPUT_INVALID"


def test_drawdown_percentile_table_is_monotonic_nearest_rank(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported(["5", "-3", "2", "-4", "1", "-2", "3"]))["dataset_ref"])
    result = order_permutation_scenario(tmp_path, dataset_ref, "7", 200)
    table = result["drawdown_percentiles"]
    assert [row["percentile"] for row in table] == ["50", "80", "90", "95", "99"]
    values = [float(row["maximum_drawdown"]) for row in table]
    assert values == sorted(values)
    assert table[0]["maximum_drawdown"] == result["drawdown_summary"]["p50"]
    assert table[3]["maximum_drawdown"] == result["drawdown_summary"]["p95"]
    assert float(table[-1]["maximum_drawdown"]) <= float(result["drawdown_summary"]["maximum"])


def test_path_fan_is_bounded_starts_at_zero_and_ends_at_the_invariant_total(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported(["3", "-2", "-1", "4"]))["dataset_ref"])
    result = order_permutation_scenario(tmp_path, dataset_ref, "42", 150)
    fan = result["path_fan"]
    assert fan["point_count"] == 5
    assert fan["event_indices"] == [0, 1, 2, 3, 4]
    assert fan["historical"] == ["0", "3", "1", "0", "4"]
    assert [path["path_index"] for path in fan["paths"]] == list(range(1, 101))
    assert all(path["values"][0] == "0" and path["values"][-1] == result["invariant_final_pnl"] for path in fan["paths"])
    assert order_permutation_scenario(tmp_path, dataset_ref, "42", 150)["path_fan"] == fan


def test_path_fan_samples_long_paths_with_first_and_last_point(tmp_path: Path) -> None:
    values = [str((index % 7) - 3) for index in range(600)]
    dataset_ref = str(write_dataset(tmp_path, _imported(values))["dataset_ref"])
    fan = order_permutation_scenario(tmp_path, dataset_ref, "3", 5)["path_fan"]
    assert fan["sampling"] == "EVEN_INDEX_SAMPLE_V1"
    assert fan["point_count"] == len(fan["event_indices"]) <= 250
    assert fan["event_indices"][0] == 0 and fan["event_indices"][-1] == 600
    assert fan["event_indices"] == sorted(set(fan["event_indices"]))
    assert all(len(path["values"]) == fan["point_count"] for path in fan["paths"])


def test_recording_the_fan_does_not_change_generated_paths(tmp_path: Path) -> None:
    # The fan must describe exactly the paths stored in the Parquet artifact.
    dataset_ref = str(write_dataset(tmp_path, _imported(["3", "-2", "-1"]))["dataset_ref"])
    result = order_permutation_scenario(tmp_path, dataset_ref, "42", 12)
    import pyarrow.parquet as pq
    table = next((tmp_path / "datasets").rglob("order-permutation-paths.parquet"))
    drawdowns = [row["maximum_drawdown"] for row in pq.read_table(table).to_pylist()]
    fan_drawdowns = []
    for path in result["path_fan"]["paths"]:
        values = [int(value) for value in path["values"]]
        high, worst = 0, 0
        for value in values:
            high = max(high, value)
            worst = max(worst, high - value)
        fan_drawdowns.append(str(worst))
    assert fan_drawdowns == drawdowns


def test_path_drawdowns_match_values_pinned_from_calculation_version_2(tmp_path: Path) -> None:
    # Produced by the committed version-2 code (seed 42, 12 paths). Version 3
    # only records extra display data and must not change path generation.
    dataset_ref = str(write_dataset(tmp_path, _imported(["5", "-3", "2", "-4", "1", "-2", "3"]))["dataset_ref"])
    order_permutation_scenario(tmp_path, dataset_ref, "42", 12)
    import pyarrow.parquet as pq
    table = next((tmp_path / "datasets").rglob("order-permutation-paths.parquet"))
    assert [row["maximum_drawdown"] for row in pq.read_table(table).to_pylist()] == ["4", "5", "9", "7", "5", "5", "7", "4", "7", "4", "7", "4"]


def _stored_path_drawdowns(workspace: Path, result: dict[str, object]) -> list[Decimal]:
    import pyarrow.parquet as pq
    source = str(result["dataset_ref"]).removeprefix("mt5:")
    table = workspace / "datasets" / source / "analysis" / str(result["analysis_id"]) / "order-permutation-paths.parquet"
    return [Decimal(row["maximum_drawdown"]) for row in pq.read_table(table).to_pylist()]


def test_historical_order_is_ranked_against_the_stored_paths(tmp_path: Path) -> None:
    # Historical order 10, -30, 20: the running total goes 10, -20, 0, so the maximum drawdown is 30.
    dataset_ref = str(write_dataset(tmp_path, _imported(["10", "-30", "20"]))["dataset_ref"])
    result = order_permutation_scenario(tmp_path, dataset_ref, "7", 400)
    historical = result["historical"]
    assert historical["maximum_drawdown"] == "30"
    stored = _stored_path_drawdowns(tmp_path, result)
    assert Decimal(historical["rank_percent"]) == Decimal(sum(1 for value in stored if value < 30)) / Decimal(len(stored)) * 100
    median = Decimal(result["drawdown_summary"]["p50"])
    assert historical["vs_median"] == ("DEEPER" if Decimal(30) > median else "SHALLOWER" if Decimal(30) < median else "EQUAL")


def test_fan_bands_are_ordered_start_at_zero_and_end_at_the_total(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported())["dataset_ref"])
    result = order_permutation_scenario(tmp_path, dataset_ref, "20260921", 300)
    bands = result["fan_bands"]
    assert len(bands["p05"]) == len(bands["p50"]) == len(bands["p95"]) == len(bands["event_indices"])
    assert all(Decimal(low) <= Decimal(mid) <= Decimal(high) for low, mid, high in zip(bands["p05"], bands["p50"], bands["p95"]))
    assert (bands["p05"][0], bands["p95"][0]) == ("0", "0")
    total = Decimal(result["invariant_final_pnl"])
    assert Decimal(bands["p05"][-1]) == Decimal(bands["p95"][-1]) == total  # every path ends at the same total
    widths = [Decimal(high) - Decimal(low) for low, high in zip(bands["p05"], bands["p95"])]
    assert Decimal(bands["widest_band"]) == max(widths)
    assert bands["widest_at_event"] == bands["event_indices"][widths.index(max(widths))]


def test_drawdowns_as_a_share_of_the_opening_balance(tmp_path: Path) -> None:
    without = order_permutation_scenario(tmp_path / "a", str(write_dataset(tmp_path / "a", _imported())["dataset_ref"]), "5", 50)
    assert without["account"] == {"opening_balance": None, "p50_percent_of_opening": None, "p95_percent_of_opening": None}
    imported = _imported()
    opening_event = {"source_sequence": 0, "source_timestamp": "2026-01-01T00:00:00", "event_type": "OPENING_BALANCE", "side": None, "symbol": None, "volume": None, "source_profit": "1000", "source_commission": "0", "source_swap": "0", "reported_balance": "1000", "source_deal_id": "0"}
    imported["events"] = [opening_event, *imported["events"]]  # type: ignore[index]
    dataset_ref = str(write_dataset(tmp_path / "b", imported)["dataset_ref"])
    result = order_permutation_scenario(tmp_path / "b", dataset_ref, "5", 200)
    account = result["account"]
    opening = Decimal(account["opening_balance"])
    assert opening == 1000
    expected = (Decimal(result["drawdown_summary"]["p95"]) / opening * 100).quantize(Decimal("0.00000001"))
    assert Decimal(account["p95_percent_of_opening"]) == expected
