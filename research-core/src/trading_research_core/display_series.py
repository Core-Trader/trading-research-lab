"""MVP dashboard display series derived from verified close events.

Every value is an exact Decimal sum of verified close-event net P/L
(profit + commission + swap). Grouping uses the MT5 report timestamp exactly as
supplied (source-reported clock); no timezone conversion is performed. Balance
operations (deposits, withdrawals, credits) are not close events and are
excluded. The output is bounded display data; it writes no artifact and does
not modify the canonical dataset.
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import date, datetime
from decimal import Decimal
from hashlib import sha256
import json

from .errors import CoreError
from .trade_analysis import close_event_summary


CALCULATION_VERSION = "mvp-close-event-display-series-1"
POLICY_ID = "close-event-display-series-v1"
TIME_BASIS = "SOURCE_REPORTED_CLOCK"
MAX_EVENT_BARS = 2_000


def close_event_display_series(dataset: dict[str, object]) -> dict[str, object]:
    """Return per-event, daily, ISO-weekly, monthly, and yearly close-event P/L."""

    summary, rows = close_event_summary(dataset)
    ordered = sorted(rows, key=lambda row: int(row["source_sequence"]))
    configuration = {
        "policy_id": POLICY_ID,
        "input_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "value": "net_pnl = profit + commission + swap",
        "time_basis": TIME_BASIS,
        "day": "report timestamp date",
        "week": "ISO 8601 week (Monday start) of the report date",
        "max_event_bars": MAX_EVENT_BARS,
    }

    daily: OrderedDict[str, _Bucket] = OrderedDict()
    weekly: OrderedDict[tuple[int, int], _Bucket] = OrderedDict()
    monthly: OrderedDict[str, _Bucket] = OrderedDict()
    yearly: OrderedDict[int, _Bucket] = OrderedDict()
    for row in ordered:
        day = _report_date(row)
        value = Decimal(str(row["net_pnl"]))
        iso = day.isocalendar()
        for buckets, key in ((daily, day.isoformat()), (weekly, (iso.year, iso.week)), (monthly, f"{day.year:04d}-{day.month:02d}"), (yearly, day.year)):
            buckets.setdefault(key, _Bucket()).add(value)

    events_included = len(ordered) <= MAX_EVENT_BARS
    return {
        "analysis_basis": "VERIFIED_CLOSE_EVENTS",
        "policy_id": POLICY_ID,
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": summary["dataset_ref"],
        "currency": summary["currency"],
        "time_basis": TIME_BASIS,
        "configuration": configuration,
        "configuration_hash": _configuration_hash(configuration),
        "close_event_count": len(ordered),
        "events": [
            {"source_sequence": int(row["source_sequence"]), "timestamp": str(row["timestamp"]), "symbol": str(row["symbol"]), "net_pnl": str(row["net_pnl"])}
            for row in ordered
        ] if events_included else None,
        "events_omitted_reason": None if events_included else f"More than {MAX_EVENT_BARS} close events; per-event bars are omitted rather than downsampled.",
        "daily": [{"date": key, **bucket.as_dict()} for key, bucket in sorted(daily.items())],
        "weekly": [{"iso_year": key[0], "iso_week": key[1], **bucket.as_dict()} for key, bucket in sorted(weekly.items())],
        "monthly": [{"month": key, **bucket.as_dict()} for key, bucket in sorted(monthly.items())],
        "yearly": [{"year": key, **bucket.as_dict()} for key, bucket in sorted(yearly.items())],
        "warnings": [
            "Values are sums of verified close-event net P/L (profit + commission + swap); balance operations are excluded.",
            "Days, weeks, months, and years use the MT5 report timestamp as supplied; no timezone conversion was performed.",
            "This is realised close-event P/L, not intratrade equity or account-balance change.",
        ],
    }


class _Bucket:
    __slots__ = ("net_pnl", "count", "wins", "losses")

    def __init__(self) -> None:
        self.net_pnl = Decimal("0")
        self.count = 0
        self.wins = 0
        self.losses = 0

    def add(self, value: Decimal) -> None:
        self.net_pnl += value
        self.count += 1
        if value > 0:
            self.wins += 1
        elif value < 0:
            self.losses += 1

    def as_dict(self) -> dict[str, object]:
        return {"net_pnl": format(self.net_pnl, "f"), "close_event_count": self.count, "win_count": self.wins, "loss_count": self.losses}


def _report_date(row: dict[str, object]) -> date:
    timestamp = str(row.get("timestamp") or "")
    try:
        return datetime.fromisoformat(timestamp).date()
    except ValueError as error:
        raise CoreError("E_DATASET_INVALID", "Display series require ISO source timestamps.", details={"source_sequence": row.get("source_sequence")}) from error


def _configuration_hash(configuration: dict[str, object]) -> str:
    canonical = json.dumps(configuration, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(canonical.encode("utf-8")).hexdigest().upper()
