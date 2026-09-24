"""Rolling start dates for the prop-firm check (PROP_FIRM_SPEC.md P8).

For every day of the run, the challenge is started at that day's first
sample and followed until its first decision: passed, broken, out of time,
or the data ends. Each start shifts the run so that it begins at the
profile's account size: profit and loss are not rescaled (P6), so lots stay
as tested. Compounding EAs sized their lots on the backtest balance of that
day, which is flagged.

Starts share one history and overlap, so the pass share describes this run
under these rules; it is not an independent probability.

Speed: days in which no breach and no pass is possible (checked from the
day's lowest low, highest balance, and highest equity) are stepped over
whole; other days are scanned sample by sample with the same rules as
`prop.evaluate`. As in evaluate, an interval's low counts on the day of its
own timestamp: an interval that spans the reset charges its low to the
previous day's limit. Days holding such an interval are always scanned.
"""

from __future__ import annotations

from bisect import bisect_left
from decimal import Decimal
from pathlib import Path
from typing import Any

from .day_boundary import DayBoundary
from .errors import CoreError
from .prop_check import _amount, _beyond, _daily_limit, _q, _run, _span, load_profile


ROLLING_VERSION = "prop-rolling-2"
DEFAULT_SURVIVAL_DAYS = 30
_ZERO = Decimal(0)
_HUNDRED = Decimal(100)


def rolling_starts(workspace_root: Path, profile_id: str, target: dict[str, Any], report_clock_zone: str | None = None, survival_days: int | None = None) -> dict[str, object]:
    root = workspace_root.resolve()
    _check_survival(survival_days)
    record = load_profile(root, profile_id)
    phase = _Phase(record, root, target, report_clock_zone, survival_days)
    rules, boundary, run, horizon = phase.rules, phase.boundary, phase.run, phase.horizon
    has_target = rules["profit_target"] is not None
    starts = [phase.follow(index) for index in range(len(phase.context.days))]
    return {
        "calculation_version": ROLLING_VERSION,
        "profile": {"profile_id": record["profile_id"], "profile_hash": record["profile_hash"], "name": rules["name"]},
        "target": run["target"],
        "currency": run["currency"],
        "evidence_level": run["evidence_level"],
        "day_boundary": boundary.describe(),
        "horizon_days": horizon,
        "mode": "CHALLENGE" if has_target else "SURVIVAL",
        "summary": _summary(starts, has_target),
        "starts": starts,
        "findings": boundary.findings() + run["findings"],
        "warnings": [
            "Each start shifts the run to begin at the account size; profit and loss are not rescaled and lots are as tested. An EA that sizes lots from its balance traded that day on the backtest balance, not the account size.",
            "Starts overlap and share one history, so the pass share describes this run under these rules. It is not an independent probability of passing.",
            "A start that inherits open positions begins with their floating profit or loss.",
        ],
    }


def _check_survival(survival_days: Any) -> None:
    if survival_days is not None and (not isinstance(survival_days, int) or isinstance(survival_days, bool) or survival_days < 1):
        raise CoreError("E_REQUEST_INVALID", "survival_days must be a whole number of at least 1.")


class _Phase:
    """One profile applied to one run: the conservative context and, for portfolios, the optimistic one."""

    def __init__(self, record: dict[str, Any], root: Path, target: dict[str, Any], report_clock_zone: str | None, survival_days: int | None) -> None:
        self.record = record
        self.rules = rules = record["rules"]
        self.boundary = DayBoundary(rules["reset"], report_clock_zone)
        self.account = Decimal(rules["account_size"])
        self.run = _run(root, target, self.account)
        variants = self.run["variants"]
        if rules["breach_on"] == "BALANCE_CLOSE":
            variants = [[sample | {"low": sample["balance"], "low_at": sample["time"]} for sample in samples] for samples in variants]
        events = sorted(self.run["open_times"] if rules["trading_day_definition"] == "POSITION_OPENED" else self.run["deal_times"])
        has_target = rules["profit_target"] is not None
        self.horizon = rules["maximum_calendar_days"] if rules["maximum_calendar_days"] is not None else (None if has_target else survival_days or DEFAULT_SURVIVAL_DAYS)
        self.context = _Context(variants[0], self.boundary, events, rules, self.account, self.horizon)
        self.optimistic = _Context(variants[1], self.boundary, events, rules, self.account, self.horizon) if len(variants) > 1 else None

    def follow(self, index: int) -> dict[str, object]:
        result = self.context.follow(index)
        if self.optimistic is not None and result["outcome"] == "BROKEN":
            other = self.optimistic.follow(index)
            if other["outcome"] != "BROKEN":
                result = result | {"outcome": "POSSIBLY_BROKEN", "optimistic_outcome": other["outcome"]}
        return result

    def first_day_after(self, moment: str) -> int | None:
        """Index of the first day with data after the day containing `moment` (the next phase starts on a new day)."""

        after = self.boundary.day(moment)
        return next((index for index, info in enumerate(self.context.days) if info["day"] > after), None)


