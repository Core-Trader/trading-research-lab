"""Prop-firm rule check (PROP_FIRM_SPEC.md F1–F9) and the shared day boundary."""

from __future__ import annotations

from decimal import Decimal
import json
from pathlib import Path
import random

import pytest

from trading_research_core.day_boundary import DayBoundary
from trading_research_core.equity_log import attach_equity_log
from trading_research_core.errors import CoreError
from trading_research_core.intake import intake_mt5_report
from trading_research_core.prop_check import _check, combine_equity, delete_profile, evaluate, list_profiles, save_profile, validate_profile
from trading_research_core.worker import Worker
from test_equity_log import DEALS, _log, _report

D = Decimal


def sample(time: str, balance: str, close: str | None = None, low: str | None = None, high: str | None = None, low_at: str | None = None) -> dict[str, object]:
    close = close or balance
    return {"time": time, "balance": D(balance), "close": D(close), "low": D(low or close), "low_at": low_at or time, "high": D(high or close)}


def rules(**overrides: object) -> dict[str, object]:
    return validate_profile({"name": "Test", "account_size": "10000", **overrides})


def run(samples: list[dict[str, object]], **overrides: object) -> dict[str, object]:
    return _check(samples, rules(**overrides), DayBoundary(), D(10000))


# F1: daily loss, touching the limit is a breach
def test_daily_limit_touch_is_a_breach_and_one_cent_short_is_not() -> None:
    limit = {"daily_loss_limit": {"kind": "PERCENT", "value": "5"}}
    touched = run([sample("2026-01-01T00:00:00", "10000"), sample("2026-01-01T12:00:00", "10000", "9800", low="9500.00", low_at="2026-01-01T11:30:00")], **limit)
    assert touched["daily"]["first_breach"] == {"time": "2026-01-01T11:30:00", "day": "2026-01-01", "value": "9500.00", "limit_level": "9500", "loss": "500.00", "limit": "500"}
    short = run([sample("2026-01-01T00:00:00", "10000"), sample("2026-01-01T12:00:00", "10000", "9800", low="9500.01")], **limit)
    assert short["daily"]["first_breach"] is None
    assert short["daily"]["tightest"]["headroom"] == "0.01"
    assert short["daily_table"][0]["broken"] is False


# F2: start-of-day reference variants with floating P/L across midnight
@pytest.mark.parametrize(("reference", "floating_close", "loss"), [
    ("BALANCE", "10200", "250"), ("HIGHER_OF_BALANCE_AND_EQUITY", "10200", "450"), ("EQUITY", "10200", "450"),
    ("BALANCE", "9900", "250"), ("HIGHER_OF_BALANCE_AND_EQUITY", "9900", "250"), ("EQUITY", "9900", "150"),
])
def test_start_of_day_reference(reference: str, floating_close: str, loss: str) -> None:
    samples = [sample("2026-01-01T00:00:00", "10000"), sample("2026-01-01T23:55:00", "10000", floating_close), sample("2026-01-02T09:00:00", "10000", "9800", low="9750")]
    result = run(samples, daily_loss_limit={"kind": "AMOUNT", "value": "1000"}, start_of_day_reference=reference)
    assert result["daily_table"][1]["loss"] == loss


def test_daily_percent_of_start_of_day_reference() -> None:
    samples = [sample("2026-01-01T00:00:00", "10000"), sample("2026-01-01T20:00:00", "12000"), sample("2026-01-02T09:00:00", "11500", low="11400")]
    result = run(samples, daily_loss_limit={"kind": "PERCENT", "value": "5"}, daily_loss_basis="START_OF_DAY_REFERENCE")
    assert result["daily_table"][1]["limit"] == "600"
    assert result["daily"]["first_breach"]["day"] == "2026-01-02"


