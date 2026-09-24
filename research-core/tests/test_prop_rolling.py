"""Rolling start dates (PROP_FIRM_SPEC.md P8)."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path
import random

import pytest

from trading_research_core.day_boundary import DayBoundary
from trading_research_core.equity_log import attach_equity_log
from trading_research_core.errors import CoreError
from trading_research_core.intake import intake_mt5_report
from trading_research_core.prop_check import evaluate, save_profile, validate_profile
from trading_research_core.prop_rolling import _Context, _summary, rolling_starts
from trading_research_core.worker import Worker
from test_equity_log import DEALS, _log, _report
from test_prop_check import _profile, _workspace, sample

D = Decimal


def test_first_start_agrees_with_the_full_run_check(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    target = {"kind": "DATASET", "dataset_ref": ref}
    passing = _profile(workspace, profit_target={"kind": "PERCENT", "value": "1"}, minimum_trading_days=3)
    full = evaluate(workspace, passing, target)
    first = rolling_starts(workspace, passing, target)["starts"][0]
    assert full["challenge"]["outcome"] == "PASSED" and first["outcome"] == "PASSED"
    assert first["decided_at"] == full["challenge"]["pass_time"] == "2026-01-05T10:00:00"
    breaking = _profile(workspace, profit_target={"kind": "PERCENT", "value": "1"}, daily_loss_limit={"kind": "AMOUNT", "value": "100"})
    first = rolling_starts(workspace, breaking, target)["starts"][0]
    assert (first["outcome"], first["rule"], first["decided_at"]) == ("BROKEN", "DAILY_LOSS", evaluate(workspace, breaking, target)["rules"][0]["first_breach"]["time"])


def test_later_starts_shift_the_run_without_rescaling(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    result = rolling_starts(workspace, _profile(workspace, profit_target={"kind": "AMOUNT", "value": "250"}), {"kind": "DATASET", "dataset_ref": ref})
    by_day = {item["start_day"]: item for item in result["starts"]}
    # From 2026-01-04 (balance 9899.50 before the day) the run gains 299.50 by 01-05: +250 is reached from a shifted 10 000.
    assert by_day["2026-01-04"]["outcome"] == "PASSED" and by_day["2026-01-04"]["calendar_days"] == 2
    # From 01-01 the run ends only +199: not enough, and the data ends first.
    assert by_day["2026-01-01"]["outcome"] == "NOT_DECIDED"
    assert result["summary"]["counts"]["PASSED"] >= 1


def test_fast_path_matches_a_full_scan_on_random_runs() -> None:
    generator = random.Random(24092026)
    for case in range(40):
        samples, balance = [sample("2026-02-01T00:00:00", "10000")], D(10000)
        for day in range(1, 15):
            for hour in (1, 9, 17, 23):
                balance += D(generator.randint(-150, 170))
                close = balance + D(generator.randint(-120, 80))
                low = min(balance, close) - D(generator.randint(0, 150))
                high = max(balance, close) + D(generator.randint(0, 60))
                samples.append(sample(f"2026-02-{day:02d}T{hour:02d}:00:00", str(balance), str(close), low=str(low), high=str(high)))
        mode = generator.choice(["FIXED", "TRAILING", "TRAILING_LOCKS_AT_START"])
        rules = validate_profile({
            "name": "R", "account_size": "10000", "daily_loss_limit": {"kind": "PERCENT", "value": str(generator.choice([2, 3, 5]))},
            "overall_loss_limit": {"kind": "PERCENT", "value": str(generator.choice([5, 8, 10]))}, "overall_loss_mode": mode,
            "trailing_reference": None if mode == "FIXED" else generator.choice(["BALANCE_HIGH", "EQUITY_HIGH", "END_OF_DAY_BALANCE_HIGH"]),
            "profit_target": {"kind": "PERCENT", "value": str(generator.choice([3, 5, 8]))}, "minimum_trading_days": generator.choice([None, 2, 4]),
            "best_day_max_percent": generator.choice([None, "50"]), "limit_touch_counts": generator.choice([True, False]),
            "maximum_calendar_days": generator.choice([None, 6]),
        })
        events = [item["time"] for item in samples[1::3]]
        fast = _Context(samples, DayBoundary(), events, rules, D(10000), rules["maximum_calendar_days"])
        slow = _Context(samples, DayBoundary(), events, rules, D(10000), rules["maximum_calendar_days"])
        slow.fast = False
        assert [fast.follow(index) for index in range(len(fast.days))] == [slow.follow(index) for index in range(len(slow.days))], case


def test_survival_mode_without_a_target(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    profile = _profile(workspace, overall_loss_limit={"kind": "PERCENT", "value": "10"})
    result = rolling_starts(workspace, profile, {"kind": "DATASET", "dataset_ref": ref}, survival_days=2)
    assert result["mode"] == "SURVIVAL" and result["horizon_days"] == 2
    assert result["summary"]["success_outcome"] == "SURVIVED" and result["summary"]["counts"]["SURVIVED"] >= 1
    with pytest.raises(CoreError):
        rolling_starts(workspace, profile, {"kind": "DATASET", "dataset_ref": ref}, survival_days=0)


def test_portfolio_starts_use_both_bounds(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    refs = []
    for name, shift in (("A", 0), ("B", 10)):
        folder = tmp_path / name
        folder.mkdir()
        deals = [[*deal[:1], str(int(deal[1]) + shift), *deal[2:]] for deal in DEALS]
        ref = str(intake_mt5_report(workspace, str(_report(folder, deals=deals, expert=f"EA{name}")))["dataset_ref"])
        attach_equity_log(workspace, ref, str(_log(folder, expert=f"EA{name}")), "Every tick based on real ticks")
        refs.append(ref)
    profile = str(save_profile(workspace, {"name": "Two", "account_size": "20000", "overall_loss_limit": {"kind": "AMOUNT", "value": "250"}})["profile"]["profile_id"])
    first = rolling_starts(workspace, profile, {"kind": "COMBINATION", "tracks": [[refs[0]], [refs[1]]]}, survival_days=40)["starts"][0]
    assert first["outcome"] == "POSSIBLY_BROKEN" and first["optimistic_outcome"] == "NOT_DECIDED"


def test_summary_uses_nearest_rank_median_and_worker_method(tmp_path: Path) -> None:
    starts = [{"outcome": "PASSED", "calendar_days": days, "open_at_start": False} for days in (9, 3, 5, 7)] + [{"outcome": "BROKEN", "calendar_days": 2, "open_at_start": True}]
    summary = _summary(starts, True)
    assert summary["days_to_pass"] == {"minimum": 3, "median": 5, "maximum": 9}
    assert summary["success_share_percent"] == "80.00000000" and summary["open_at_start"] == 1
    workspace, ref = _workspace(tmp_path)
    profile = _profile(workspace, profit_target={"kind": "PERCENT", "value": "1"})
    result = Worker(workspace).dispatch({"method": "prop.rolling_starts", "params": {"profile_id": profile, "target": {"kind": "DATASET", "dataset_ref": ref}}})
    assert result["calculation_version"] == "prop-rolling-1" and len(result["starts"]) == 6  # one per day with a sample, including the END row on 01-31
