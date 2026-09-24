"""Extra execution costs per lot (PROPOSAL_EXECUTION_COSTS.md X1-X3).

Every parameter is optional. With none, only the break-even extra cost is
reported. Otherwise each opening and closing deal pays
`(extra spread + slippage per lot) x its volume`, with optional per-symbol
overrides, in account currency.

- Balance path: every reported balance minus the charges so far; maximum
  drawdown is measured on it as in performance metrics (peak to trough).
- Per-trade metrics (profit factor, win rate, expectancy): closing-deal net
  P/L minus a round-turn charge on the closed volume (opening plus closing),
  as positions close the volume they opened. The page states this.
- Break-even: the extra cost per lot per deal at which the balance change
  reaches zero, net / lots dealt (exact, since the cost is linear).
- Points to money (helper): points x point size / tick size x tick value,
  derived from MT5's contract-specification definitions (tick size: minimum
  price change step; tick value: cost of one such change).

Delay is not modelled (MT5 simulates it with ticks in the tester).
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN
from typing import Any

from .errors import CoreError
from .identities import stable_uuid
from .trade_analysis import _currency, _dataset_parts


CALCULATION_VERSION = "execution-costs-1"
_STEP = Decimal("0.00000001")
_ZERO = Decimal("0")


def _d(value: object) -> Decimal:
    return _ZERO if value in (None, "") else Decimal(str(value))


def _fmt(value: Decimal) -> str:
    return format(value, "f")


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _amount(value: object, name: str) -> Decimal | None:
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as error:
        raise CoreError("E_EXECUTION_COST_INVALID", f"{name} must be a non-negative amount.") from error
    if not parsed.is_finite() or parsed < 0:
        raise CoreError("E_EXECUTION_COST_INVALID", f"{name} must be a non-negative amount.")
    return parsed


def points_to_money(points: str, point_size: str, tick_size: str, tick_value: str) -> dict[str, str]:
    """Money per 1.0 lot for a price move of `points`, from MT5's contract specification."""
    values = {name: _amount(value, name) for name, value in (("points", points), ("point_size", point_size), ("tick_size", tick_size), ("tick_value", tick_value))}
    if any(value is None for value in values.values()) or values["tick_size"] == 0 or values["point_size"] == 0:
        raise CoreError("E_EXECUTION_COST_INVALID", "Enter points, point size, tick size and tick value (tick size and point size above zero).")
    money = values["points"] * values["point_size"] / values["tick_size"] * values["tick_value"]
    return {"money_per_lot": _q(money), "formula": "points x point size / tick size x tick value"}


def _metrics(values: list[Decimal]) -> dict[str, Any]:
    wins = [value for value in values if value > 0]
    losses = [value for value in values if value < 0]
    gross_loss = -sum(losses, _ZERO)
    return {
        "net": _fmt(sum(values, _ZERO)),
        "profit_factor": _q(sum(wins, _ZERO) / gross_loss) if gross_loss > 0 else None,
        "win_rate_percent": _q(Decimal(len(wins)) / Decimal(len(values)) * 100) if values else None,
        "expectancy": _q(sum(values, _ZERO) / len(values)) if values else None,
        "wins": len(wins), "losses": len(losses), "breakeven": len(values) - len(wins) - len(losses),
    }


def _max_drawdown(balances: list[Decimal]) -> Decimal:
    peak, worst = balances[0], _ZERO
    for balance in balances:
        peak = max(peak, balance)
        worst = max(worst, peak - balance)
    return worst


