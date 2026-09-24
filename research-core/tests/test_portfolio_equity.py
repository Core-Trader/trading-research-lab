from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from trading_research_core.equity_log import attach_equity_log
from trading_research_core.errors import CoreError
from trading_research_core.intake import intake_mt5_report
from trading_research_core.portfolio_equity import combine_equity, combined_series, drawdown_range, interval_seconds
from trading_research_core.worker import Worker
from test_equity_log import _log, _report

D = Decimal


def _track(deposit: str, buckets: dict[int, tuple[str, str, str, str]]) -> dict:
    """buckets: index -> (close, low, high, margin); balance = close for simplicity."""
    return {"deposit": D(deposit), "buckets": {index: {"close": D(c), "balance": D(c), "low": D(lo), "high": D(hi), "margin": D(m)} for index, (c, lo, hi, m) in buckets.items()}}


def test_lows_at_different_moments_give_a_range_by_hand() -> None:
    a = _track("1000", {1: ("1000", "900", "1000", "100")})   # A dips 100 at some moment
    b = _track("1000", {1: ("1000", "950", "1050", "50")})    # B dips 50 and rises 50 at other moments
    series = combined_series([a, b], D("2000"), 0, 1)
    point = series[1]
    assert point["low_conservative"] == D("1850")            # both lows together: 2000 - 100 - 50
    assert point["low_observed"] == D("1950")                # A's low + B's high = -100 + 50; B's low + A's high = -50 + 0
    result = drawdown_range(series, D("2000"))
    assert (result["observed"], result["conservative"]) == (D("50"), D("150"))  # the true drawdown lies between


def test_carry_forward_and_margin_sum() -> None:
    a = _track("1000", {0: ("1000", "1000", "1000", "0"), 2: ("900", "880", "1000", "200")})
    b = _track("500", {1: ("520", "490", "520", "40")})
    series = combined_series([a, b], D("1500"), 0, 2)
    assert [point["close"] for point in series] == [D("1500"), D("1520"), D("1420")]   # A carries 1000 at index 1; B carries 520 at 2
    assert [point["margin"] for point in series] == [D("0"), D("40"), D("200")]
    assert series[2]["low_conservative"] == D("1500") + D("-120") + D("20")               # A low 880 (-120), B carried 520 (+20)


def test_interval_labels() -> None:
    assert (interval_seconds("M5"), interval_seconds("H1"), interval_seconds("D1")) == (300, 3600, 86400)
    with pytest.raises(CoreError):
        interval_seconds("MN1")


def _two_logged_reports(tmp_path: Path, attach_second: bool = True) -> tuple[Path, str, str]:
    workspace = tmp_path / "workspace"
    refs = []
    for index, expert in enumerate(("EA_One", "EA_Two")):
        folder = tmp_path / f"r{index}"
        folder.mkdir(parents=True)
        ref = str(intake_mt5_report(workspace, str(_report(folder, expert=expert)))["dataset_ref"])
        if index == 0 or attach_second:
            attach_equity_log(workspace, ref, str(_log(folder, expert=expert)), "Every tick based on real ticks")
        refs.append(ref)
    return workspace, refs[0], refs[1]


def test_missing_logs_are_listed_not_mixed(tmp_path: Path) -> None:
    workspace, one, two = _two_logged_reports(tmp_path, attach_second=False)
    result = combine_equity(workspace, [[one], [two]], "20000")
    assert result["status"] == "MISSING_LOGS"
    assert [item["dataset_ref"] for item in result["missing"]] == [two]


def test_two_logged_reports_combine_with_a_range_and_margin(tmp_path: Path) -> None:
    workspace, one, two = _two_logged_reports(tmp_path)
    result = Worker(workspace).dispatch({"method": "portfolio.combine_equity", "params": {"tracks": [[one], [two]], "starting_capital": "20000", "window": "UNION", "stop_out_level": "50"}})
    assert result["status"] == "COMBINED" and result["grid_minutes"] == 5
    drawdown = result["equity_drawdown"]
    assert D(drawdown["observed"]) <= D(drawdown["conservative"])
    single = D(result["tracks"][0]["equity_drawdown"]["conservative"])
    assert D(drawdown["conservative"]) == 2 * single                       # identical tracks: their lows coincide exactly
    assert D(result["diversification"]["sum_of_tracks"]) == 2 * single
    assert D(result["realised_drawdown"]) <= D(drawdown["conservative"])  # holds for this data; not a general rule (a balance peak can sit above equity during a floating loss)
    assert result["margin"]["peak_margin"] == "220.00" and result["margin"]["intervals_below_stop_out"] == 0
    assert D(result["margin"]["lowest_level_percent"]) > 100
    assert result["worst_day"] is not None and D(result["worst_day"]["loss_conservative"]) >= D(result["worst_day"]["loss_observed"])
    assert result["chart"] and "low_conservative" in result["chart"][0]


def test_note_records_the_range(tmp_path: Path) -> None:
    workspace, one, two = _two_logged_reports(tmp_path)
    note = Worker(workspace).dispatch({"method": "portfolio.render_equity_note", "params": {"tracks": [[one], [two]], "starting_capital": "20000", "labels": ["One", "Two"], "reason": "ok"}})
    assert note["markdown"].startswith("### Combined equity checked") and "Tracks: One, Two" in note["markdown"]
    assert "between" in note["markdown"] and "Your conclusion: ok" in note["markdown"]
    workspace2, a, b = _two_logged_reports(tmp_path / "second", attach_second=False)
    with pytest.raises(CoreError):
        Worker(workspace2).dispatch({"method": "portfolio.render_equity_note", "params": {"tracks": [[a], [b]], "starting_capital": "20000", "reason": ""}})
