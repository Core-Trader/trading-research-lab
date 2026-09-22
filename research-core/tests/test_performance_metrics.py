"""Fixtures F1–F13 of internal/docs/MVP_TIER_C_PERFORMANCE_METRICS.md."""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
import json
from pathlib import Path

import pytest

from trading_research_core.dataset_store import read_dataset, write_dataset
from trading_research_core.errors import CoreError
from trading_research_core.performance_metrics import performance_metrics
from trading_research_core.worker import Worker

START = datetime(2026, 1, 5, 12, 0, 0)


def _dataset(tmp_path: Path, pnl: list[str], *, opening: str = "1000", times: list[datetime] | None = None, opens: bool = False, sha: str = "C") -> dict[str, object]:
    events: list[dict[str, object]] = [{
        "source_sequence": 1, "source_timestamp": START.isoformat(), "event_type": "OPENING_BALANCE", "side": None, "symbol": "",
        "volume": "0", "source_profit": opening, "source_commission": "0", "source_swap": "0", "reported_balance": opening, "source_deal_id": "1",
    }]
    balance = Decimal(opening)
    sequence = 2
    for index, value in enumerate(pnl):
        moment = times[index] if times else START + timedelta(days=index + 1)
        if opens:
            events.append({"source_sequence": sequence, "source_timestamp": (moment - timedelta(hours=1)).isoformat(), "event_type": "POSITION_OPEN", "side": "BUY", "symbol": "EURUSD", "volume": "1", "source_profit": "0", "source_commission": "0", "source_swap": "0", "reported_balance": format(balance, "f"), "source_deal_id": str(sequence)})
            sequence += 1
        balance += Decimal(value)
        events.append({"source_sequence": sequence, "source_timestamp": moment.isoformat(), "event_type": "POSITION_CLOSE", "side": "SELL", "symbol": "EURUSD", "volume": "1", "source_profit": value, "source_commission": "0", "source_swap": "0", "reported_balance": format(balance, "f"), "source_deal_id": str(sequence)})
        sequence += 1
    imported = {"source": {"sha256": sha * 64, "filename": "synthetic.xlsx", "byte_count": 1, "worksheet_name": "Report"}, "settings": {"Currency": "USD"}, "events": events}
    return read_dataset(tmp_path, str(write_dataset(tmp_path, imported)["dataset_ref"]))


def test_f1_basic(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["100", "-50", "-80", "200"]))
    balance, close = result["balance_metrics"], result["close_event_metrics"]
    assert balance["maximum_drawdown"] == "130"
    assert balance["maximum_drawdown_percent"] == "11.81818182"
    assert balance["peak"]["balance"] == "1100" and balance["trough"]["balance"] == "970"
    assert balance["recovery"]["balance"] == "1170" and balance["recovery_status"] == "RECOVERED"
    assert balance["return_to_drawdown"] == "1.30769231"
    assert close["profit_factor"] == "2.30769231" and close["profit_factor_reason"] is None
    assert close["average_win"] == "150.00000000" and close["average_loss"] == "-65.00000000"
    assert close["payoff_ratio"] == "2.30769231"
    assert close["expectancy"] == "42.50000000"
    assert close["longest_winning_streak"] == {"count": 1, "net_pnl": "100", "first_source_sequence": 2, "last_source_sequence": 2}
    assert close["longest_losing_streak"]["count"] == 2 and close["longest_losing_streak"]["net_pnl"] == "-130"


def test_f2_no_losses(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["10", "20", "30"]))
    balance, close = result["balance_metrics"], result["close_event_metrics"]
    assert balance["maximum_drawdown"] == "0"
    assert balance["peak"] is None and balance["trough"] is None and balance["recovery"] is None
    assert balance["return_to_drawdown"] is None and balance["return_to_drawdown_reason"] == "NO_DRAWDOWN"
    assert close["profit_factor"] is None and close["profit_factor_reason"] == "NO_LOSSES"
    assert close["average_loss"] is None and close["payoff_ratio"] is None
    assert close["longest_winning_streak"]["count"] == 3 and close["longest_winning_streak"]["net_pnl"] == "60"
    assert close["longest_losing_streak"] == {"count": 0, "net_pnl": None, "first_source_sequence": None, "last_source_sequence": None}


def test_f3_never_recovers(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["50", "-100", "20"]))
    balance = result["balance_metrics"]
    assert balance["maximum_drawdown"] == "100"
    assert balance["peak"]["balance"] == "1050" and balance["trough"]["balance"] == "950"
    assert balance["recovery"] is None and balance["recovery_status"] == "NOT_RECOVERED"
    ongoing = result["stagnation"]["ongoing"]
    assert ongoing["status"] == "ONGOING" and ongoing["start"]["balance"] == "1050" and ongoing["end"]["balance"] == "970"


def test_f4_equal_high_does_not_end_stagnation(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["50", "-50", "50", "10"]))
    stagnation = result["stagnation"]["longest_by_time"]
    assert stagnation["start"]["balance"] == "1050" and stagnation["end"]["balance"] == "1060"
    assert stagnation["status"] == "ENDED_BY_NEW_HIGH"
    assert stagnation["duration_seconds"] == 3 * 86400 and stagnation["close_events"] == 3
    assert result["balance_metrics"]["maximum_drawdown"] == "50"


def test_f5_ties_choose_first_trough(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["50", "-50", "50", "-50"]))
    balance = result["balance_metrics"]
    assert balance["maximum_drawdown"] == "50"
    assert balance["trough"]["source_sequence"] == 3
    assert balance["recovery"]["source_sequence"] == 4
    assert result["stagnation"]["period_count"] == 2
    assert result["stagnation"]["ongoing"]["start"]["source_sequence"] == 2