def execution_cost_scenario(dataset: dict[str, object], extra_spread_per_lot: str | None = None, slippage_per_lot: str | None = None,
                            per_symbol: dict[str, dict[str, str | None]] | None = None) -> dict[str, object]:
    metadata, events = _dataset_parts(dataset)
    if not events:
        raise CoreError("E_DATASET_INVALID", "Canonical dataset has no events.")
    spread, slippage = _amount(extra_spread_per_lot, "extra spread per lot"), _amount(slippage_per_lot, "slippage per lot")
    overrides: dict[str, Decimal] = {}
    for symbol, values in (per_symbol or {}).items():
        if not isinstance(values, dict):
            raise CoreError("E_EXECUTION_COST_INVALID", "per_symbol values must be objects with spread and slippage.")
        symbol_spread, symbol_slippage = _amount(values.get("spread"), f"{symbol} spread"), _amount(values.get("slippage"), f"{symbol} slippage")
        if symbol_spread is not None or symbol_slippage is not None:
            overrides[symbol] = (symbol_spread if symbol_spread is not None else spread or _ZERO) + (symbol_slippage if symbol_slippage is not None else slippage or _ZERO)
    default_rate = (spread or _ZERO) + (slippage or _ZERO)
    applied = default_rate > 0 or any(rate > 0 for rate in overrides.values())

    opening = _d(events[0]["reported_balance"])
    final = _d(events[-1]["reported_balance"])
    lots = _ZERO
    charged = _ZERO
    before_path, after_path = [opening], [opening]
    closes_before: list[Decimal] = []
    closes_after: list[Decimal] = []
    round_turn = _ZERO
    by_symbol: dict[str, dict[str, Decimal]] = {}
    for event in events:
        kind = event.get("event_type")
        if kind not in {"POSITION_OPEN", "POSITION_CLOSE"}:
            continue
        symbol = str(event.get("symbol") or "—")
        volume = _d(event.get("volume"))
        rate = overrides.get(symbol, default_rate)
        charge = rate * volume
        lots += volume
        charged += charge
        entry = by_symbol.setdefault(symbol, {"lots": _ZERO, "charge": _ZERO, "rate": rate})
        entry["lots"] += volume
        entry["charge"] += charge
        before_path.append(_d(event["reported_balance"]))
        after_path.append(_d(event["reported_balance"]) - charged)
        if kind == "POSITION_CLOSE":
            net = _d(event.get("source_profit")) + _d(event.get("source_commission")) + _d(event.get("source_swap"))
            closes_before.append(net)
            closes_after.append(net - 2 * rate * volume)  # round turn on the closed volume
            round_turn += 2 * rate * volume

    net_before = final - opening
    break_even = _q(net_before / lots) if lots > 0 and net_before > 0 else None
    dataset_ref = str(metadata["dataset_ref"])
    configuration = {"extra_spread_per_lot": None if spread is None else _fmt(spread), "slippage_per_lot": None if slippage is None else _fmt(slippage),
                     "per_symbol": {symbol: _fmt(rate) for symbol, rate in sorted(overrides.items())}}
    return {
        "calculation_version": CALCULATION_VERSION,
        "evaluation_id": stable_uuid("execution-costs", dataset_ref, CALCULATION_VERSION, repr(sorted(configuration["per_symbol"].items())), configuration["extra_spread_per_lot"] or "none", configuration["slippage_per_lot"] or "none"),
        "dataset_ref": dataset_ref,
        "currency": _currency(metadata),
        "configuration": configuration,
        "applied": applied,
        "lots_dealt": _fmt(lots),
        "break_even_per_lot": break_even,
        "before": {"balance_change": _fmt(net_before), "max_drawdown": _fmt(_max_drawdown(before_path)), "closed_trades": _metrics(closes_before)},
        "after": None if not applied else {"balance_change": _fmt(net_before - charged), "extra_cost_total": _fmt(charged),
                                           "max_drawdown": _fmt(_max_drawdown(after_path)), "closed_trades": _metrics(closes_after)},
        "by_symbol": [{"symbol": symbol, "lots": _fmt(value["lots"]), "rate_per_lot": _fmt(value["rate"]), "charge": _fmt(value["charge"])} for symbol, value in sorted(by_symbol.items())],
        # Per-trade metrics charge round turns on closed volume; this equals the per-deal total when opened and closed volumes match.
        "round_turn_check": {"per_deal_total": _fmt(charged), "round_turn_total": _fmt(round_turn), "consistent": round_turn == charged},
        "warnings": [
            "Every parameter is your own assumption, in account currency per 1.0 lot per deal; nothing is charged when they are empty.",
            "Per-trade metrics charge each closed volume a round turn (opening and closing deal), since positions close the volume they opened.",
            "Execution delay is not modelled here; MT5 simulates delays with ticks in the Strategy Tester.",
            "Tests on real ticks already paid the recorded spread; these costs come on top.",
        ],
    }


def execution_cost_note(result: dict[str, object], reason: str) -> dict[str, str]:
    """Markdown for "Execution costs checked" in an Experiment note (X7)."""
    currency = result["currency"] or ""
    configuration, before, after = result["configuration"], result["before"], result["after"]
    lines = ["### Execution costs checked", "", f"- Report: `{result['dataset_ref']}`; lots dealt {result['lots_dealt']}"]
    lines.append(f"- Break-even extra cost: {result['break_even_per_lot']} {currency} per lot per deal" if result["break_even_per_lot"] else "- Break-even extra cost: none (the report is not profitable before extra costs)")
    if after:
        assumptions = ", ".join(part for part in [f"extra spread {configuration['extra_spread_per_lot']}" if configuration["extra_spread_per_lot"] else "", f"slippage {configuration['slippage_per_lot']}" if configuration["slippage_per_lot"] else "", "per-symbol overrides " + ", ".join(f"{symbol} {rate}" for symbol, rate in configuration["per_symbol"].items()) if configuration["per_symbol"] else ""] if part)
        lines += [
            f"- Your assumptions ({currency} per lot per deal): {assumptions}",
            f"- Balance change {before['balance_change']} → {after['balance_change']} {currency} (extra costs {after['extra_cost_total']}); maximum drawdown {before['max_drawdown']} → {after['max_drawdown']} {currency}",
            f"- Profit factor {before['closed_trades']['profit_factor'] or '—'} → {after['closed_trades']['profit_factor'] or '—'}; win rate {before['closed_trades']['win_rate_percent'] or '—'} → {after['closed_trades']['win_rate_percent'] or '—'} %",
        ]
    lines += ["- Delay was not modelled in TRL; test it in MT5 with a random delay.", f"- Your conclusion: {reason.strip() or '(none given)'}", f"- Calculation: `{result['calculation_version']}`, `{result['evaluation_id']}`"]
    return {"record_id": str(result["evaluation_id"]), "markdown": "\n".join(lines)}
