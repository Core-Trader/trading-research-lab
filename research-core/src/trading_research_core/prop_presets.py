"""Predefined prop-firm rule profiles (PROP-2, amends P1).

Each preset is a starting point copied into an ordinary, editable user
profile. It records where its numbers came from and when, because firms
change their terms: the user is asked to verify against the firm's current
rules. The account size is not part of a preset; it comes from the report
or combination being checked (no rescaling, P6).

Adding a firm: read the firm's own rules page, fill every field that TRL
models, list what it cannot model in `not_modelled`, and add a test.
"""

from __future__ import annotations

from typing import Any


PRESETS_VERSION = "prop-presets-1"

_FTMO_SOURCE = "https://ftmo.com/en/trading-objectives/"
_FTMO_RETRIEVED = "2026-09-24"
_FTMO_COMMON = {
    "reset": {"kind": "FIRM_RESET", "time": "00:00", "zone": "Europe/Prague"},  # 00:00 CE(S)T
    "start_of_day_reference": "BALANCE",  # "the account balance recorded at 00:00 CE(S)T"
    "daily_loss_basis": "INITIAL_BALANCE",  # "% of the Initial Simulated Capital"
    "breach_on": "EQUITY_TOUCH",  # equity (balance + open P/L ± swaps − commissions)
    "limit_touch_counts": False,  # "If the equity drops below this limit"
    "trading_day_definition": "POSITION_OPENED",  # "a day ... during which at least one position is opened"
    "maximum_calendar_days": None,  # "No time limit"
}
_FTMO_NOT_MODELLED = [
    "Forbidden trading practices, news and weekend restrictions on Standard FTMO Accounts, and instrument limits are not checked.",
    "FTMO's target needs the balance to exceed the target with all positions closed; TRL counts reaching it on closed balance.",
]

PRESETS: list[dict[str, Any]] = [
    {
        "preset_id": "ftmo-2step-challenge",
        "firm": "FTMO", "programme": "FTMO Challenge: 2-Step", "phase": "FTMO Challenge (phase 1)",
        "rules": _FTMO_COMMON | {"daily_loss_limit": {"kind": "PERCENT", "value": "5"}, "overall_loss_limit": {"kind": "PERCENT", "value": "10"}, "overall_loss_mode": "FIXED", "trailing_reference": None,
                                 "profit_target": {"kind": "PERCENT", "value": "10"}, "minimum_trading_days": 4, "best_day_max_percent": None},
        "not_modelled": _FTMO_NOT_MODELLED,
    },
    {
        "preset_id": "ftmo-2step-verification",
        "firm": "FTMO", "programme": "FTMO Challenge: 2-Step", "phase": "Verification (phase 2)",
        "rules": _FTMO_COMMON | {"daily_loss_limit": {"kind": "PERCENT", "value": "5"}, "overall_loss_limit": {"kind": "PERCENT", "value": "10"}, "overall_loss_mode": "FIXED", "trailing_reference": None,
                                 "profit_target": {"kind": "PERCENT", "value": "5"}, "minimum_trading_days": 4, "best_day_max_percent": None},
        "not_modelled": _FTMO_NOT_MODELLED,
    },
    {
        "preset_id": "ftmo-2step-account",
        "firm": "FTMO", "programme": "FTMO Challenge: 2-Step", "phase": "FTMO Account (funded)",
        "rules": _FTMO_COMMON | {"daily_loss_limit": {"kind": "PERCENT", "value": "5"}, "overall_loss_limit": {"kind": "PERCENT", "value": "10"}, "overall_loss_mode": "FIXED", "trailing_reference": None,
                                 "profit_target": None, "minimum_trading_days": None, "best_day_max_percent": None},
        "not_modelled": _FTMO_NOT_MODELLED[:1],
    },
    {
        "preset_id": "ftmo-1step-challenge",
        "firm": "FTMO", "programme": "FTMO Challenge: 1-Step", "phase": "FTMO Challenge",
        "rules": _FTMO_COMMON | {"daily_loss_limit": {"kind": "PERCENT", "value": "3"}, "overall_loss_limit": {"kind": "PERCENT", "value": "10"},
                                 # "highest account balance achieved at 00:00 CE(S)T of any preceding trading day or, if higher, the Initial Simulated Capital"
                                 "overall_loss_mode": "TRAILING", "trailing_reference": "END_OF_DAY_BALANCE_HIGH",
                                 "profit_target": {"kind": "PERCENT", "value": "10"}, "minimum_trading_days": None, "best_day_max_percent": "50"},
        "not_modelled": _FTMO_NOT_MODELLED + ["The trailing limit resets when a reward is withdrawn; a backtest has no withdrawals."],
    },
    {
        "preset_id": "ftmo-1step-account",
        "firm": "FTMO", "programme": "FTMO Challenge: 1-Step", "phase": "FTMO Account (funded; best-day rule for reward eligibility)",
        "rules": _FTMO_COMMON | {"daily_loss_limit": {"kind": "PERCENT", "value": "3"}, "overall_loss_limit": {"kind": "PERCENT", "value": "10"},
                                 "overall_loss_mode": "TRAILING", "trailing_reference": "END_OF_DAY_BALANCE_HIGH",
                                 "profit_target": None, "minimum_trading_days": None, "best_day_max_percent": None},
        "not_modelled": _FTMO_NOT_MODELLED[:1] + ["The best-day rule decides reward eligibility on the funded account; it is not a breach and is not checked here.", "The trailing limit resets when a reward is withdrawn; a backtest has no withdrawals."],
    },
]

for _preset in PRESETS:
    _preset |= {"source_url": _FTMO_SOURCE, "retrieved_at": _FTMO_RETRIEVED, "name": f"{_preset['firm']} {_preset['programme'].split(': ')[-1]} · {_preset['phase']}"}


def list_presets() -> dict[str, object]:
    return {
        "presets_version": PRESETS_VERSION,
        "presets": PRESETS,
        "notice": "Presets are starting points copied from each firm's published rules on the date shown. Firms change their terms: verify against the firm's current rules before relying on a result.",
    }


def preset(preset_id: str) -> dict[str, Any] | None:
    return next((item for item in PRESETS if item["preset_id"] == preset_id), None)