CHAIN_VERSION = "prop-chain-1"
MAX_PHASES = 3


def chain_starts(workspace_root: Path, profile_ids: list[str], target: dict[str, Any], report_clock_zone: str | None = None, survival_days: int | None = None) -> dict[str, object]:
    """A multi-phase challenge from every start day: phase 1, then (after a pass) the next
    phase from the next day with data as a fresh account, and so on (P8 follow-up).
    """

    root = workspace_root.resolve()
    _check_survival(survival_days)
    if not isinstance(profile_ids, list) or not 2 <= len(profile_ids) <= MAX_PHASES or not all(isinstance(item, str) for item in profile_ids):
        raise CoreError("E_PROP_CHAIN_INVALID", f"A challenge chain needs 2 to {MAX_PHASES} profiles, in order.")
    records = [load_profile(root, profile_id) for profile_id in profile_ids]
    if any(record["rules"]["profit_target"] is None for record in records[:-1]):
        raise CoreError("E_PROP_CHAIN_INVALID", "Every phase except the last needs a profit target; otherwise it can never pass on to the next phase.")
    if len({Decimal(record["rules"]["account_size"]) for record in records}) != 1:
        raise CoreError("E_PROP_CHAIN_INVALID", "All phases must use the same account size (results are not rescaled).")
    phases = [_Phase(record, root, target, report_clock_zone, survival_days) for record in records]
    starts = []
    for index in range(len(phases[0].context.days)):
        steps: list[dict[str, object]] = []
        position: int | None = index
        for number, phase in enumerate(phases, start=1):
            assert position is not None
            step = phase.follow(position) | {"phase": number}
            steps.append(step)
            if step["outcome"] not in {"PASSED", "SURVIVED"} or number == len(phases):
                break
            next_phase = phases[number]
            position = next_phase.first_day_after(str(step["decided_at"]))
            if position is None:
                steps.append({"phase": number + 1, "outcome": "NOT_DECIDED", "rule": None, "decided_at": None, "decided_day": None, "calendar_days": 0, "start_day": None, "start_time": None, "open_at_start": False})
                break
        last = steps[-1]
        complete = len(steps) == len(phases) and last["outcome"] in {"PASSED", "SURVIVED"}
        if complete:
            outcome = "COMPLETED"
        elif last["outcome"] == "NOT_DECIDED":
            outcome = "NOT_DECIDED"
        elif last["outcome"] == "POSSIBLY_BROKEN":
            outcome = "POSSIBLY_FAILED"
        else:
            outcome = "FAILED"
        decided_day = last.get("decided_day")
        starts.append({
            "start_day": steps[0]["start_day"], "start_time": steps[0]["start_time"], "open_at_start": steps[0]["open_at_start"],
            "outcome": outcome, "failed_phase": None if outcome in {"COMPLETED", "NOT_DECIDED"} else last["phase"],
            "calendar_days": _span(str(steps[0]["start_day"]), str(decided_day)) if decided_day else None, "phases": steps,
        })
    first = phases[0]
    counts: dict[str, int] = {}
    failed_by_phase: dict[str, int] = {}
    for item in starts:
        counts[item["outcome"]] = counts.get(item["outcome"], 0) + 1
        if item["failed_phase"] is not None:
            failed_by_phase[str(item["failed_phase"])] = failed_by_phase.get(str(item["failed_phase"]), 0) + 1
    decided = len(starts) - counts.get("NOT_DECIDED", 0)
    return {
        "calculation_version": CHAIN_VERSION,
        "profiles": [{"profile_id": record["profile_id"], "profile_hash": record["profile_hash"], "name": record["rules"]["name"], "horizon_days": phase.horizon} for record, phase in zip(records, phases)],
        "target": first.run["target"],
        "currency": first.run["currency"],
        "evidence_level": first.run["evidence_level"],
        "summary": {
            "starts": len(starts), "decided": decided, "counts": counts, "failed_by_phase": failed_by_phase,
            "completed_share_percent": None if decided == 0 else _q(Decimal(counts.get("COMPLETED", 0)) / Decimal(decided) * _HUNDRED),
            "days_to_complete": _spread(sorted(item["calendar_days"] for item in starts if item["outcome"] == "COMPLETED")),
            "open_at_start": sum(1 for item in starts if item["open_at_start"]),
        },
        "starts": starts,
        "findings": first.boundary.findings() + first.run["findings"],
        "warnings": [
            "Each phase after a pass starts on the next day with data, as a fresh account at the account size. Positions the EA still held carry over in the backtest; a real new account would start flat.",
            "Starts overlap and share one history, so the completed share describes this run under these rules. It is not an independent probability.",
            "Each phase is shifted to begin at the account size; profit and loss are not rescaled.",
        ],
    }


