"""Cost breakdown of one report (PROPOSAL_COST_BREAKDOWN.md C1-C4).

Every imported deal keeps its profit, commission, and swap. This splits them:
- trade result before costs (profit on all trade deals);
- commissions charged on opening deals and on closing deals;
- swaps charged (negative) and credited (positive);
and reconciles opening balance + all components with the final reported
balance, to the cent. Close-event metrics elsewhere use the closing deal only,
so amounts on opening deals (usually commissions) are reported here as
"not in per-trade figures". MT5 can charge commission per deal or per lot, at
entry and/or exit (MT5 Help: Strategy Testing). Nothing is reallocated.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any

from .errors import CoreError
from .identities import stable_uuid
from .trade_analysis import _currency, _dataset_parts


CALCULATION_VERSION = "cost-breakdown-1"
_STEP = Decimal("0.00000001")
_ZERO = Decimal("0")
_TRADE_EVENTS = {"POSITION_OPEN", "POSITION_CLOSE"}


def _d(value: object) -> Decimal:
    return _ZERO if value in (None, "") else Decimal(str(value))


def _fmt(value: Decimal) -> str:
    return format(value, "f")


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _empty() -> dict[str, Any]:
    return {"trade_result": _ZERO, "commission_open": _ZERO, "commission_close": _ZERO, "swap_charged": _ZERO, "swap_credited": _ZERO,
            "volume": _ZERO, "closed_trades": 0}


def _add(bucket: dict[str, Any], event: dict[str, Any]) -> None:
    opening = event["event_type"] == "POSITION_OPEN"
    swap = _d(event.get("source_swap"))
    bucket["trade_result"] += _d(event.get("source_profit"))
    bucket["commission_open" if opening else "commission_close"] += _d(event.get("source_commission"))
    bucket["swap_charged" if swap < 0 else "swap_credited"] += swap
    bucket["volume"] += _d(event.get("volume"))
    if not opening:
        bucket["closed_trades"] += 1


def _row(bucket: dict[str, Any]) -> dict[str, Any]:
    commissions = bucket["commission_open"] + bucket["commission_close"]
    swaps = bucket["swap_charged"] + bucket["swap_credited"]
    costs = -(commissions + swaps)  # positive when the account paid
    result = bucket["trade_result"]
    return {
        "trade_result_before_costs": _fmt(result),
        "commission_open": _fmt(bucket["commission_open"]),
        "commission_close": _fmt(bucket["commission_close"]),
        "swap_charged": _fmt(bucket["swap_charged"]),
        "swap_credited": _fmt(bucket["swap_credited"]),
        "commissions": _fmt(commissions),
        "swaps": _fmt(swaps),
        "net": _fmt(result + commissions + swaps),
        "costs": _fmt(costs),
        "cost_share_percent": _q(costs / result * 100) if result > 0 and costs > 0 else None,  # none when swaps credited exceed costs
        "closed_trades": bucket["closed_trades"],
        "volume": _fmt(bucket["volume"]),
    }


def cost_breakdown(dataset: dict[str, object]) -> dict[str, object]:
    metadata, events = _dataset_parts(dataset)
    if not events:
        raise CoreError("E_DATASET_INVALID", "Canonical dataset has no events.")
    opening = _d(events[0]["reported_balance"])
    final = _d(events[-1]["reported_balance"])
    total, by_symbol, by_month = _empty(), {}, {}
    excluded = _ZERO  # amounts on opening deals: not in close-event (per-trade) figures
    for event in events:
        if event.get("event_type") not in _TRADE_EVENTS:
            continue
        _add(total, event)
        _add(by_symbol.setdefault(str(event.get("symbol") or "—"), _empty()), event)
        _add(by_month.setdefault(str(event["source_timestamp"])[:7], _empty()), event)
        if event["event_type"] == "POSITION_OPEN":
            excluded += _d(event.get("source_profit")) + _d(event.get("source_commission")) + _d(event.get("source_swap"))
    summary = _row(total)
    commissions = total["commission_open"] + total["commission_close"]
    computed_final = opening + total["trade_result"] + commissions + total["swap_charged"] + total["swap_credited"]
    difference = final - computed_final
    closed = total["closed_trades"]
    costs = Decimal(summary["costs"])
    source = metadata.get("source") if isinstance(metadata.get("source"), dict) else {}
    dataset_ref = str(metadata.get("dataset_ref"))
    return {
        "calculation_version": CALCULATION_VERSION,
        "evaluation_id": stable_uuid("cost-breakdown", dataset_ref, CALCULATION_VERSION),
        "dataset_ref": dataset_ref,
        "currency": _currency(metadata),
        "source_filename": source.get("filename"),
        "summary": summary,
        "reconciliation": {"opening_balance": _fmt(opening), "computed_final": _fmt(computed_final), "reported_final": _fmt(final),
                           "difference": _fmt(difference), "status": "MATCHES" if difference == 0 else "DIFFERS"},
        "per_trade_exclusion": {"amount": _fmt(excluded), "per_closed_trade": _q(excluded / closed) if closed else None,
                                "opening_commission": _fmt(total["commission_open"])},
        "intensity": {
            "cost_per_closed_trade": _q(costs / closed) if closed else None,
            "commission_per_lot": _q(-commissions / total["volume"]) if total["volume"] > 0 else None,
            "cost_share_percent": summary["cost_share_percent"],
        },
        "by_symbol": [{"symbol": key, **_row(value)} for key, value in sorted(by_symbol.items())],
        "by_month": [{"month": key, **_row(value)} for key, value in sorted(by_month.items())],
        "warnings": [
            "Per-trade figures (win rate, expectancy, SQN, significance) use the closing deal only; amounts on opening deals appear here instead.",
            "Commission per lot counts the volume of both opening and closing deals.",
            "Spread and slippage are inside the prices and are not listed in MT5 reports, so they are not in these costs.",
        ],
    }


def cost_note(result: dict[str, object], reason: str) -> dict[str, str]:
    """Markdown for "Costs checked" in an Experiment note (C5)."""
    summary, intensity, reconciliation = result["summary"], result["intensity"], result["reconciliation"]
    currency = result["currency"] or ""
    commissions = Decimal(summary["commission_open"]) + Decimal(summary["commission_close"])
    swaps = Decimal(summary["swap_charged"]) + Decimal(summary["swap_credited"])
    lines = [
        "### Costs checked",
        "",
        f"- Report: `{result['dataset_ref']}`",
        f"- Trade result before costs: {summary['trade_result_before_costs']} {currency}; commissions {_fmt(commissions)} (opening {summary['commission_open']}, closing {summary['commission_close']}); swaps {_fmt(swaps)}; net {summary['net']} {currency}",
        f"- Reconciliation with the final balance: {'matches' if reconciliation['status'] == 'MATCHES' else 'differs by ' + reconciliation['difference']}",
        f"- Average cost per closed trade: {intensity['cost_per_closed_trade'] or '—'} {currency}; commission per lot: {intensity['commission_per_lot'] or '—'} {currency}"
        + (f"; costs take {intensity['cost_share_percent']} % of the result before costs" if intensity["cost_share_percent"] else ""),
        f"- Not in per-trade figures (opening deals): {result['per_trade_exclusion']['amount']} {currency}",
        f"- Your conclusion: {reason.strip() or '(none given)'}",
        f"- Calculation: `{result['calculation_version']}`, `{result['evaluation_id']}`",
    ]
    return {"record_id": str(result["evaluation_id"]), "markdown": "\n".join(lines)}