# F3: overall loss modes
def _overall(mode: str, trailing: str | None = None, low: str = "10200") -> dict[str, object]:
    samples = [sample("2026-01-01T00:00:00", "10000"), sample("2026-01-02T00:00:00", "11500"), sample("2026-01-03T00:00:00", "11500", "10500", low=low)]
    extra = {"trailing_reference": trailing} if trailing else {}
    return run(samples, overall_loss_limit={"kind": "PERCENT", "value": "10"}, overall_loss_mode=mode, **extra)["overall"]


def test_overall_fixed_trailing_and_locking_floor() -> None:
    assert _overall("FIXED")["first_breach"] is None
    assert _overall("FIXED")["tightest"]["headroom"] == "1000"  # the opening sample, 1000 above the fixed floor
    trailing = _overall("TRAILING", "BALANCE_HIGH")
    assert trailing["first_breach"]["limit_level"] == "10500" and trailing["first_breach"]["value"] == "10200"
    assert _overall("TRAILING_LOCKS_AT_START", "BALANCE_HIGH")["first_breach"] is None
    assert _overall("TRAILING_LOCKS_AT_START", "BALANCE_HIGH", low="10000")["first_breach"]["limit_level"] == "10000"


def test_trailing_references() -> None:
    samples = [sample("2026-01-01T00:00:00", "10000"), sample("2026-01-01T10:00:00", "10000", "10400", high="11200"), sample("2026-01-01T11:00:00", "10600"),
               sample("2026-01-01T12:00:00", "10300", low="10150"), sample("2026-01-02T01:00:00", "10300", low="9450")]
    base = {"overall_loss_limit": {"kind": "AMOUNT", "value": "1000"}, "overall_loss_mode": "TRAILING"}
    equity_high = run(samples, **base, trailing_reference="EQUITY_HIGH")["overall"]["first_breach"]
    assert equity_high["limit_level"] == "10200" and equity_high["time"] == "2026-01-01T12:00:00"
    balance_high = run(samples, **base, trailing_reference="BALANCE_HIGH")["overall"]["first_breach"]
    assert balance_high["limit_level"] == "9600" and balance_high["time"] == "2026-01-02T01:00:00"
    end_of_day = run(samples, **base, trailing_reference="END_OF_DAY_BALANCE_HIGH")["overall"]  # the intraday 10600 is gone by the day's end
    assert end_of_day["first_breach"] is None and end_of_day["tightest"]["headroom"] == "150"


# F4: day boundary and reset time
def test_report_clock_midnight_is_the_default() -> None:
    assert DayBoundary().day("2026-01-02T00:00:00") == "2026-01-02"
    assert DayBoundary().day("2026-01-01T23:59:59") == "2026-01-01"


def test_firm_reset_in_another_zone_with_both_dst_changes() -> None:
    boundary = DayBoundary({"kind": "FIRM_RESET", "time": "00:00", "zone": "Europe/Prague"}, "Europe/Athens")
    assert boundary.day("2026-01-10T00:30:00") == "2026-01-09"  # 23:30 in Prague
    assert boundary.day("2026-01-10T01:00:00") == "2026-01-10"
    assert boundary.day("2026-07-10T00:59:59") == "2026-07-09"  # summer: both zones shift together
    assert boundary.day("2026-03-29T03:30:00") == "2026-03-29"  # nonexistent in Athens
    assert boundary.day("2026-10-25T03:30:00") == "2026-10-25"  # ambiguous in Athens
    assert [item["code"] for item in boundary.findings()] == ["REPORT_TIME_NONEXISTENT", "REPORT_TIME_AMBIGUOUS"]


def test_evening_reset_and_fixed_offset_report_clock() -> None:
    boundary = DayBoundary({"kind": "FIRM_RESET", "time": "17:00", "zone": "America/New_York"}, "UTC+02:00")
    assert boundary.day("2026-01-05T23:59:00") == "2026-01-04"  # 16:59 in New York
    assert boundary.day("2026-01-06T00:00:00") == "2026-01-05"  # 17:00 in New York starts the next day
    assert boundary.describe()["report_clock_zone"] == "UTC+02:00"