class _Context:
    def __init__(self, samples: list[dict[str, Any]], boundary: DayBoundary, events: list[str], rules: dict[str, Any], account: Decimal, horizon: int | None) -> None:
        self.samples, self.rules, self.account, self.horizon, self.boundary = samples, rules, account, horizon, boundary
        self.touch = rules["limit_touch_counts"]
        self.fast = True  # tests switch the day-level shortcut off to compare against a full scan
        self.days: list[dict[str, Any]] = []
        for index, sample in enumerate(samples):
            day = boundary.day(sample["time"])
            if not self.days or self.days[-1]["day"] != day:
                self.days.append({"day": day, "a": index, "b": index, "min_low": sample["low"], "max_balance": sample["balance"], "max_high": sample["high"], "spans": False})
            info = self.days[-1]
            if boundary.day(sample["low_at"]) != day:
                info["spans"] = True
            info["b"] = index
            info["min_low"] = min(info["min_low"], sample["low"])
            info["max_balance"] = max(info["max_balance"], sample["balance"])
            info["max_high"] = max(info["max_high"], sample["high"])
        self.event_days: list[str] = sorted({boundary.day(moment) for moment in events})
        self.first_event: dict[str, str] = {}
        for moment in events:
            self.first_event.setdefault(boundary.day(moment), moment)
        self.overall = None if rules["overall_loss_limit"] is None else _amount(rules["overall_loss_limit"], account)
        self.level = None if rules["profit_target"] is None else account + _amount(rules["profit_target"], account)
        self.required = rules["minimum_trading_days"] or 0
        self.cap = None if rules["best_day_max_percent"] is None else Decimal(rules["best_day_max_percent"])

    def _floor(self, high_water: Decimal) -> Decimal:
        assert self.overall is not None
        floor = self.account - self.overall if self.rules["overall_loss_mode"] == "FIXED" else high_water - self.overall
        return min(floor, self.account) if self.rules["overall_loss_mode"] == "TRAILING_LOCKS_AT_START" else floor

    def follow(self, start: int) -> dict[str, object]:
        rules, samples, days = self.rules, self.samples, self.days
        first = days[start]["a"]
        reference_sample = samples[first - 1] if first > 0 else samples[first]
        shift = self.account - reference_sample["balance"]
        start_day = days[start]["day"]
        base = {"start_day": start_day, "start_time": samples[first]["time"], "open_at_start": reference_sample["close"] != reference_sample["balance"]}
        before = bisect_left(self.event_days, start_day)
        trailing = rules["trailing_reference"]
        high_water = self.account
        best_profit, positive = _ZERO, _ZERO
        previous = reference_sample
        prior: tuple[str, Decimal, Decimal | None] | None = None  # the previous day of this start: label, reference, daily limit

        def decided(outcome: str, moment: str, day: str, rule: str | None = None) -> dict[str, object]:
            return base | {"outcome": outcome, "rule": rule, "decided_at": moment, "decided_day": day, "calendar_days": _span(start_day, day)}

        for position in range(start, len(days)):
            info = days[position]
            day = info["day"]
            if self.horizon is not None and _span(start_day, day) > self.horizon:
                last = days[position - 1]
                return decided("OUT_OF_TIME" if self.level is not None else "SURVIVED", samples[last["b"]]["time"], last["day"])
            if position > start and trailing == "END_OF_DAY_BALANCE_HIGH":
                high_water = max(high_water, previous["balance"] + shift)
            day_reference = _start_reference(previous, rules["start_of_day_reference"]) + shift
            day_start = previous["balance"] + shift
            daily_limit = None if rules["daily_loss_limit"] is None else _daily_limit(rules, self.account, day_reference)
            days_before = bisect_left(self.event_days, day) - before
            low = info["min_low"] + shift
            interesting = daily_limit is not None and _beyond(day_reference - low, daily_limit, self.touch)
            if self.overall is not None and not interesting:
                top = high_water
                if trailing == "BALANCE_HIGH":
                    top = max(top, info["max_balance"] + shift)
                elif trailing == "EQUITY_HIGH":
                    top = max(top, info["max_high"] + shift)
                interesting = _beyond(self._floor(top) - low, _ZERO, self.touch)
            if self.level is not None and info["max_balance"] + shift >= self.level:
                interesting = True
            if info["spans"]:
                interesting = True
            if interesting or not self.fast:
                event_time = self.first_event.get(day)
                for index in range(info["a"], info["b"] + 1):
                    sample = samples[index]
                    sample_low = sample["low"] + shift
                    reference, limit = day_reference, daily_limit
                    if info["spans"] and prior is not None and self.boundary.day(sample["low_at"]) == prior[0]:
                        reference, limit = prior[1], prior[2]
                    if limit is not None and _beyond(reference - sample_low, limit, self.touch):
                        return decided("BROKEN", sample["low_at"], day, "DAILY_LOSS")
                    if self.overall is not None:
                        if _beyond(self._floor(high_water) - sample_low, _ZERO, self.touch):
                            return decided("BROKEN", sample["low_at"], day, "OVERALL_LOSS")
                        if trailing == "BALANCE_HIGH":
                            high_water = max(high_water, sample["balance"] + shift)
                        elif trailing == "EQUITY_HIGH":
                            high_water = max(high_water, sample["high"] + shift)
                    if self.level is not None:
                        balance = sample["balance"] + shift
                        trading_days = days_before + (1 if event_time is not None and event_time <= sample["time"] else 0)
                        if balance >= self.level and trading_days >= self.required and self._best_ok(best_profit, positive, balance - day_start):
                            return decided("PASSED", sample["time"], day)
            else:
                if trailing == "BALANCE_HIGH":
                    high_water = max(high_water, info["max_balance"] + shift)
                elif trailing == "EQUITY_HIGH":
                    high_water = max(high_water, info["max_high"] + shift)
            prior = (day, day_reference, daily_limit)
            previous = samples[info["b"]]
            closed = previous["balance"] + shift - day_start
            positive += max(_ZERO, closed)
            best_profit = max(best_profit, closed)
        last = days[-1]
        return base | {"outcome": "NOT_DECIDED", "rule": None, "decided_at": None, "decided_day": None, "calendar_days": _span(start_day, last["day"])}

    def _best_ok(self, best_before: Decimal, positive_before: Decimal, today: Decimal) -> bool:
        if self.cap is None:
            return True
        positive = positive_before + max(_ZERO, today)
        return positive > 0 and max(best_before, today) / positive * _HUNDRED <= self.cap