def test_f6_breakeven_counts_and_breaks_streaks(tmp_path: Path) -> None:
    close = performance_metrics(_dataset(tmp_path, ["10", "0", "10", "-5", "0", "-5"]))["close_event_metrics"]
    assert close["close_event_count"] == 6
    assert close["expectancy"] == "1.66666667"
    assert close["longest_winning_streak"]["count"] == 1
    assert close["longest_losing_streak"]["count"] == 1


def test_f7_interleaved_opens_do_not_change_results(tmp_path: Path) -> None:
    plain = performance_metrics(_dataset(tmp_path, ["100", "-50", "-80", "200"], sha="A"))
    with_opens = performance_metrics(_dataset(tmp_path, ["100", "-50", "-80", "200"], opens=True, sha="B"))
    for key in ("maximum_drawdown", "maximum_drawdown_percent", "return_to_drawdown", "recovery_status"):
        assert plain["balance_metrics"][key] == with_opens["balance_metrics"][key]
    assert {k: v for k, v in plain["close_event_metrics"].items() if "streak" not in k} == {k: v for k, v in with_opens["close_event_metrics"].items() if "streak" not in k}
    assert plain["stagnation"]["longest_by_time"]["close_events"] == with_opens["stagnation"]["longest_by_time"]["close_events"]


def test_f8_single_losing_close(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["-20"]))
    close = result["close_event_metrics"]
    assert result["balance_metrics"]["maximum_drawdown"] == "20"
    assert result["balance_metrics"]["recovery_status"] == "NOT_RECOVERED"
    assert close["profit_factor"] == "0.00000000" and close["profit_factor_reason"] is None
    assert close["average_win"] is None and close["payoff_ratio"] is None
    assert close["expectancy"] == "-20.00000000"
    assert close["longest_losing_streak"]["count"] == 1


def test_f9_non_positive_high_has_no_percent(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["-10"], opening="0"))
    assert result["balance_metrics"]["maximum_drawdown"] == "10"
    assert result["balance_metrics"]["maximum_drawdown_percent"] is None
    assert result["drawdown_series"][-1]["drawdown_percent"] is None


def test_f10_longest_by_time_and_by_events_differ(tmp_path: Path) -> None:
    day = lambda n: START + timedelta(days=n)
    pnl = ["100", "-10", "5", "20"] + ["-1"] * 7 + ["20"]
    times = [day(1), day(2), day(31), day(32)] + [day(33) + timedelta(hours=h) for h in range(7)] + [day(35)]
    stagnation = performance_metrics(_dataset(tmp_path, pnl, times=times))["stagnation"]
    assert stagnation["longest_by_time"]["duration_seconds"] == 31 * 86400
    assert stagnation["longest_by_time"]["close_events"] == 3
    assert stagnation["longest_by_close_events"]["close_events"] == 8
    assert stagnation["longest_by_close_events"]["duration_days"] == "3.00000000"
    assert stagnation["longest_by_time"]["start"] != stagnation["longest_by_close_events"]["start"]


def test_f11_quotients_quantised_sums_exact(tmp_path: Path) -> None:
    close = performance_metrics(_dataset(tmp_path, ["100", "0", "0", "-0.01"]))["close_event_metrics"]
    assert close["net_pnl"] == "99.99"
    assert close["expectancy"] == "24.99750000"
    assert close["profit_factor"] == "10000.00000000"
    result = performance_metrics(_dataset(tmp_path, ["100", "-3"], sha="D"))
    assert result["close_event_metrics"]["profit_factor"] == "33.33333333"


def test_f12_deterministic_and_immutable(tmp_path: Path) -> None:
    first_dir, second_dir = tmp_path / "a", tmp_path / "b"
    first_dir.mkdir()
    second_dir.mkdir()
    first = _dataset(first_dir, ["100", "-50", "-80", "200"])
    before = json.dumps(first, sort_keys=True, default=str)
    a = json.dumps(performance_metrics(first), sort_keys=True)
    b = json.dumps(performance_metrics(_dataset(second_dir, ["100", "-50", "-80", "200"])), sort_keys=True)
    assert a == b
    assert json.dumps(first, sort_keys=True, default=str) == before


def test_f13_reconciliation(tmp_path: Path) -> None:
    result = performance_metrics(_dataset(tmp_path, ["12.34", "-5.67", "0", "8.9", "-1.11", "3"]))
    close = result["close_event_metrics"]
    net = Decimal(close["net_pnl"])
    assert Decimal(close["gross_profit"]) + Decimal(close["gross_loss"]) == net
    assert abs(Decimal(close["expectancy"]) * close["close_event_count"] - net) <= Decimal("0.00000001") * close["close_event_count"]
    last = result["drawdown_series"][-1]
    assert len(result["drawdown_series"]) == 7
    assert Decimal(last["drawdown"]) == max(Decimal("1000") + Decimal(v) for v in ["0", "12.34", "6.67", "6.67", "15.57", "14.46", "17.46"]) - Decimal("1017.46")


def test_structured_errors(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path, ["10"])
    broken = {**dataset, "events": [event for event in dataset["events"] if event["event_type"] != "OPENING_BALANCE"]}
    with pytest.raises(CoreError) as error:
        performance_metrics(broken)
    assert error.value.code == "E_DATASET_INVALID"


def test_worker_exposes_performance_metrics(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path, ["100", "-50"])
    dataset_ref = str(dataset["metadata"]["dataset_ref"])
    worker = Worker(tmp_path)
    assert "analysis.performance_metrics" in worker.dispatch({"method": "core.capabilities", "params": {}})["methods"]
    assert worker.dispatch({"method": "analysis.performance_metrics", "params": {"dataset_ref": dataset_ref}})["balance_metrics"]["maximum_drawdown"] == "50"