def test_firm_reset_needs_a_declared_report_clock() -> None:
    with pytest.raises(CoreError) as error:
        DayBoundary({"kind": "FIRM_RESET", "time": "00:00", "zone": "Europe/Prague"})
    assert error.value.code == "E_PROP_CLOCK_UNDECLARED"
    for zone in ("Mars/Olympus", "../etc", "UTC+15:00"):
        with pytest.raises(CoreError) as bad:
            DayBoundary({"kind": "FIRM_RESET", "time": "00:00", "zone": "Europe/Prague"}, zone)
        assert bad.value.code == "E_PROP_ZONE_INVALID"


# F5: portfolio conservative and optimistic combined equity
def _brute(capital: D, tracks: list[list[dict[str, object]]]) -> list[D]:
    grid = sorted({row["time"] for rows in tracks for row in rows})
    lows = []
    for moment in grid:
        total = capital
        for rows in tracks:
            stamped = [row for row in rows if row["time"] == moment]
            later = [row for row in rows if row["time"] > moment]
            if stamped:
                total += min(row["low"] for row in stamped)
            elif moment < rows[0]["time"]:
                total += 0
            elif not later:
                total += rows[-1]["close"]
            else:
                total += later[0]["low"]
        lows.append(total)
    return lows


def test_combined_equity_matches_brute_force() -> None:
    generator = random.Random(20260924)
    for _ in range(25):
        tracks = []
        for _track in range(generator.randint(1, 4)):
            minutes = sorted(generator.sample(range(0, 300), generator.randint(2, 12)))
            rows, value = [], D(0)
            for minute in minutes:
                close = value + D(generator.randint(-50, 50))
                low = min(value, close) - D(generator.randint(0, 30))
                rows.append({"time": f"2026-01-01T{minute // 60:02d}:{minute % 60:02d}:00", "balance": value, "close": close, "low": low, "high": max(value, close) + 5})
                value = close
            tracks.append(rows)
        conservative, optimistic = combine_equity(D(1000), tracks)
        assert [item["low"] for item in conservative] == _brute(D(1000), tracks)
        assert all(low <= opt["low"] for low, opt in zip((item["low"] for item in conservative), optimistic))
        assert optimistic[-1]["close"] == D(1000) + sum((rows[-1]["close"] for rows in tracks), D(0))


# F6–F9: evaluate on real intake, profiles, determinism
def _workspace(tmp_path: Path, logged: bool = True) -> tuple[Path, str]:
    workspace = tmp_path / "workspace"
    ref = str(intake_mt5_report(workspace, str(_report(tmp_path)))["dataset_ref"])
    if logged:
        assert attach_equity_log(workspace, ref, str(_log(tmp_path)), "Every tick based on real ticks")["status"] == "LINKED_VERIFIED"
    return workspace, ref


def _profile(workspace: Path, **overrides: object) -> str:
    return str(save_profile(workspace, {"name": "Sample 10k", "account_size": "10000.00", **overrides})["profile"]["profile_id"])


