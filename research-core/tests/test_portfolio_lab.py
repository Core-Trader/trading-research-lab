"""Fixtures P1–P13, P15, P16 of internal/docs/PORTFOLIO_LAB_SPEC.md."""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
import json
from pathlib import Path
import random

import pytest

from trading_research_core.dataset_store import read_dataset, write_dataset
from trading_research_core.errors import CoreError
from trading_research_core.performance_metrics import performance_metrics
from trading_research_core.portfolio_lab import combine
from trading_research_core.worker import Worker

D0 = datetime(2026, 1, 1, 0, 0, 0)


def day(n: int) -> datetime:
    return datetime(2026, 1, n, 12, 0, 0) if n else D0


def _report(root: Path, sha: str, closes: list[tuple[datetime, str]], *, opening: str = "1000", start: datetime = D0, currency: str = "USD", deal_base: int = 100) -> str:
    events: list[dict[str, object]] = [{
        "source_sequence": 1, "source_timestamp": start.isoformat(), "event_type": "OPENING_BALANCE", "side": None, "symbol": "",
        "volume": "0", "source_profit": opening, "source_commission": "0", "source_swap": "0", "reported_balance": opening, "source_deal_id": "1",
    }]
    balance = Decimal(opening)
    for index, (moment, pnl) in enumerate(closes, start=2):
        balance += Decimal(pnl)
        events.append({"source_sequence": index, "source_timestamp": moment.isoformat(), "event_type": "POSITION_CLOSE", "side": "SELL", "symbol": "EURUSD", "volume": "0.01", "source_profit": pnl, "source_commission": "0", "source_swap": "0", "reported_balance": format(balance, "f"), "source_deal_id": str(deal_base + index)})
    digest = sha * 64 if len(sha) == 1 else sha.rjust(64, "0")
    imported = {"source": {"sha256": digest, "filename": f"report-{sha}.xlsx", "byte_count": 1, "worksheet_name": "Report"}, "settings": {"Currency": currency}, "events": events}
    return str(write_dataset(root, imported)["dataset_ref"])


def _ab(root: Path) -> tuple[str, str]:
    a = _report(root, "A", [(day(1), "100"), (day(3), "-50"), (day(5), "30")], deal_base=100)
    b = _report(root, "B", [(day(2), "50"), (day(3), "40"), (day(4), "-60"), (day(6), "20")], deal_base=200)
    return a, b


def test_p1_p2_merge_order_and_combined_balance(tmp_path: Path) -> None:
    a, b = _ab(tmp_path)
    result = combine(tmp_path, [[a], [b]], "1000")
    assert [point["balance"] for point in result["combined_balance"]] == ["1000", "1100", "1150", "1100", "1140", "1080", "1110", "1130"]
    assert [point["track_index"] for point in result["combined_balance"][1:]] == [0, 1, 0, 1, 1, 0, 1]


def test_p3_combined_metrics(tmp_path: Path) -> None:
    a, b = _ab(tmp_path)
    result = combine(tmp_path, [[a], [b]], "1000")
    balance = result["metrics"]["balance_metrics"]
    assert balance["maximum_drawdown"] == "70"
    assert balance["peak"]["balance"] == "1150" and balance["trough"]["balance"] == "1080"
    assert balance["recovery_status"] == "NOT_RECOVERED"
    assert result["net_pnl"] == "130"
    assert balance["return_to_drawdown"] == "1.85714286"


def test_p4_p5_standalone_drawdowns_overlap_and_contribution(tmp_path: Path) -> None:
    a, b = _ab(tmp_path)
    result = combine(tmp_path, [[a], [b]], "1000")
    tracks = result["tracks"]
    assert [track["standalone_maximum_drawdown"] for track in tracks] == ["50", "60"]
    assert result["drawdown_overlap"] == {"combined_maximum_drawdown": "70", "sum_of_standalone_maximum_drawdowns": "110", "offset": "40"}
    assert [track["net_pnl"] for track in tracks] == ["80", "50"]
    assert [track["share_of_combined_net_percent"] for track in tracks] == ["61.53846154", "38.46153846"]


def test_p6_correlation_needs_ten_days(tmp_path: Path) -> None:
    a, b = _ab(tmp_path)
    pair = combine(tmp_path, [[a], [b]], "1000")["correlation"][0]
    assert pair == {"left_index": 0, "right_index": 1, "days": 6, "pearson": None, "reason": "INSUFFICIENT_DAYS"}


def test_p7_correlation_values(tmp_path: Path) -> None:
    signs = ["1", "-1"] * 5
    a = _report(tmp_path, "A", [(day(n + 1), signs[n]) for n in range(10)], deal_base=100)
    mirror = _report(tmp_path, "B", [(day(n + 1), signs[n].lstrip("-") if signs[n].startswith("-") else "-" + signs[n]) for n in range(10)], deal_base=200)
    same = _report(tmp_path, "C", [(day(n + 1), signs[n]) for n in range(10)], deal_base=300)
    assert combine(tmp_path, [[a], [mirror]], "1000")["correlation"][0]["pearson"] == "-1.00000000"
    assert combine(tmp_path, [[a], [same]], "1000")["correlation"][0]["pearson"] == "1.00000000"


def test_p8_common_window_excludes_events_outside_the_overlap(tmp_path: Path) -> None:
    a, b = _ab(tmp_path)
    result = combine(tmp_path, [[a], [b]], "1000", "COMMON")
    assert result["window_end"] == day(5).isoformat()
    assert result["net_pnl"] == "110"
    assert result["tracks"][1]["close_events_in_window"] == 3


