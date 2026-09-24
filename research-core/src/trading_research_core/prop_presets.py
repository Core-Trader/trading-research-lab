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


PRESETS_VERSION = "prop-presets-2"

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

# FundedNext: CFD Challenge Terms §4–§7 plus two Help Center articles (2026-09-24).
_FN_SOURCE = "https://fundednext.com/cfd-challenge-terms"
_FN_DETAILS = [
    "https://help.fundednext.com/en/articles/8019811-how-can-i-calculate-the-daily-loss-limit",
    "https://help.fundednext.com/en/articles/8394309-when-does-the-daily-loss-limit-reset-with-fundednext-cfd",
]
_FN_COMMON = {
    # "resets at midnight based on server time ... GMT+3 [daylight saving] ... GMT+2" = EET/EEST
    "reset": {"kind": "FIRM_RESET", "time": "00:00", "zone": "Europe/Athens"},
    # Help Center example: the day's limit is measured from the day's starting value (initial balance × %).
    "start_of_day_reference": "BALANCE",
    "daily_loss_basis": "INITIAL_BALANCE",  # "calculated as a percentage of the Initial Account Size"
    "overall_loss_mode": "FIXED",  # Terms §5.2: MLL "as a percentage of the Initial Account Size"
    "trailing_reference": None,
    "breach_on": "EQUITY_TOUCH",  # "losing more than ... on closed or running trades"
    "limit_touch_counts": True,  # Terms §7.1: "reaches or exceeds any DLL/MLL threshold"
    "trading_day_definition": "DEAL_OPENED_OR_CLOSED",  # §4.3: "opens and/or closes at least one trade"
    "maximum_calendar_days": None,
    "best_day_max_percent": None,
}
_FN_NOT_MODELLED = [
    "Prohibited Trading Practices (Terms §8), including EA and copy-trading restrictions, are not checked. PropFirmMatch reported EAs as a paid add-on at FundedNext; check FundedNext's current EA policy before relying on an EA result.",
    "Add-ons and special offers can change these parameters (Terms §5.5).",
    "The Help Center says a loss of more than the limit breaches, while the Terms (§7.1) act when it is reached; this preset follows the Terms.",
]


def _fundednext(preset_id: str, programme: str, phase: str, daily: str, overall: str, target: str, days: int) -> dict[str, Any]:
    return {
        "preset_id": preset_id, "firm": "FundedNext", "programme": programme, "phase": phase,
        "rules": _FN_COMMON | {"daily_loss_limit": {"kind": "PERCENT", "value": daily}, "overall_loss_limit": {"kind": "PERCENT", "value": overall},
                               "profit_target": {"kind": "PERCENT", "value": target}, "minimum_trading_days": days},
        "not_modelled": _FN_NOT_MODELLED,
        "source_url": _FN_SOURCE, "source_details": _FN_DETAILS, "retrieved_at": "2026-09-24",
        "name": f"FundedNext {programme} · {phase}",
    }


# Terms §5.1–§5.4: DLL, MLL, minimum Trading Days, Profit Targets per model.
PRESETS += [
    _fundednext("fundednext-stellar-2step-phase1", "Stellar 2-Step", "Phase 1", "5", "10", "8", 5),
    _fundednext("fundednext-stellar-2step-phase2", "Stellar 2-Step", "Phase 2", "5", "10", "5", 5),
    _fundednext("fundednext-stellar-1step", "Stellar 1-Step", "Challenge", "3", "6", "10", 2),
    _fundednext("fundednext-stellar-lite-phase1", "Stellar Lite", "Phase 1", "4", "8", "8", 5),
    _fundednext("fundednext-stellar-lite-phase2", "Stellar Lite", "Phase 2", "4", "8", "4", 5),
    _fundednext("fundednext-evaluation-phase1", "Evaluation", "Phase 1", "5", "10", "10", 5),
    _fundednext("fundednext-evaluation-phase2", "Evaluation", "Phase 2", "5", "10", "5", 5),
]


def list_presets() -> dict[str, object]:
    return {
        "presets_version": PRESETS_VERSION,
        "presets": PRESETS,
        "notice": "Presets are starting points copied from each firm's published rules on the date shown. Firms change their terms: verify against the firm's current rules before relying on a result.",
    }


def preset(preset_id: str) -> dict[str, Any] | None:
    return next((item for item in PRESETS if item["preset_id"] == preset_id), None)