def test_logged_and_realised_evidence_give_different_breaches(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    profile = _profile(workspace, daily_loss_limit={"kind": "AMOUNT", "value": "100"})
    logged = evaluate(workspace, profile, {"kind": "DATASET", "dataset_ref": ref})
    assert logged["evidence_level"] == "EQUITY_LOGGED" and logged["verdict"] == "BROKEN"
    assert logged["rules"][0]["first_breach"]["time"] == "2026-01-02T10:03:10"

    other = tmp_path / "unlogged"
    other.mkdir()
    realised_ws, realised_ref = _workspace(other, logged=False)
    realised = evaluate(realised_ws, _profile(realised_ws, daily_loss_limit={"kind": "AMOUNT", "value": "100"}), {"kind": "DATASET", "dataset_ref": realised_ref})
    assert realised["evidence_level"] == "REALISED_ONLY"
    assert realised["rules"][0]["first_breach"]["time"] == "2026-01-03T10:00:00"
    assert any(warning.startswith("Optimistic preview") for warning in realised["warnings"])


def test_target_trading_days_calendar_and_challenge_outcome(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    target = {"kind": "DATASET", "dataset_ref": ref}
    base = {"profit_target": {"kind": "PERCENT", "value": "1"}}
    passed = evaluate(workspace, _profile(workspace, **base, minimum_trading_days=3), target)
    assert passed["profit_target"]["time"] == "2026-01-05T10:00:00"
    assert passed["profit_target"]["trading_days"] == 4 and passed["profit_target"]["calendar_days"] == 5
    assert passed["challenge"]["outcome"] == "PASSED"
    assert evaluate(workspace, _profile(workspace, **base, minimum_trading_days=5), target)["challenge"]["outcome"] == "MINIMUM_DAYS_NOT_REACHED"
    assert evaluate(workspace, _profile(workspace, **base, maximum_calendar_days=4), target)["challenge"]["outcome"] == "TOO_SLOW"
    broken = evaluate(workspace, _profile(workspace, **base, daily_loss_limit={"kind": "AMOUNT", "value": "100"}), target)
    assert broken["challenge"]["outcome"] == "BROKEN_BEFORE_PASS"
    assert evaluate(workspace, _profile(workspace, profit_target={"kind": "PERCENT", "value": "5"}), target)["challenge"]["outcome"] == "TARGET_NOT_REACHED"


def test_portfolio_bounds_give_possibly_broken(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    refs = []
    for name, shift in (("A", 0), ("B", 10)):
        folder = tmp_path / name
        folder.mkdir()
        deals = [[*deal[:1], str(int(deal[1]) + shift), *deal[2:]] for deal in DEALS]
        ref = str(intake_mt5_report(workspace, str(_report(folder, deals=deals, expert=f"EA{name}")))["dataset_ref"])
        assert attach_equity_log(workspace, ref, str(_log(folder, expert=f"EA{name}")), "Every tick based on real ticks")["status"] == "LINKED_VERIFIED"
        refs.append(ref)
    profile = str(save_profile(workspace, {"name": "Two EAs", "account_size": "20000", "overall_loss_limit": {"kind": "AMOUNT", "value": "250"}})["profile"]["profile_id"])
    result = evaluate(workspace, profile, {"kind": "COMBINATION", "tracks": [[refs[0]], [refs[1]]]})
    assert result["evidence_level"] == "PORTFOLIO_CONSERVATIVE"
    overall = result["rules"][0]
    assert overall["verdict"] == "POSSIBLY_BROKEN" and result["verdict"] == "POSSIBLY_BROKEN"
    assert overall["first_breach"]["value"] == "19720.00"
    assert overall["optimistic"]["first_breach"] is None and overall["optimistic"]["tightest"]["headroom"] == "48.00"
    assert result["target"]["combination_id"]
    assert [item["code"] for item in result["findings"]] == ["PORTFOLIO_OPENING_COSTS"]
    with pytest.raises(CoreError) as mismatch:
        evaluate(workspace, profile, {"kind": "COMBINATION", "tracks": [[refs[0]], [refs[1]]], "starting_capital": "25000"})
    assert mismatch.value.code == "E_PROP_ACCOUNT_MISMATCH"


def test_profile_validation_and_account_mismatch(tmp_path: Path) -> None:
    for bad in ({"name": "", "account_size": "1"}, {"name": "x", "account_size": "-1", "profit_target": {"kind": "AMOUNT", "value": "1"}},
                {"name": "x", "account_size": "100"}, {"name": "x", "account_size": "100", "daily_loss_limit": {"kind": "PERCENT", "value": "120"}},
                {"name": "x", "account_size": "100", "profit_target": {"kind": "AMOUNT", "value": "1"}, "colour": "red"},
                {"name": "x", "account_size": "100", "profit_target": {"kind": "AMOUNT", "value": "1"}, "trailing_reference": "BALANCE_HIGH"},
                {"name": "x", "account_size": "100", "profit_target": {"kind": "AMOUNT", "value": "1"}, "minimum_trading_days": 0},
                {"name": "x", "account_size": "100", "profit_target": {"kind": "AMOUNT", "value": "1"}, "reset": {"kind": "FIRM_RESET", "time": "25:00", "zone": "UTC"}}):
        with pytest.raises(CoreError) as error:
            validate_profile(bad)
        assert error.value.code == "E_PROP_PROFILE_INVALID"
    workspace, ref = _workspace(tmp_path)
    with pytest.raises(CoreError) as mismatch:
        evaluate(workspace, str(save_profile(workspace, {"name": "5k", "account_size": "5000", "profit_target": {"kind": "AMOUNT", "value": "1"}})["profile"]["profile_id"]), {"kind": "DATASET", "dataset_ref": ref})
    assert mismatch.value.code == "E_PROP_ACCOUNT_MISMATCH"
    firm = str(save_profile(workspace, {"name": "Prague", "account_size": "10000", "daily_loss_limit": {"kind": "AMOUNT", "value": "100"}, "reset": {"kind": "FIRM_RESET", "time": "00:00", "zone": "Europe/Prague"}})["profile"]["profile_id"])
    with pytest.raises(CoreError) as clock:
        evaluate(workspace, firm, {"kind": "DATASET", "dataset_ref": ref})
    assert clock.value.code == "E_PROP_CLOCK_UNDECLARED"
    assert evaluate(workspace, firm, {"kind": "DATASET", "dataset_ref": ref}, "UTC+02:00")["day_boundary"]["zone"] == "Europe/Prague"


def test_profiles_are_content_addressed_never_overwritten_and_deterministic(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    first = save_profile(workspace, {"name": "P", "account_size": "10000.00", "daily_loss_limit": {"kind": "PERCENT", "value": "5.0"}})
    again = save_profile(workspace, {"name": "P", "account_size": "10000", "daily_loss_limit": {"kind": "PERCENT", "value": "5"}})
    assert first["created"] and not again["created"] and again["profile"]["profile_id"] == first["profile"]["profile_id"]
    profile_id = first["profile"]["profile_id"]
    edited = save_profile(workspace, {"name": "P", "account_size": "10000", "daily_loss_limit": {"kind": "PERCENT", "value": "4"}}, supersedes=profile_id)
    assert edited["profile"]["profile_id"] != profile_id and edited["profile"]["supersedes"] == profile_id
    assert len(list_profiles(workspace)["profiles"]) == 2
    target = {"kind": "DATASET", "dataset_ref": ref}
    assert json.dumps(evaluate(workspace, profile_id, target), sort_keys=True) == json.dumps(evaluate(workspace, profile_id, target), sort_keys=True)
    path = workspace / "prop-profiles" / f"{profile_id}.json"
    record = json.loads(path.read_text(encoding="utf-8"))
    record["rules"]["account_size"] = "1"
    path.write_text(json.dumps(record), encoding="utf-8")
    with pytest.raises(CoreError) as tampered:
        evaluate(workspace, profile_id, target)
    assert tampered.value.code == "E_PROP_PROFILE_INVALID"
    assert delete_profile(workspace, profile_id)["deleted"] is True
    with pytest.raises(CoreError):
        evaluate(workspace, profile_id, target)


def test_worker_methods(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    worker = Worker(workspace)
    saved = worker.dispatch({"method": "prop.save_profile", "params": {"profile": {"name": "W", "account_size": "10000", "overall_loss_limit": {"kind": "PERCENT", "value": "10"}}}})
    profile_id = saved["profile"]["profile_id"]
    assert worker.dispatch({"method": "prop.list_profiles", "params": {}})["profiles"][0]["profile_id"] == profile_id
    result = worker.dispatch({"method": "prop.evaluate", "params": {"profile_id": profile_id, "target": {"kind": "DATASET", "dataset_ref": ref}}})
    assert result["verdict"] == "NOT_BROKEN" and result["rules"][0]["tightest"]["headroom"] == "860.00"
    assert worker.dispatch({"method": "prop.delete_profile", "params": {"profile_id": profile_id}})["deleted"] is True


# PROP-2: FTMO presets and the options they need (examples from ftmo.com/en/trading-objectives, 2026-09-24)
from trading_research_core.prop_check import _challenge, _hash, _target  # noqa: E402
from trading_research_core.prop_presets import PRESETS, list_presets  # noqa: E402


def test_presets_are_valid_profiles_with_their_source() -> None:
    assert list_presets()["presets"] == PRESETS and len(PRESETS) == 12 and len({item["preset_id"] for item in PRESETS}) == 12
    for item in PRESETS:
        rules = validate_profile({"name": item["name"], "account_size": "100000", **item["rules"]})
        assert rules["reset"]["kind"] == "FIRM_RESET" and rules["reset"]["time"] == "00:00"
        own_site = {"FTMO": "https://ftmo.com/", "FundedNext": "https://fundednext.com/"}[item["firm"]]
        assert item["source_url"].startswith(own_site) and item["retrieved_at"] == "2026-09-24" and item["not_modelled"]


def test_ftmo_daily_limit_example_below_not_touch() -> None:
    samples = [sample("2026-01-01T00:00:00", "100000"), sample("2026-01-01T23:00:00", "102000"), sample("2026-01-02T12:00:00", "102000", "98000", low="97000.00")]
    base = {"daily_loss_limit": {"kind": "PERCENT", "value": "5"}, "start_of_day_reference": "BALANCE", "limit_touch_counts": False}
    check = lambda items, **extra: _check(items, validate_profile({"name": "F", "account_size": "100000", **base, **extra}), DayBoundary(), D(100000))
    assert check(samples)["daily"]["first_breach"] is None  # the limit for day 2 is 97 000; reaching it is not "below"
    assert check(samples, limit_touch_counts=True)["daily"]["first_breach"]["limit_level"] == "97000"
    samples[-1] = sample("2026-01-02T12:00:00", "102000", "98000", low="96999.99")
    assert check(samples)["daily"]["first_breach"]["time"] == "2026-01-02T12:00:00"


def test_ftmo_one_step_end_of_day_trailing_floor() -> None:
    samples = [sample("2026-01-01T00:00:00", "100000"), sample("2026-01-01T22:00:00", "104000"), sample("2026-01-02T22:00:00", "103000"), sample("2026-01-03T12:00:00", "103000", "99000", low="94000")]
    rules_ = validate_profile({"name": "F1", "account_size": "100000", "overall_loss_limit": {"kind": "PERCENT", "value": "10"}, "overall_loss_mode": "TRAILING", "trailing_reference": "END_OF_DAY_BALANCE_HIGH", "limit_touch_counts": False})
    overall = _check(samples, rules_, DayBoundary(), D(100000))
    assert overall["floors"] == [D(90000), D(90000), D(94000), D(94000)]  # day 3 keeps 94 000: the higher earlier end-of-day balance
    assert overall["overall"]["first_breach"] is None
    assert _check(samples, rules_ | {"limit_touch_counts": True}, DayBoundary(), D(100000))["overall"]["first_breach"]["limit_level"] == "94000"


def _best_day_run(extra_day: bool) -> dict[str, object]:
    balances = ["98000", "108000", "106000", "104000", "110000"] + (["120000"] if extra_day else [])
    samples = [sample("2026-01-01T00:00:00", "100000")] + [sample(f"2026-01-0{day + 1}T20:00:00", value) for day, value in enumerate(balances)]
    rules_ = validate_profile({"name": "B", "account_size": "100000", "profit_target": {"kind": "PERCENT", "value": "10"}, "best_day_max_percent": "50"})
    boundary = DayBoundary()
    days = sorted({boundary.day(item["time"]) for item in samples[1:]})
    target = _target(samples, rules_, D(100000), boundary, days, "2026-01-01")
    return _challenge(rules_, target, samples, [item["time"] for item in samples[1:]], boundary, [], "2026-01-01")


def test_ftmo_best_day_rule_example() -> None:
    blocked = _best_day_run(extra_day=False)
    assert blocked["outcome"] == "BEST_DAY_RULE_NOT_MET"
    assert blocked["best_day"] | {} == {"max_percent": "50", "at": "end of run", "date": "2026-01-02", "best_day_profit": "10000", "positive_days_profit": "16000", "share_percent": "62.50000000"}
    passed = _best_day_run(extra_day=True)
    assert passed["outcome"] == "PASSED" and passed["pass_time"] == "2026-01-06T20:00:00"
    assert passed["best_day"]["share_percent"] == "38.46153846"


def test_trading_days_can_count_opened_positions_only(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    target = {"kind": "DATASET", "dataset_ref": ref}
    opened = evaluate(workspace, _profile(workspace, profit_target={"kind": "PERCENT", "value": "1"}, minimum_trading_days=3, trading_day_definition="POSITION_OPENED"), target)
    assert opened["trading_days"]["total"] == 2 and opened["challenge"]["outcome"] == "MINIMUM_DAYS_NOT_REACHED"
    assert evaluate(workspace, _profile(workspace, profit_target={"kind": "PERCENT", "value": "1"}, minimum_trading_days=3), target)["challenge"]["outcome"] == "PASSED"


def test_preset_origin_is_recorded_and_older_profiles_still_load(tmp_path: Path) -> None:
    workspace, ref = _workspace(tmp_path)
    item = PRESETS[0]
    saved = save_profile(workspace, {"name": item["name"], "account_size": "10000", **item["rules"]}, preset_id=item["preset_id"])["profile"]
    assert saved["values_source"] == "PRESET_EDITABLE" and saved["preset"]["source_url"] == item["source_url"]
    with pytest.raises(CoreError):
        save_profile(workspace, {"name": "x", "account_size": "10000", "profit_target": {"kind": "AMOUNT", "value": "1"}}, preset_id="nope")
    legacy_rules = {key: value for key, value in rules(profit_target={"kind": "AMOUNT", "value": "1"}).items() if key not in {"trading_day_definition", "limit_touch_counts", "best_day_max_percent"}}
    legacy = {"profile_version": "prop-profile-1", "profile_id": "00000000-0000-5000-8000-000000000001", "profile_hash": _hash(legacy_rules), "saved_at": "2026-09-24T00:00:00+00:00", "supersedes": None, "values_source": "USER_SUPPLIED", "rules": legacy_rules}
    (workspace / "prop-profiles" / "00000000-0000-5000-8000-000000000001.json").write_text(json.dumps(legacy), encoding="utf-8")
    assert evaluate(workspace, legacy["profile_id"], {"kind": "DATASET", "dataset_ref": ref})["profile"]["rules"]["limit_touch_counts"] is True


def test_fundednext_presets_follow_the_challenge_terms() -> None:
    by_id = {item["preset_id"]: item["rules"] for item in PRESETS}
    # Terms §5.1–§5.4 (DLL, MLL, minimum Trading Days, Profit Target), retrieved 2026-09-24
    expected = {
        "fundednext-stellar-2step-phase1": ("5", "10", 5, "8"), "fundednext-stellar-2step-phase2": ("5", "10", 5, "5"),
        "fundednext-stellar-1step": ("3", "6", 2, "10"), "fundednext-stellar-lite-phase1": ("4", "8", 5, "8"),
        "fundednext-stellar-lite-phase2": ("4", "8", 5, "4"), "fundednext-evaluation-phase1": ("5", "10", 5, "10"),
        "fundednext-evaluation-phase2": ("5", "10", 5, "5"),
    }
    for preset_id, (daily, overall, days, target) in expected.items():
        rules = by_id[preset_id]
        assert (rules["daily_loss_limit"]["value"], rules["overall_loss_limit"]["value"], rules["minimum_trading_days"], rules["profit_target"]["value"]) == (daily, overall, days, target)
        assert rules["reset"]["zone"] == "Europe/Athens" and rules["limit_touch_counts"] is True and rules["trading_day_definition"] == "DEAL_OPENED_OR_CLOSED"