def _start_reference(sample: dict[str, Any], kind: str) -> Decimal:
    if kind == "BALANCE":
        return sample["balance"]
    if kind == "EQUITY":
        return sample["close"]
    return max(sample["balance"], sample["close"])


def _summary(starts: list[dict[str, Any]], has_target: bool) -> dict[str, object]:
    counts: dict[str, int] = {}
    for item in starts:
        counts[item["outcome"]] = counts.get(item["outcome"], 0) + 1
    decided = len(starts) - counts.get("NOT_DECIDED", 0)
    good = counts.get("PASSED" if has_target else "SURVIVED", 0)
    to_pass = sorted(item["calendar_days"] for item in starts if item["outcome"] == "PASSED")
    to_breach = sorted(item["calendar_days"] for item in starts if item["outcome"] in {"BROKEN", "POSSIBLY_BROKEN"})
    return {
        "starts": len(starts),
        "decided": decided,
        "counts": counts,
        "success_outcome": "PASSED" if has_target else "SURVIVED",
        "success_share_percent": None if decided == 0 else _q(Decimal(good) / Decimal(decided) * _HUNDRED),
        "days_to_pass": _spread(to_pass),
        "days_to_breach": _spread(to_breach),
        "open_at_start": sum(1 for item in starts if item["open_at_start"]),
    }


def _spread(values: list[int]) -> dict[str, int] | None:
    if not values:
        return None
    return {"minimum": values[0], "median": values[(len(values) + 1) // 2 - 1], "maximum": values[-1]}  # nearest-rank median

