"""Prop-firm rule check (PROP_FIRM_SPEC.md, decisions P1–P10).

Checks a past run (one report, or a Portfolio Lab combination) against a
rule profile the user entered. TRL ships no firm presets (P1). The result is
descriptive: it says whether, when, and by how much the run would have broken
the rules, and how close it came otherwise. It does not predict a live
challenge.

Evidence decides the series (spec §4):
- EQUITY_LOGGED: a verified TRL equity log; losses use each interval's
  tick-level equity low.
- PORTFOLIO_CONSERVATIVE: every track has a log. The conservative bound adds
  each track's interval low (the lows may not coincide, so it can only
  overstate a loss); the optimistic bound adds each track's last sampled
  equity. Broken under both = BROKEN, under the conservative only =
  POSSIBLY_BROKEN (P5).
- REALISED_ONLY: closed-deal balance; every result is an optimistic preview
  (PL-006).

All amounts are Decimal; percentages are quantised to 8 dp, half-even.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation
from hashlib import sha256
import json
from pathlib import Path
import re
from typing import Any

from .dataset_store import read_dataset
from .day_boundary import DayBoundary, normalise_spec
from .errors import CoreError
from .identities import stable_uuid


PROFILE_VERSION = "prop-profile-1"
CALCULATION_VERSION = "prop-check-2"
PROFILE_FOLDER = "prop-profiles"
DISPLAY_POINTS = 1500
MAX_NAME = 120
_STEP = Decimal("0.00000001")
_ZERO = Decimal(0)
_HUNDRED = Decimal(100)
_PROFILE_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

DAILY_BASES = {"INITIAL_BALANCE", "START_OF_DAY_REFERENCE"}
START_OF_DAY_REFERENCES = {"BALANCE", "HIGHER_OF_BALANCE_AND_EQUITY", "EQUITY"}
OVERALL_MODES = {"FIXED", "TRAILING", "TRAILING_LOCKS_AT_START"}
TRAILING_REFERENCES = {"BALANCE_HIGH", "EQUITY_HIGH", "END_OF_DAY_BALANCE_HIGH"}
BREACH_ON = {"EQUITY_TOUCH", "BALANCE_CLOSE"}
TRADING_DAY_DEFINITIONS = {"DEAL_OPENED_OR_CLOSED", "POSITION_OPENED"}
PROFILE_FIELDS = {
    "name", "account_size", "daily_loss_limit", "daily_loss_basis", "start_of_day_reference", "overall_loss_limit",
    "overall_loss_mode", "trailing_reference", "profit_target", "minimum_trading_days", "maximum_calendar_days", "reset", "breach_on",
    "trading_day_definition", "limit_touch_counts", "best_day_max_percent",
}


# ---------------------------------------------------------------- profiles

def validate_profile(raw: dict[str, Any]) -> dict[str, Any]:
    """A normalised profile (decimals as strings, defaults filled) or E_PROP_PROFILE_INVALID."""

    if not isinstance(raw, dict):
        raise _invalid("The profile must be an object.")
    unknown = sorted(set(raw) - PROFILE_FIELDS)
    if unknown:
        raise _invalid(f"Unknown profile field(s): {', '.join(unknown)}.")
    name = str(raw.get("name") or "").strip()
    if not 1 <= len(name) <= MAX_NAME:
        raise _invalid(f"The profile needs a name of 1 to {MAX_NAME} characters.")
    account = _positive(raw.get("account_size"), "account_size")
    daily = _limit(raw.get("daily_loss_limit"), "daily_loss_limit")
    overall = _limit(raw.get("overall_loss_limit"), "overall_loss_limit")
    target = _limit(raw.get("profit_target"), "profit_target", allow_over_100=True)
    if daily is None and overall is None and target is None:
        raise _invalid("Enter at least one of: daily loss limit, overall loss limit, profit target.")
    mode = _choice(raw.get("overall_loss_mode"), OVERALL_MODES, "overall_loss_mode", "FIXED")
    trailing = _choice(raw.get("trailing_reference"), TRAILING_REFERENCES, "trailing_reference", "BALANCE_HIGH") if mode != "FIXED" else None
    if mode == "FIXED" and raw.get("trailing_reference") not in (None, ""):
        raise _invalid("trailing_reference applies only to trailing overall-loss modes.")
    return {
        "name": name,
        "account_size": _fmt(account),
        "daily_loss_limit": daily,
        "daily_loss_basis": _choice(raw.get("daily_loss_basis"), DAILY_BASES, "daily_loss_basis", "INITIAL_BALANCE"),
        "start_of_day_reference": _choice(raw.get("start_of_day_reference"), START_OF_DAY_REFERENCES, "start_of_day_reference", "HIGHER_OF_BALANCE_AND_EQUITY"),
        "overall_loss_limit": overall,
        "overall_loss_mode": mode,
        "trailing_reference": trailing,
        "profit_target": target,
        "minimum_trading_days": _count(raw.get("minimum_trading_days"), "minimum_trading_days"),
        "maximum_calendar_days": _count(raw.get("maximum_calendar_days"), "maximum_calendar_days"),
        "reset": normalise_spec(raw.get("reset")),
        "breach_on": _choice(raw.get("breach_on"), BREACH_ON, "breach_on", "EQUITY_TOUCH"),
        "trading_day_definition": _choice(raw.get("trading_day_definition"), TRADING_DAY_DEFINITIONS, "trading_day_definition", "DEAL_OPENED_OR_CLOSED"),
        "limit_touch_counts": _flag(raw.get("limit_touch_counts"), "limit_touch_counts", True),
        "best_day_max_percent": _percent_or_none(raw.get("best_day_max_percent"), "best_day_max_percent"),
    }


def save_profile(workspace_root: Path, profile: dict[str, Any], supersedes: str | None = None, preset_id: str | None = None) -> dict[str, object]:
    """Store a profile, content-addressed; saving identical rules returns the existing one.

    Profiles are never overwritten: an edit is saved as a new profile that
    records the one it `supersedes`.
    """

    rules = validate_profile(profile)
    if supersedes is not None and not _PROFILE_ID.match(str(supersedes)):
        raise _invalid("supersedes must be a saved profile id.")
    origin = None
    if preset_id is not None:
        from .prop_presets import preset

        found = preset(str(preset_id))
        if found is None:
            raise _invalid("Unknown preset.")
        origin = {key: found[key] for key in ("preset_id", "firm", "programme", "phase", "source_url", "retrieved_at")}
    profile_hash = _hash(rules)
    profile_id = stable_uuid("prop-profile", profile_hash)
    folder = workspace_root.resolve() / PROFILE_FOLDER
    path = folder / f"{profile_id}.json"
    if path.is_file():
        return {"profile": json.loads(path.read_text(encoding="utf-8")), "created": False}
    record = {
        "profile_version": PROFILE_VERSION,
        "profile_id": profile_id,
        "profile_hash": profile_hash,
        "saved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "supersedes": supersedes,
        "values_source": "USER_SUPPLIED" if origin is None else "PRESET_EDITABLE",
        "preset": origin,
        "rules": rules,
    }
    folder.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"profile": record, "created": True}


def list_profiles(workspace_root: Path) -> dict[str, object]:
    folder = workspace_root.resolve() / PROFILE_FOLDER
    records = []
    if folder.is_dir():
        for path in sorted(folder.glob("*.json")):
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("profile_version") == PROFILE_VERSION and _PROFILE_ID.match(str(record.get("profile_id", ""))):
                records.append(record)
    records.sort(key=lambda record: (record["rules"]["name"].casefold(), record["saved_at"], record["profile_id"]))
    return {"profile_version": PROFILE_VERSION, "profiles": records}


def delete_profile(workspace_root: Path, profile_id: str) -> dict[str, object]:
    path = _profile_path(workspace_root, profile_id)
    existed = path.is_file()
    if existed:
        path.unlink()
    return {"profile_id": profile_id, "deleted": existed}


def load_profile(workspace_root: Path, profile_id: str) -> dict[str, Any]:
    path = _profile_path(workspace_root, profile_id)
    if not path.is_file():
        raise CoreError("E_PROP_PROFILE_NOT_FOUND", "That prop profile does not exist (it may have been deleted).")
    record = json.loads(path.read_text(encoding="utf-8"))
    if _hash(record["rules"]) != record["profile_hash"]:
        raise CoreError("E_PROP_PROFILE_INVALID", "The stored profile does not match its hash; it was edited outside TRL.")
    return record | {"rules": validate_profile(record["rules"])}


# ---------------------------------------------------------------- evaluation

def evaluate(workspace_root: Path, profile_id: str, target: dict[str, Any], report_clock_zone: str | None = None) -> dict[str, object]:
    """Check one run against one saved profile (spec §5–§6)."""

    root = workspace_root.resolve()
    record = load_profile(root, profile_id)
    rules = record["rules"]
    boundary = DayBoundary(rules["reset"], report_clock_zone)
    account = Decimal(rules["account_size"])
    run = _run(root, target, account)
    breach_on_balance = rules["breach_on"] == "BALANCE_CLOSE"
    variants = []
    for samples in run["variants"]:
        if breach_on_balance:
            samples = [sample | {"low": sample["balance"], "low_at": sample["time"]} for sample in samples]
        variants.append(_check(samples, rules, boundary, account))
    day_events = run["open_times"] if rules["trading_day_definition"] == "POSITION_OPENED" else run["deal_times"]
    trading_days = sorted({boundary.day(moment) for moment in day_events})
    main, optimistic = variants[0], variants[1] if len(variants) > 1 else None

    loss_rules = []
    for key, rule in (("daily", "DAILY_LOSS"), ("overall", "OVERALL_LOSS")):
        if main[key] is None:
            continue
        conservative_breach = main[key]["first_breach"]
        optimistic_breach = None if optimistic is None else optimistic[key]["first_breach"]
        if conservative_breach is None:
            verdict = "NOT_BROKEN"
        elif optimistic is None or optimistic_breach is not None:
            verdict = "BROKEN"
        else:
            verdict = "POSSIBLY_BROKEN"
        entry = {"rule": rule, "verdict": verdict, **main[key]}
        if optimistic is not None:
            entry["optimistic"] = {"first_breach": optimistic_breach, "tightest": optimistic[key]["tightest"]}
        loss_rules.append(entry)
    verdicts = {entry["verdict"] for entry in loss_rules}
    verdict = "BROKEN" if "BROKEN" in verdicts else "POSSIBLY_BROKEN" if "POSSIBLY_BROKEN" in verdicts else "NOT_BROKEN"

    first_day = boundary.day(run["variants"][0][0]["time"])
    target_block = _target(main["samples"], rules, account, boundary, trading_days, first_day)
    challenge = _challenge(rules, target_block, main["samples"], sorted(day_events), boundary, loss_rules, first_day)
    findings = boundary.findings() + run["findings"]
    return {
        "calculation_version": CALCULATION_VERSION,
        "profile": {"profile_id": record["profile_id"], "profile_hash": record["profile_hash"], "name": rules["name"], "saved_at": record["saved_at"], "values_source": record.get("values_source", "USER_SUPPLIED"), "preset": record.get("preset"), "rules": rules},
        "target": run["target"],
        "currency": run["currency"],
        "evidence_level": run["evidence_level"],
        "day_boundary": boundary.describe(),
        "account_size": rules["account_size"],
        "verdict": verdict,
        "rules": loss_rules,
        "profit_target": target_block,
        "trading_days": {"total": len(trading_days), "definition": "days (by the chosen boundary) with at least one position opened" if rules["trading_day_definition"] == "POSITION_OPENED" else "days (by the chosen boundary) with at least one deal opened or closed"},
        "challenge": challenge,
        "daily": main["daily_table"],
        "series": _display(main["samples"], main["floors"]),
        "breach_markers": [{"rule": entry["rule"], "time": entry["first_breach"]["time"]} for entry in loss_rules if entry["first_breach"] is not None],
        "findings": findings,
        "warnings": _warnings(run["evidence_level"], rules),
    }


def _check(samples: list[dict[str, Any]], rules: dict[str, Any], boundary: DayBoundary, account: Decimal) -> dict[str, Any]:
    days = [boundary.day(sample["time"]) for sample in samples]
    references: dict[str, Decimal] = {}
    for index, day in enumerate(days):
        if day not in references:
            source = samples[index - 1] if index > 0 else samples[0]
            references[day] = _reference(source, rules["start_of_day_reference"])

    touch = rules["limit_touch_counts"]
    daily_result = None
    if rules["daily_loss_limit"] is not None:
        lowest: dict[str, tuple[Decimal, str]] = {}
        first_breach = None
        for index, sample in enumerate(samples):
            low_day = boundary.day(sample["low_at"])
            day = low_day if low_day in references else days[index]
            reference = references[day]
            limit = _daily_limit(rules, account, reference)
            if day not in lowest or sample["low"] < lowest[day][0]:
                lowest[day] = (sample["low"], sample["low_at"])
            if first_breach is None and _beyond(reference - sample["low"], limit, touch):
                first_breach = {"time": sample["low_at"], "day": day, "value": _fmt(sample["low"]), "limit_level": _fmt(reference - limit), "loss": _fmt(reference - sample["low"]), "limit": _fmt(limit)}
        table, tightest = [], None
        for day, reference in references.items():
            limit = _daily_limit(rules, account, reference)
            low, low_at = lowest.get(day, (reference, None))
            loss = max(_ZERO, reference - low)
            headroom = limit - loss
            row = {"date": day, "reference": _fmt(reference), "lowest": _fmt(low), "lowest_at": low_at, "loss": _fmt(loss), "limit": _fmt(limit), "headroom": _fmt(headroom), "headroom_percent_of_limit": _q(headroom / limit * _HUNDRED), "broken": _beyond(loss, limit, touch)}
            table.append(row)
            if tightest is None or headroom < Decimal(tightest["headroom"]):
                tightest = {"date": day, "time": low_at, "headroom": row["headroom"], "headroom_percent_of_limit": row["headroom_percent_of_limit"], "loss": row["loss"], "limit": row["limit"]}
        daily_result = {"limit": rules["daily_loss_limit"], "basis": rules["daily_loss_basis"], "first_breach": first_breach, "tightest": tightest}
    else:
        table = []

    overall_result, floors = None, []
    if rules["overall_loss_limit"] is not None:
        limit = _amount(rules["overall_loss_limit"], account)
        mode, trailing = rules["overall_loss_mode"], rules["trailing_reference"]
        high_water = account
        first_breach, tightest = None, None
        for index, sample in enumerate(samples):
            if trailing == "END_OF_DAY_BALANCE_HIGH" and index > 0 and days[index] != days[index - 1]:
                high_water = max(high_water, samples[index - 1]["balance"])
            floor = account - limit if mode == "FIXED" else high_water - limit
            if mode == "TRAILING_LOCKS_AT_START":
                floor = min(floor, account)
            floors.append(floor)
            headroom = sample["low"] - floor
            if first_breach is None and _beyond(-headroom, _ZERO, touch):
                first_breach = {"time": sample["low_at"], "day": days[index], "value": _fmt(sample["low"]), "limit_level": _fmt(floor), "limit": _fmt(limit)}
            if tightest is None or headroom < Decimal(tightest["headroom"]):
                tightest = {"time": sample["low_at"], "headroom": _fmt(headroom), "headroom_percent_of_limit": _q(headroom / limit * _HUNDRED), "floor": _fmt(floor)}
            # the peak of this sample only raises the floor for later samples
            if trailing == "BALANCE_HIGH":
                high_water = max(high_water, sample["balance"])
            elif trailing == "EQUITY_HIGH":
                high_water = max(high_water, sample["high"])
        overall_result = {"limit": rules["overall_loss_limit"], "limit_amount": _fmt(limit), "mode": mode, "trailing_reference": trailing, "first_breach": first_breach, "tightest": tightest}
    return {"daily": daily_result, "overall": overall_result, "daily_table": table, "samples": samples, "floors": floors}


def _target(samples: list[dict[str, Any]], rules: dict[str, Any], account: Decimal, boundary: DayBoundary, trading_days: list[str], first_day: str) -> dict[str, object] | None:
    if rules["profit_target"] is None:
        return None
    amount = _amount(rules["profit_target"], account)
    level = account + amount
    for sample in samples:
        if sample["balance"] >= level:
            day = boundary.day(sample["time"])
            return {"target": rules["profit_target"], "amount": _fmt(amount), "level": _fmt(level), "reached": True, "time": sample["time"], "day": day,
                    "trading_days": sum(1 for item in trading_days if item <= day), "calendar_days": _span(first_day, day), "basis": "closed balance"}
    return {"target": rules["profit_target"], "amount": _fmt(amount), "level": _fmt(level), "reached": False, "time": None, "day": None, "trading_days": None, "calendar_days": None, "basis": "closed balance"}


def _challenge(rules: dict[str, Any], target: dict[str, Any] | None, samples: list[dict[str, Any]], day_events: list[str], boundary: DayBoundary, loss_rules: list[dict[str, Any]], first_day: str) -> dict[str, object] | None:
    """The pass point is the first sample at which every objective holds together:
    closed balance at or above the target, the minimum trading days reached, and
    (when set) the best day at most the allowed share of the positive days' profit.
    Day profit is the closed-balance change since the day's start (spec §5, P7).
    """

    if target is None:
        return None
    required = rules["minimum_trading_days"] or 0
    cap = None if rules["best_day_max_percent"] is None else Decimal(rules["best_day_max_percent"])
    level = Decimal(target["level"])
    seen_days: set[str] = set()
    pointer = 0
    current_day, day_start = None, _ZERO
    done_best: tuple[Decimal, str | None] = (_ZERO, None)
    done_positive = _ZERO
    pass_index, pass_best, target_and_days = None, None, False
    best: dict[str, Any] = {"date": None, "profit": _ZERO, "positive": _ZERO}
    for index, sample in enumerate(samples):
        moment, day = sample["time"], boundary.day(sample["time"])
        while pointer < len(day_events) and day_events[pointer] <= moment:
            seen_days.add(boundary.day(day_events[pointer]))
            pointer += 1
        if day != current_day:
            if current_day is not None:
                closed = samples[index - 1]["balance"] - day_start
                done_positive += max(_ZERO, closed)
                if closed > done_best[0]:
                    done_best = (closed, current_day)
            current_day = day
            day_start = samples[index - 1]["balance"] if index else sample["balance"]
        today = sample["balance"] - day_start
        best = {"date": current_day, "profit": today, "positive": done_positive + max(_ZERO, today)} if today > done_best[0] else {"date": done_best[1], "profit": done_best[0], "positive": done_positive + max(_ZERO, today)}
        if sample["balance"] >= level and len(seen_days) >= required:
            target_and_days = True
            share = None if best["positive"] <= 0 else best["profit"] / best["positive"] * _HUNDRED
            if cap is None or (share is not None and share <= cap):
                pass_index, pass_best = index, best | {"share": share}
                break
    best_block = None
    if cap is not None:
        final_share = None if best["positive"] <= 0 else best["profit"] / best["positive"] * _HUNDRED
        state = pass_best if pass_best is not None else best | {"share": final_share}
        best_block = {"max_percent": rules["best_day_max_percent"], "at": "pass" if pass_best is not None else "end of run", "date": state["date"], "best_day_profit": _fmt(state["profit"]), "positive_days_profit": _fmt(state["positive"]), "share_percent": None if state["share"] is None else _q(state["share"])}
    total_days = len({boundary.day(moment) for moment in day_events})
    days_block = {"required": rules["minimum_trading_days"], "total": total_days, "at_pass": len(seen_days) if pass_index is not None else None, "met": total_days >= required}
    calendar = {"allowed": rules["maximum_calendar_days"], "days_to_pass": None, "met": None}
    base = {"minimum_trading_days": days_block, "maximum_calendar_days": calendar, "best_day": best_block}
    if pass_index is None:
        if not target["reached"]:
            outcome = "TARGET_NOT_REACHED"
        elif not days_block["met"]:
            outcome = "MINIMUM_DAYS_NOT_REACHED"
        elif target_and_days and cap is not None:
            outcome = "BEST_DAY_RULE_NOT_MET"
        else:
            outcome = "OBJECTIVES_NOT_MET_TOGETHER"
        return {"outcome": outcome, "pass_time": None, **base}
    pass_time = samples[pass_index]["time"]
    calendar["days_to_pass"] = _span(first_day, boundary.day(pass_time))
    calendar["met"] = None if rules["maximum_calendar_days"] is None else calendar["days_to_pass"] <= rules["maximum_calendar_days"]
    before = [entry for entry in loss_rules if entry["first_breach"] is not None and entry["first_breach"]["time"] <= pass_time]
    if any(entry["verdict"] == "BROKEN" for entry in before):
        outcome = "BROKEN_BEFORE_PASS"
    elif before:
        outcome = "POSSIBLY_BROKEN_BEFORE_PASS"
    elif calendar["met"] is False:
        outcome = "TOO_SLOW"
    else:
        outcome = "PASSED"
    return {"outcome": outcome, "pass_time": pass_time, **base}


# ---------------------------------------------------------------- runs (series)

def _run(root: Path, target: dict[str, Any], account: Decimal) -> dict[str, Any]:
    if not isinstance(target, dict) or target.get("kind") not in {"DATASET", "COMBINATION"}:
        raise CoreError("E_REQUEST_INVALID", "target must be {kind: DATASET, dataset_ref} or {kind: COMBINATION, tracks, starting_capital?}.")
    if target["kind"] == "DATASET":
        return _dataset_run(root, str(target.get("dataset_ref") or ""), account)
    return _combination_run(root, target.get("tracks"), target.get("starting_capital"), account)


def _dataset_run(root: Path, dataset_ref: str, account: Decimal) -> dict[str, Any]:
    from .intake import get_evidence
    from .trade_analysis import close_event_summary

    dataset = read_dataset(root, dataset_ref)
    events = sorted(dataset["events"], key=lambda event: int(event["source_sequence"]))
    opening = _opening_balance(dataset, events)
    if opening != account:
        raise CoreError("E_PROP_ACCOUNT_MISMATCH", f"The profile's account size ({_fmt(account)}) differs from this report's opening balance ({_fmt(opening)}). TRL does not rescale results (P6): use a profile for {_fmt(opening)}, or a report run on the profile's account size.", details={"account_size": _fmt(account), "opening_balance": _fmt(opening)})
    currency = close_event_summary(dataset)[0]["currency"]
    deal_times = [_iso(event["source_timestamp"]) for event in events if event.get("event_type") in {"POSITION_OPEN", "POSITION_CLOSE"}]
    open_times = [_iso(event["source_timestamp"]) for event in events if event.get("event_type") == "POSITION_OPEN"]
    evidence = get_evidence(root, dataset_ref)
    equity = evidence.get("equity")
    base = {"target": {"kind": "DATASET", "dataset_ref": dataset_ref}, "currency": currency, "deal_times": deal_times, "open_times": open_times}
    if isinstance(equity, dict) and equity.get("status") == "LINKED_VERIFIED":
        rows = _equity_rows(root, evidence)
        findings = [] if "real ticks" in str(equity.get("modelling_mode", "")).lower() else [{"severity": "NOTE", "code": "SYNTHETIC_INTRABAR_PATH", "message": f"The equity log comes from modelling mode '{equity.get('modelling_mode')}', not real ticks, so intrabar lows are approximate."}]
        samples = [{"time": row["time"], "balance": row["balance"], "close": row["equity_close"], "low": row["equity_min"], "low_at": row["equity_min_time"], "high": row["equity_max"]} for row in rows]
        return base | {"evidence_level": "EQUITY_LOGGED", "variants": [samples], "findings": findings}
    samples = _balance_samples(events, opening)
    return base | {"evidence_level": "REALISED_ONLY", "variants": [samples], "findings": []}


def _combination_run(root: Path, tracks: Any, starting_capital: Any, account: Decimal) -> dict[str, Any]:
    from .intake import get_evidence
    from .portfolio_lab import combine

    capital = account if starting_capital in (None, "") else _positive(starting_capital, "starting_capital")
    if capital != account:
        raise CoreError("E_PROP_ACCOUNT_MISMATCH", f"The combination's starting capital ({_fmt(capital)}) differs from the profile's account size ({_fmt(account)}). TRL does not rescale results (P6).", details={"account_size": _fmt(account), "starting_capital": _fmt(capital)})
    combined = combine(root, tracks, _fmt(capital), "UNION")
    ordered = [list(track["dataset_refs"]) for track in combined["tracks"]]
    target = {"kind": "COMBINATION", "combination_id": combined["combination_id"], "tracks": ordered, "starting_capital": _fmt(capital)}
    deal_times, open_times = [], []
    for refs in ordered:
        for ref in refs:
            for event in read_dataset(root, ref)["events"]:
                if event.get("event_type") in {"POSITION_OPEN", "POSITION_CLOSE"}:
                    deal_times.append(_iso(event["source_timestamp"]))
                if event.get("event_type") == "POSITION_OPEN":
                    open_times.append(_iso(event["source_timestamp"]))
    base = {"target": target, "currency": combined["currency"], "deal_times": sorted(deal_times), "open_times": sorted(open_times)}
    evidences = [[get_evidence(root, ref) for ref in refs] for refs in ordered]
    logged = all(isinstance(item.get("equity"), dict) and item["equity"].get("status") == "LINKED_VERIFIED" for refs in evidences for item in refs)
    if not logged:
        samples = [{"time": _iso(point["timestamp"]), "balance": Decimal(point["balance"]), "close": Decimal(point["balance"]), "low": Decimal(point["balance"]), "low_at": _iso(point["timestamp"]), "high": Decimal(point["balance"])} for point in combined["combined_balance"]]
        missing = sum(1 for refs in evidences for item in refs if not (isinstance(item.get("equity"), dict) and item["equity"].get("status") == "LINKED_VERIFIED"))
        return base | {"evidence_level": "REALISED_ONLY", "variants": [samples], "findings": [{"severity": "NOTE", "code": "PORTFOLIO_EQUITY_INCOMPLETE", "message": f"{missing} report(s) in this combination have no verified equity log, so the whole combination is checked on closed balance only (E6)."}]}
    contributions = [_track_contribution(root, refs, items) for refs, items in zip(ordered, evidences)]
    conservative, optimistic = combine_equity(capital, contributions)
    findings = []
    closed = capital + Decimal(combined["net_pnl"])
    if conservative[-1]["balance"] != closed:
        findings.append({"severity": "NOTE", "code": "PORTFOLIO_OPENING_COSTS", "message": f"The equity logs end at a combined balance of {_fmt(conservative[-1]['balance'])}; Portfolio Lab's close-event total gives {_fmt(closed)}. The difference ({_fmt(conservative[-1]['balance'] - closed)}) is costs charged on opening deals, such as entry commission, which the logs include and the close-event basis does not. This check uses the logs."})
    return base | {"evidence_level": "PORTFOLIO_CONSERVATIVE", "variants": [conservative, optimistic], "findings": findings}


def _track_contribution(root: Path, refs: list[str], evidences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One track's rows as P/L relative to its start; chained reports continue from the previous result."""

    rows_out: list[dict[str, Any]] = []
    offset = _ZERO
    for evidence in evidences:
        rows = _equity_rows(root, evidence)
        initial = rows[0]["balance"]
        for row in rows:
            rows_out.append({"time": row["time"], "balance": row["balance"] - initial + offset, "close": row["equity_close"] - initial + offset, "low": row["equity_min"] - initial + offset, "high": row["equity_max"] - initial + offset})
        offset += rows[-1]["equity_close"] - initial
    return rows_out


