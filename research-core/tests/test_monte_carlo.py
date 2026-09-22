from __future__ import annotations

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
