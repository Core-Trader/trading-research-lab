"""Tier C2 Van K. Tharp R-multiple metrics (MVP_TIER_C2_VAN_THARP_METRICS.md).

1R is either a user-declared currency amount per close event (USER_SUPPLIED) or
the absolute average verified close-event loss (INFERRED). No MT5-verified
per-trade risk exists in Strategy Tester Excel reports. R-multiples use full
Decimal context precision; outputs are quantised to 8 dp ROUND_HALF_EVEN. No
quality bands, verdicts, or position sizing are produced.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN
from hashlib import sha256
import json

from .errors import CoreError
from .performance_metrics import sqn_statistics
from .trade_analysis import close_event_summary


CALCULATION_VERSION = "mvp-r-multiple-metrics-1"
POLICY_ID = "r-multiple-metrics-v1"
R_SOURCES = {"DECLARED": "USER_SUPPLIED", "AVERAGE_LOSS": "INFERRED"}
BIN_WIDTH = Decimal("0.5")
BIN_LOW = Decimal("-3")
BIN_HIGH = Decimal("5")
OPPORTUNITY_DAYS = Decimal("30")
TOP_EVENTS = 5
_STEP = Decimal("0.00000001")
_ZERO = Decimal("0")


def r_multiple_metrics(dataset: dict[str, object], r_source: str, r_amount: str | None = None) -> dict[str, object]:
    """Return R-multiple distribution metrics for one dataset and one 1R choice."""

    if r_source not in R_SOURCES:
        raise CoreError("E_R_SOURCE_INVALID", "r_source must be DECLARED or AVERAGE_LOSS.")
    summary, rows = close_event_summary(dataset)
    values = [Decimal(str(row["net_pnl"])) for row in rows]
    losses = [value for value in values if value < 0]
    if r_source == "DECLARED":
        one_r = _declared_amount(r_amount)
    else:
        if r_amount is not None:
            raise CoreError("E_R_SOURCE_INVALID", "r_amount is only accepted with the DECLARED source.")
        if not losses:
            raise CoreError("E_R_SOURCE_UNAVAILABLE", "The average-loss 1R proxy needs at least one losing verified close event.")
        one_r = -(sum(losses, _ZERO) / len(losses))
    multiples = [value / one_r for value in values]
    configuration = {
        "policy_id": POLICY_ID,
        "input_basis": "MT5_VERIFIED_CLOSE_EVENTS",
        "r_source": r_source,
        "r_quality": R_SOURCES[r_source],
        "one_r": _q(one_r),
        "stdev": "sample (N - 1)",
        "histogram": "0.5R bins from -3R to +5R, lower-inclusive, with underflow and overflow",
        "opportunity": "close events per 30 report-clock days between first and last close event",
        "quotient_precision": "8dp ROUND_HALF_EVEN",
    }
    count = len(multiples)
    expectancy = sum(multiples, _ZERO) / count if count else None
    opportunity = _opportunity([str(row["timestamp"]) for row in rows])
    return {
        "analysis_basis": "VERIFIED_CLOSE_EVENTS_WITH_" + R_SOURCES[r_source] + "_1R",
        "policy_id": POLICY_ID,
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": summary["dataset_ref"],
        "currency": summary["currency"],
        "configuration": configuration,
        "configuration_hash": _hash(configuration),
        "one_r": _q(one_r),
        "r_quality": R_SOURCES[r_source],
        "close_event_count": count,
        "expectancy_r": None if expectancy is None else _q(expectancy),
        **{f"{key}_r" if key == "standard_deviation" else key: value for key, value in sqn_statistics(multiples).items()},
        "largest_win_r": _q(max(multiples)) if multiples and max(multiples) > 0 else None,
        "largest_loss_r": _q(min(multiples)) if multiples and min(multiples) < 0 else None,
        "opportunity_per_30_days": None if opportunity is None else _q(opportunity),
        "expectunity_r_per_30_days": _q(expectancy * opportunity) if expectancy is not None and opportunity is not None else None,
        "top_events_share_percent": _top_share(values),
        "histogram": _histogram(multiples),
        "warnings": [
            "R-multiples divide verified close-event net P/L by one constant 1R; per-trade initial risk is not available in MT5 Strategy Tester reports.",
            "The average-loss 1R is an inferred proxy." if r_source == "AVERAGE_LOSS" else "The 1R amount is user-supplied.",
            "SQN is shown without a quality band; it describes this historical sample only.",
        ],
    }


def _declared_amount(value: str | None) -> Decimal:
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as error:
        raise CoreError("E_R_SOURCE_INVALID", "r_amount must be a positive decimal amount in the report currency.") from error
    if value is None or not amount.is_finite() or amount <= 0:
        raise CoreError("E_R_SOURCE_INVALID", "r_amount must be a positive decimal amount in the report currency.")
    return amount


def _opportunity(timestamps: list[str]) -> Decimal | None:
    if len(timestamps) < 2:
        return None
    try:
        moments = sorted(datetime.fromisoformat(timestamp) for timestamp in timestamps)
    except ValueError as error:
        raise CoreError("E_DATASET_INVALID", "R-multiple metrics require ISO source timestamps.") from error
    seconds = Decimal(int((moments[-1] - moments[0]).total_seconds()))
    if seconds == 0:
        return None
    return Decimal(len(timestamps)) / (seconds / Decimal(86400)) * OPPORTUNITY_DAYS


def _top_share(values: list[Decimal]) -> dict[str, object]:
    total = sum(values, _ZERO)
    top = sorted((value for value in values if value > 0), reverse=True)[:TOP_EVENTS]
    if total <= 0 or not top:
        return {"value": None, "reason": "NON_POSITIVE_NET", "event_count": len(top)}
    return {"value": _q(sum(top, _ZERO) / total * Decimal(100)), "reason": None, "event_count": len(top)}


def _histogram(multiples: list[Decimal]) -> dict[str, object]:
    bin_count = int((BIN_HIGH - BIN_LOW) / BIN_WIDTH)
    counts = [0] * bin_count
    underflow = overflow = 0
    for value in multiples:
        if value < BIN_LOW:
            underflow += 1
        elif value >= BIN_HIGH:
            overflow += 1
        else:
            counts[int((value - BIN_LOW) / BIN_WIDTH)] += 1
    buckets = [{"lower_r": _plain(BIN_LOW + BIN_WIDTH * index), "upper_r": _plain(BIN_LOW + BIN_WIDTH * (index + 1)), "count": count} for index, count in enumerate(counts)]
    return {"binning": "FIXED_HALF_R_V1", "underflow_count": underflow, "overflow_count": overflow, "buckets": buckets}


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _plain(value: Decimal) -> str:
    return format(value.normalize(), "f")


def _hash(configuration: dict[str, object]) -> str:
    return sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