def test_p9_no_common_window(tmp_path: Path) -> None:
    january = _report(tmp_path, "A", [(day(2), "10")], deal_base=100)
    march = _report(tmp_path, "C", [(datetime(2026, 3, 3, 12), "10")], start=datetime(2026, 3, 1), deal_base=300)
    with pytest.raises(CoreError) as error:
        combine(tmp_path, [[january], [march]], "1000", "COMMON")
    assert error.value.code == "E_PORTFOLIO_NO_COMMON_WINDOW"
    assert combine(tmp_path, [[january], [march]], "1000")["net_pnl"] == "20"


def test_p10_duplicate_events_are_blocked(tmp_path: Path) -> None:
    original = _report(tmp_path, "A", [(day(1), "100")], deal_base=100)
    reexport = _report(tmp_path, "D", [(day(1), "100")], deal_base=100)
    with pytest.raises(CoreError) as error:
        combine(tmp_path, [[original], [reexport]], "1000")
    assert error.value.code == "E_PORTFOLIO_DUPLICATE_EVENTS"
    assert error.value.details["track_indices"] == [0, 1]


def test_p11_currency_mismatch(tmp_path: Path) -> None:
    usd = _report(tmp_path, "A", [(day(1), "10")], deal_base=100)
    eur = _report(tmp_path, "E", [(day(2), "10")], currency="EUR", deal_base=500)
    with pytest.raises(CoreError) as error:
        combine(tmp_path, [[usd], [eur]], "1000")
    assert error.value.code == "E_PORTFOLIO_CURRENCY_MISMATCH"


def test_p12_chained_track_and_blocked_chain(tmp_path: Path) -> None:
    first = _report(tmp_path, "A", [(day(1), "100"), (day(2), "-20")], deal_base=100)
    second = _report(tmp_path, "F", [(day(4), "30")], opening="1080", start=day(3), deal_base=600)
    other = _report(tmp_path, "B", [(day(2), "50")], deal_base=200)
    result = combine(tmp_path, [[first, second], [other]], "1000")
    assert result["tracks"][0]["net_pnl"] == "110" and result["tracks"][0]["close_events_in_window"] == 3
    assert result["tracks"][0]["active_end"] == day(4).isoformat()
    overlapping = _report(tmp_path, "9", [(day(2), "5")], opening="1080", start=day(1), deal_base=700)
    with pytest.raises(CoreError) as error:
        combine(tmp_path, [[first, overlapping]], "1000")
    assert error.value.code == "E_PORTFOLIO_TRACK_INVALID"
    assert any(finding["code"] == "COVERAGE_OVERLAP" for finding in error.value.details["findings"])


def test_p13_single_track_matches_standalone_metrics(tmp_path: Path) -> None:
    a, _ = _ab(tmp_path)
    combined = combine(tmp_path, [[a]], "1000")
    standalone = performance_metrics(read_dataset(tmp_path, a))
    for key in ("maximum_drawdown", "maximum_drawdown_percent", "return_to_drawdown", "recovery_status"):
        assert combined["metrics"]["balance_metrics"][key] == standalone["balance_metrics"][key]
    for key in ("profit_factor", "expectancy", "sqn", "average_win", "average_loss"):
        assert combined["metrics"]["close_event_metrics"][key] == standalone["close_event_metrics"][key]


def test_p15_deterministic_and_immutable(tmp_path: Path) -> None:
    a, b = _ab(tmp_path)
    before = json.dumps([read_dataset(tmp_path, a), read_dataset(tmp_path, b)], sort_keys=True, default=str)
    first = json.dumps(combine(tmp_path, [[a], [b]], "1000"), sort_keys=True)
    second = json.dumps(combine(tmp_path, [[a], [b]], "1000"), sort_keys=True)
    assert first == second
    assert json.dumps([read_dataset(tmp_path, a), read_dataset(tmp_path, b)], sort_keys=True, default=str) == before
    assert combine(tmp_path, [[a], [b]], "2000")["combination_id"] != json.loads(first)["combination_id"]


def test_p16_combined_drawdown_is_subadditive(tmp_path: Path) -> None:
    generator = random.Random(20260922)
    for trial in range(8):
        refs = []
        for member in range(3):
            closes = [(D0 + timedelta(hours=generator.randint(1, 900)), str(generator.randint(-80, 90))) for _ in range(25)]
            refs.append(_report(tmp_path, f"AB{trial}{member}", sorted(closes), deal_base=1000 * (member + 1)))
        result = combine(tmp_path, [[ref] for ref in refs], "5000")
        overlap = result["drawdown_overlap"]
        assert Decimal(overlap["combined_maximum_drawdown"]) <= Decimal(overlap["sum_of_standalone_maximum_drawdowns"])


@pytest.mark.parametrize("tracks,capital,window", [([], "1000", "UNION"), ([["x"]] * 11, "1000", "UNION"), ([["a"], ["a"]], "1000", "UNION"), ([["a"]], "0", "UNION"), ([["a"]], "abc", "UNION"), ([["a"]], "1000", "SIDEWAYS")])
def test_invalid_configuration(tmp_path: Path, tracks: list[list[str]], capital: str, window: str) -> None:
    with pytest.raises(CoreError) as error:
        combine(tmp_path, tracks, capital, window)
    assert error.value.code == "E_PORTFOLIO_CONFIG_INVALID"


def test_worker_exposes_portfolio_combine(tmp_path: Path) -> None:
    a, b = _ab(tmp_path)
    worker = Worker(tmp_path)
    assert "portfolio.combine" in worker.dispatch({"method": "core.capabilities", "params": {}})["methods"]
    result = worker.dispatch({"method": "portfolio.combine", "params": {"tracks": [[a], [b]], "starting_capital": "1000"}})
    assert result["net_pnl"] == "130" and result["configuration"]["window"] == "UNION"
