from __future__ import annotations

from pathlib import Path

import pytest

from trading_research_core.dataset_store import read_dataset, write_dataset
from trading_research_core.errors import CoreError
from trading_research_core.what_if import fixed_close_event_cost_scenario


def _imported() -> dict[str, object]:
    return {
        "source": {"sha256": "C" * 64, "filename": "synthetic.xlsx", "byte_count": 1, "worksheet_name": "Report"},
        "settings": {"Currency": "USD"},
        "events": [
            {"source_sequence": 1, "source_timestamp": "2026-01-01T00:00:00", "event_type": "POSITION_CLOSE", "side": "BUY", "symbol": "EURUSD", "volume": "1", "source_profit": "2", "source_commission": "0", "source_swap": "0", "reported_balance": "1002", "source_deal_id": "1"},
            {"source_sequence": 2, "source_timestamp": "2026-01-02T00:00:00", "event_type": "POSITION_CLOSE", "side": "SELL", "symbol": "EURUSD", "volume": "1", "source_profit": "-1", "source_commission": "0", "source_swap": "0", "reported_balance": "1001", "source_deal_id": "2"},
        ],
    }


def test_fixed_cost_scenario_is_exact_separate_and_deterministic(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported())["dataset_ref"])
    before = read_dataset(tmp_path, dataset_ref)
    first = fixed_close_event_cost_scenario(tmp_path, dataset_ref, "2.00")
    first_table = next((tmp_path / "datasets").rglob("fixed-close-event-cost.parquet"))
    first_bytes = first_table.read_bytes()
    second = fixed_close_event_cost_scenario(tmp_path, dataset_ref, "2.00")
    second_bytes = first_table.read_bytes()

    assert first["analysis_basis"] == "MT5_VERIFIED_CLOSE_EVENTS"
    assert first["configuration"]["additional_cost_per_close_event"] == "2.00"
    assert first["source_summary"]["net_pnl"] == "1"
    assert first["scenario_summary"]["net_pnl"] == "-3.00"
    assert first["net_pnl_delta"] == "-4.00"
    assert first["source_summary"]["win_count"] == 1
    assert first["scenario_summary"]["breakeven_count"] == 1
    assert first["analysis_id"] == second["analysis_id"]
    assert first["artifacts"]["table"] == second["artifacts"]["table"]
    assert first_bytes == second_bytes
    assert read_dataset(tmp_path, dataset_ref) == before


@pytest.mark.parametrize("cost", ["-0.01", "not-a-decimal", "NaN"])
def test_fixed_cost_scenario_rejects_invalid_cost(tmp_path: Path, cost: str) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported())["dataset_ref"])
    with pytest.raises(CoreError) as raised:
        fixed_close_event_cost_scenario(tmp_path, dataset_ref, cost)
    assert raised.value.code == "E_SCENARIO_CONFIG_INVALID"


def test_changed_cost_creates_a_distinct_scenario_identity(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported())["dataset_ref"])
    first = fixed_close_event_cost_scenario(tmp_path, dataset_ref, "0")
    second = fixed_close_event_cost_scenario(tmp_path, dataset_ref, "1")
    assert first["analysis_id"] != second["analysis_id"]
    assert first["scenario_summary"]["net_pnl"] == "1"
    assert second["scenario_summary"]["net_pnl"] == "-1"
