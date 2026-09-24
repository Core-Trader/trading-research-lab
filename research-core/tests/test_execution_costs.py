from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.execution_costs import execution_cost_scenario, points_to_money
from trading_research_core.worker import Worker
from test_cost_breakdown import _dataset  # opening 1000; EURUSD 0.10 in/out, USDJPY 0.20 in/out; final 1061

D = Decimal


def test_no_parameters_means_nothing_is_applied_but_break_even_is_shown(tmp_path: Path) -> None:
    result = execution_cost_scenario(_dataset(tmp_path, "1061.00"))
    assert result["applied"] is False and result["after"] is None
    assert D(result["lots_dealt"]) == D("0.60")
    assert D(result["break_even_per_lot"]) == D("101.66666667")        # 61 / 0.6


def test_per_lot_charges_by_hand(tmp_path: Path) -> None:
    result = execution_cost_scenario(_dataset(tmp_path, "1061.00"), "10", "5")   # 15 per lot per deal
    after = result["after"]
    assert D(after["extra_cost_total"]) == D("9")                        # 15 x 0.6
    assert D(after["balance_change"]) == D("52")
    assert result["round_turn_check"]["consistent"] is True
    assert D(result["before"]["closed_trades"]["net"]) == D("71.5")      # 44.5 + 27 (closing deals)
    assert D(after["closed_trades"]["net"]) == D("62.5")                 # 41.5 + 21 (round turns 3 and 6)
    assert D(after["max_drawdown"]) >= D(result["before"]["max_drawdown"])


def test_break_even_cost_brings_the_balance_change_to_zero(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path, "1061.00")
    rate = execution_cost_scenario(dataset)["break_even_per_lot"]
    after = execution_cost_scenario(dataset, rate)["after"]
    assert abs(D(after["balance_change"])) < D("0.00001")


def test_per_symbol_override(tmp_path: Path) -> None:
    result = execution_cost_scenario(_dataset(tmp_path, "1061.00"), "10", "5", {"USDJPY": {"spread": "20"}})
    rates = {row["symbol"]: D(row["rate_per_lot"]) for row in result["by_symbol"]}
    assert rates == {"EURUSD": D("15"), "USDJPY": D("25")}              # USDJPY spread 20 + default slippage 5
    assert D(result["after"]["extra_cost_total"]) == D("15") * D("0.2") + D("25") * D("0.4")


def test_points_to_money_by_hand() -> None:
    assert D(points_to_money("10", "0.00001", "0.00001", "1")["money_per_lot"]) == D("10")
    assert D(points_to_money("20", "0.001", "0.005", "5")["money_per_lot"]) == D("20")     # 20 x 0.001 / 0.005 x 5
    with pytest.raises(CoreError):
        points_to_money("10", "0.00001", "0", "1")


@pytest.mark.parametrize("spread,slippage", [("-1", None), ("abc", None), (None, "-0.5")])
def test_invalid_amounts(tmp_path: Path, spread: str | None, slippage: str | None) -> None:
    with pytest.raises(CoreError) as error:
        execution_cost_scenario(_dataset(tmp_path, "1061.00"), spread, slippage)
    assert error.value.code == "E_EXECUTION_COST_INVALID"


def test_worker_and_note(tmp_path: Path) -> None:
    ref = str(_dataset(tmp_path, "1061.00")["metadata"]["dataset_ref"])
    worker = Worker(tmp_path)
    result = worker.dispatch({"method": "scenario.execution_costs", "params": {"dataset_ref": ref, "extra_spread_per_lot": "10"}})
    assert result["applied"] is True
    note = worker.dispatch({"method": "scenario.render_execution_cost_note", "params": {"dataset_ref": ref, "extra_spread_per_lot": "10", "reason": "ok"}})
    assert note["markdown"].startswith("### Execution costs checked") and "extra spread 10" in note["markdown"]
    money = worker.dispatch({"method": "scenario.points_to_money", "params": {"points": "10", "point_size": "0.00001", "tick_size": "0.00001", "tick_value": "1"}})
    assert D(money["money_per_lot"]) == D("10")
