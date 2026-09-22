"""Tier C1 performance metrics (MVP_TIER_C_PERFORMANCE_METRICS.md).

Balance-basis metrics use the reported balance series in source order, starting
with the single opening balance. Close-event metrics use verified close-event
net P/L (profit + commission + swap). Monetary sums stay exact; quotients are
quantised to 8 decimal places with ROUND_HALF_EVEN. Report timestamps are used
as supplied (source-reported clock). No artifact is written.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_HALF_EVEN
from hashlib import sha256
import json
from typing import Any

from .errors import CoreError
from .trade_analysis import close_event_summary


CALCULATION_VERSION = "mvp-performance-metrics-1"
POLICY_ID = "performance-metrics-v1"
TIME_BASIS = "SOURCE_REPORTED_CLOCK"
_QUOTIENT_STEP = Decimal("0.00000001")
_ZERO = Decimal("0")
_HUNDRED = Decimal("100")


def performance_metrics(dataset: dict[str, object]) -> dict[str, object]:
    """Return approved C1 balance and close-event metrics for one dataset."""

    points = _balance_points(dataset)
    summary, close_rows = close_event_summary(dataset)
    configuration = {
        "policy_id": POLICY_ID,
        "balance_basis": "REPORTED_BALANCE_SOURCE_ORDER",
        "close_event_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "time_basis": TIME_BASIS,
        "new_high": "strictly greater than the previous high-water mark",
        "drawdown_percent_denominator": "high-water mark at the trough",
        "stagnation_measures": "report-clock duration and close-event count",
        "profit_factor_without_losses": "null (NO_LOSSES)",
        "quotient_precision": "8dp ROUND_HALF_EVEN",
    }
    return {
        "analysis_basis": "REPORTED_BALANCE_AND_VERIFIED_CLOSE_EVENTS",
        "policy_id": POLICY_ID,
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": summary["dataset_ref"],
        "currency": summary["currency"],
        "time_basis": TIME_BASIS,
        "configuration": configuration,
        "configuration_hash": _configuration_hash(configuration),
        "balance_metrics": _balance_metrics(points),
        "drawdown_series": _drawdown_series(points),
        "stagnation": _stagnation(points),
        "close_event_metrics": _close_event_metrics([Decimal(str(row["net_pnl"])) for row in close_rows], [int(row["source_sequence"]) for row in close_rows]),
        "warnings": [
            "Drawdown and stagnation use reported (realised) balances only; intratrade equity is unavailable.",
            "Close-event metrics use verified close-event net P/L (profit + commission + swap).",
            "Report timestamps are used as supplied; no timezone conversion was performed.",
        ],
    }


def _balance_points(dataset: dict[str, object]) -> list[dict[str, Any]]:
    events_value = dataset.get("events")
    if not isinstance(events_value, list) or not events_value:
        raise CoreError("E_DATASET_INVALID", "Performance metrics require a non-empty canonical dataset.")
    events = sorted(events_value, key=lambda event: int(event["source_sequence"]))
    openings = [event for event in events if event.get("event_type") == "OPENING_BALANCE"]
    if len(openings) != 1 or events[0].get("event_type") != "OPENING_BALANCE":
        raise CoreError("E_DATASET_INVALID", "Performance metrics require exactly one opening balance as the first event.")
    points = []
    for event in events:
        timestamp = str(event.get("source_timestamp") or "")
        try:
            moment = datetime.fromisoformat(timestamp)
        except ValueError as error:
            raise CoreError("E_DATASET_INVALID", "Performance metrics require ISO source timestamps.", details={"source_sequence": event.get("source_sequence")}) from error
        points.append({
            "source_sequence": int(event["source_sequence"]),
            "timestamp": timestamp,
            "moment": moment,
            "balance": Decimal(str(event["reported_balance"])),
            "is_close": event.get("event_type") == "POSITION_CLOSE",
        })
    return points


def _balance_metrics(points: list[dict[str, Any]]) -> dict[str, object]:
    high = points[0]["balance"]
    maximum_drawdown = _ZERO
    trough_index: int | None = None
    trough_high = high
    for index, point in enumerate(points):
        high = max(high, point["balance"])
        drawdown = high - point["balance"]
        if drawdown > maximum_drawdown:
            maximum_drawdown, trough_index, trough_high = drawdown, index, high
    change = points[-1]["balance"] - points[0]["balance"]
    result: dict[str, object] = {
        "opening_balance": _fmt(points[0]["balance"]),
        "final_balance": _fmt(points[-1]["balance"]),
        "balance_change": _fmt(change),
        "maximum_drawdown": _fmt(maximum_drawdown),
        "maximum_drawdown_percent": None,
        "peak": None,
        "trough": None,
        "recovery": None,
        "recovery_status": None,
        "return_to_drawdown": None,
        "return_to_drawdown_reason": "NO_DRAWDOWN",
    }
    if trough_index is None:
        return result
    peak_index = next(index for index in range(trough_index + 1) if points[index]["balance"] == trough_high)
    recovery_index = next((index for index in range(trough_index + 1, len(points)) if points[index]["balance"] >= trough_high), None)
    result.update({
        "maximum_drawdown_percent": _q(maximum_drawdown / trough_high * _HUNDRED) if trough_high > 0 else None,
        "peak": _point_ref(points[peak_index]),
        "trough": _point_ref(points[trough_index]),
        "recovery": None if recovery_index is None else _point_ref(points[recovery_index]),
        "recovery_status": "NOT_RECOVERED" if recovery_index is None else "RECOVERED",
        "return_to_drawdown": _q(change / maximum_drawdown),
        "return_to_drawdown_reason": None,
    })
    return result


def _drawdown_series(points: list[dict[str, Any]]) -> list[dict[str, object]]:
    high = points[0]["balance"]
    series = []
    for point in points:
        high = max(high, point["balance"])
        drawdown = high - point["balance"]
        series.append({
            "source_sequence": point["source_sequence"],
            "timestamp": point["timestamp"],
            "drawdown": _fmt(drawdown),
            "drawdown_percent": _q(drawdown / high * _HUNDRED) if high > 0 else None,
        })
    return series


def _stagnation(points: list[dict[str, Any]]) -> dict[str, object]:
    periods: list[dict[str, Any]] = []
    start = 0
    high = points[0]["balance"]
    for index in range(1, len(points)):
        if points[index]["balance"] > high:
            periods.append({"start": start, "end": index, "ongoing": False})
            start, high = index, points[index]["balance"]
    periods.append({"start": start, "end": len(points) - 1, "ongoing": True})
    total_seconds = int((points[-1]["moment"] - points[0]["moment"]).total_seconds())
    for period in periods:
        period["seconds"] = int((points[period["end"]]["moment"] - points[period["start"]]["moment"]).total_seconds())
        period["close_events"] = sum(1 for point in points[period["start"] + 1:period["end"] + 1] if point["is_close"])
    by_time = max(periods, key=lambda period: (period["seconds"], -period["start"]))
    by_events = max(periods, key=lambda period: (period["close_events"], -period["start"]))
    ongoing = periods[-1]

    def describe(period: dict[str, Any]) -> dict[str, object]:
        return {
            "start": _point_ref(points[period["start"]]),
            "end": _point_ref(points[period["end"]]),
            "status": "ONGOING" if period["ongoing"] else "ENDED_BY_NEW_HIGH",
            "duration_seconds": period["seconds"],
            "duration_days": _q(Decimal(period["seconds"]) / Decimal(86400)),
            "share_of_report_period_percent": _q(Decimal(period["seconds"]) / Decimal(total_seconds) * _HUNDRED) if total_seconds > 0 else None,
            "close_events": period["close_events"],
        }

    return {
        "period_count": len(periods),
        "longest_by_time": describe(by_time),
        "longest_by_close_events": describe(by_events),
        "ongoing": describe(ongoing),
    }


def _close_event_metrics(values: list[Decimal], sequences: list[int]) -> dict[str, object]:
    count = len(values)
    wins = [value for value in values if value > 0]
    losses = [value for value in values if value < 0]
    gross_profit = sum(wins, _ZERO)
    gross_loss = sum(losses, _ZERO)
    if count == 0:
        profit_factor, profit_factor_reason = None, "NO_CLOSE_EVENTS"
    elif gross_loss == 0:
        profit_factor, profit_factor_reason = None, "NO_LOSSES"
    else:
        profit_factor, profit_factor_reason = _q(gross_profit / -gross_loss), None
    average_win = gross_profit / len(wins) if wins else None
    average_loss = gross_loss / len(losses) if losses else None
    return {
        "close_event_count": count,
        "net_pnl": _fmt(sum(values, _ZERO)),
        "gross_profit": _fmt(gross_profit),
        "gross_loss": _fmt(gross_loss),
        "profit_factor": profit_factor,
        "profit_factor_reason": profit_factor_reason,
        "average_win": None if average_win is None else _q(average_win),
        "average_loss": None if average_loss is None else _q(average_loss),
        "payoff_ratio": _q(average_win / -average_loss) if average_win is not None and average_loss is not None else None,
        "expectancy": _q(sum(values, _ZERO) / count) if count else None,
        "longest_winning_streak": _longest_streak(values, sequences, lambda value: value > 0),
        "longest_losing_streak": _longest_streak(values, sequences, lambda value: value < 0),
    }


def _longest_streak(values: list[Decimal], sequences: list[int], predicate: Any) -> dict[str, object]:
    best: tuple[int, int] | None = None
    run_start: int | None = None
    for index, value in enumerate(values + [None]):  # type: ignore[list-item]
        if value is not None and predicate(value):
            if run_start is None:
                run_start = index
            continue
        if run_start is not None:
            length = index - run_start
            if best is None or length > best[1] - best[0]:
                best = (run_start, index)
            run_start = None
    if best is None:
        return {"count": 0, "net_pnl": None, "first_source_sequence": None, "last_source_sequence": None}
    first, end = best
    return {
        "count": end - first,
        "net_pnl": _fmt(sum(values[first:end], _ZERO)),
        "first_source_sequence": sequences[first],
        "last_source_sequence": sequences[end - 1],
    }


def _point_ref(point: dict[str, Any]) -> dict[str, object]:
    return {"source_sequence": point["source_sequence"], "timestamp": point["timestamp"], "balance": _fmt(point["balance"])}


def _q(value: Decimal) -> str:
    return format(value.quantize(_QUOTIENT_STEP, rounding=ROUND_HALF_EVEN), "f")


def _fmt(value: Decimal) -> str:
    return format(value, "f")


def _configuration_hash(configuration: dict[str, object]) -> str:
    canonical = json.dumps(configuration, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(canonical.encode("utf-8")).hexdigest().upper()