def combine_equity(capital: Decimal, tracks: list[list[dict[str, Any]]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Conservative and optimistic combined equity on the union of all row times (E6).

    For each bucket (previous grid time, t], a track contributes the low of
    the row interval covering it (or the lowest of its rows stamped exactly
    t): nothing before its first row, its final result after its last. The
    conservative low adds these; the optimistic value adds each track's last
    sampled equity at t. Balance adds each track's last known balance.
    """

    grid = sorted({row["time"] for rows in tracks for row in rows})
    count = len(tracks)
    pointer = [0] * count
    finals = [rows[-1]["close"] for rows in tracks]
    last_close = [_ZERO] * count
    last_balance = [_ZERO] * count
    conservative, optimistic = [], []
    for moment in grid:
        low_sum = high_sum = _ZERO
        for index, rows in enumerate(tracks):
            start = pointer[index]
            end = start
            while end < len(rows) and rows[end]["time"] == moment:
                end += 1
            if end > start:
                stamped = rows[start:end]
                low, high = min(row["low"] for row in stamped), max(row["high"] for row in stamped)
                last_close[index], last_balance[index] = stamped[-1]["close"], stamped[-1]["balance"]
                pointer[index] = end
            elif start == 0:
                low = high = _ZERO
            elif start >= len(rows):
                low = high = finals[index]
            else:
                low, high = rows[start]["low"], rows[start]["high"]
            low_sum += low
            high_sum += high
        balance = capital + sum(last_balance, _ZERO)
        close = capital + sum(last_close, _ZERO)
        conservative.append({"time": moment, "balance": balance, "close": close, "low": capital + low_sum, "low_at": moment, "high": capital + high_sum})
        optimistic.append({"time": moment, "balance": balance, "close": close, "low": close, "low_at": moment, "high": close})
    return conservative, optimistic


def _equity_rows(root: Path, evidence: dict[str, Any]) -> list[dict[str, Any]]:
    import pyarrow.parquet as pq

    target = root / "datasets" / str(evidence["source_sha256"]) / "equity" / str(evidence["equity"]["log_sha256"])
    rows = pq.read_table(target / "equity.parquet").to_pylist()
    return [{key: (Decimal(value) if key in {"balance", "equity_close", "equity_min", "equity_max"} else value) for key, value in row.items()} for row in rows]


def _balance_samples(events: list[dict[str, Any]], opening: Decimal) -> list[dict[str, Any]]:
    samples = []
    for event in events:
        if event.get("reported_balance") in (None, ""):
            continue
        balance = Decimal(str(event["reported_balance"]))
        moment = _iso(event["source_timestamp"])
        samples.append({"time": moment, "balance": balance, "close": balance, "low": balance, "low_at": moment, "high": balance})
    if not samples:
        raise CoreError("E_DATASET_INVALID", "The report has no balances to check.")
    if samples[0]["balance"] != opening:
        samples.insert(0, samples[0] | {"balance": opening, "close": opening, "low": opening, "high": opening})
    return samples


def _opening_balance(dataset: dict[str, Any], events: list[dict[str, Any]]) -> Decimal:
    first = events[0] if events else None
    if first is not None and first.get("event_type") == "OPENING_BALANCE" and first.get("reported_balance") not in (None, ""):
        return Decimal(str(first["reported_balance"]))
    settings = dict(dataset.get("metadata", {}).get("settings") or {})
    deposit = str(settings.get("Initial Deposit", "")).replace(" ", "").replace(" ", "")
    try:
        return Decimal(deposit)
    except InvalidOperation as error:
        raise CoreError("E_PROP_ACCOUNT_UNKNOWN", "The report has no opening balance to compare with the profile's account size.") from error


# ---------------------------------------------------------------- helpers

def _display(samples: list[dict[str, Any]], floors: list[Decimal]) -> list[dict[str, object]]:
    """At most DISPLAY_POINTS points: each bucket keeps its lowest low, its first floor, and its last balance/equity."""

    size = max(1, -(-len(samples) // DISPLAY_POINTS))
    points = []
    for start in range(0, len(samples), size):
        bucket = samples[start:start + size]
        points.append({
            "time": bucket[-1]["time"], "balance": _fmt(bucket[-1]["balance"]), "equity": _fmt(bucket[-1]["close"]),
            "low": _fmt(min(sample["low"] for sample in bucket)), "floor": _fmt(floors[start]) if floors else None,
        })
    return points


def _warnings(evidence_level: str, rules: dict[str, Any]) -> list[str]:
    items = ["The rules are the values you entered; TRL does not know any firm's current terms. This checks a past run and does not predict a live challenge."]
    if evidence_level == "REALISED_ONLY":
        items.append("Optimistic preview (closed trades only): floating losses between trades are not visible, so a run shown here as not broken may have broken an equity-based rule.")
    elif evidence_level == "PORTFOLIO_CONSERVATIVE":
        items.append("Portfolio equity: the conservative bound adds each report's lowest equity in each interval even if the lows happened at different moments, so it can overstate a loss; the optimistic bound uses the sampled equity only.")
    else:
        items.append("Equity from the TRL tester logger: each interval's low is the lowest tick-level equity inside it.")
    if rules["reset"]["kind"] == "REPORT_CLOCK_MIDNIGHT":
        items.append("Day = the report clock's midnight (broker server time). Check that this matches your firm's reset time.")
    items.append("A loss exactly equal to a limit counts as a breach." if rules["limit_touch_counts"] else "Only a loss beyond a limit counts as a breach; exactly reaching it does not.")
    return items


def _beyond(loss: Decimal, limit: Decimal, touch: bool) -> bool:
    return loss >= limit if touch else loss > limit


def _flag(value: Any, field: str, default: bool) -> bool:
    if value in (None, ""):
        return default
    if not isinstance(value, bool):
        raise _invalid(f"{field} must be true or false.")
    return value


def _percent_or_none(value: Any, field: str) -> str | None:
    if value in (None, ""):
        return None
    number = _positive(value, field)
    if number > _HUNDRED:
        raise _invalid(f"{field} cannot exceed 100%.")
    return _fmt(number)


def _reference(sample: dict[str, Any], kind: str) -> Decimal:
    if kind == "BALANCE":
        return sample["balance"]
    if kind == "EQUITY":
        return sample["close"]
    return max(sample["balance"], sample["close"])


def _daily_limit(rules: dict[str, Any], account: Decimal, reference: Decimal) -> Decimal:
    limit = rules["daily_loss_limit"]
    if limit["kind"] == "AMOUNT":
        return Decimal(limit["value"])
    base = reference if rules["daily_loss_basis"] == "START_OF_DAY_REFERENCE" else account
    return base * Decimal(limit["value"]) / _HUNDRED


def _amount(limit: dict[str, str], account: Decimal) -> Decimal:
    return Decimal(limit["value"]) if limit["kind"] == "AMOUNT" else account * Decimal(limit["value"]) / _HUNDRED


def _span(first_day: str, last_day: str) -> int:
    return (date.fromisoformat(last_day) - date.fromisoformat(first_day)).days + 1


def _limit(value: Any, field: str, allow_over_100: bool = False) -> dict[str, str] | None:
    if value in (None, ""):
        return None
    if not isinstance(value, dict) or set(value) != {"kind", "value"} or value["kind"] not in {"AMOUNT", "PERCENT"}:
        raise _invalid(f"{field} must be {{kind: AMOUNT or PERCENT, value}}.")
    amount = _positive(value["value"], field)
    if value["kind"] == "PERCENT" and amount > _HUNDRED and not allow_over_100:
        raise _invalid(f"{field} cannot exceed 100%.")
    return {"kind": value["kind"], "value": _fmt(amount)}


def _positive(value: Any, field: str) -> Decimal:
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as error:
        raise _invalid(f"{field} must be a positive number.") from error
    if not number.is_finite() or number <= 0:
        raise _invalid(f"{field} must be a positive number.")
    return number.normalize()


def _count(value: Any, field: str) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise _invalid(f"{field} must be a whole number of at least 1.")
    return value


def _choice(value: Any, allowed: set[str], field: str, default: str) -> str:
    if value in (None, ""):
        return default
    if value not in allowed:
        raise _invalid(f"{field} must be one of: {', '.join(sorted(allowed))}.")
    return str(value)


def _profile_path(workspace_root: Path, profile_id: str) -> Path:
    if not isinstance(profile_id, str) or not _PROFILE_ID.match(profile_id):
        raise CoreError("E_PROP_PROFILE_NOT_FOUND", "Unknown prop profile id.")
    return workspace_root.resolve() / PROFILE_FOLDER / f"{profile_id}.json"


def _iso(value: object) -> str:
    return datetime.fromisoformat(str(value)).isoformat()


def _invalid(message: str) -> CoreError:
    return CoreError("E_PROP_PROFILE_INVALID", message)


def _hash(value: object) -> str:
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _fmt(value: Decimal) -> str:
    return format(value, "f")
