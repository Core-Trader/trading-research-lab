"""Deterministic M0 statistics from canonical, source-preserving events."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from .errors import CoreError
from .identities import stable_uuid
from . import CORE_VERSION


CALCULATION_VERSION = "m0-basic-statistics-1"


def basic_statistics(dataset: dict[str, object], *, analysis_run_id: str | None = None) -> dict[str, object]:
    """Calculate verified balance metrics without reconstructing unknown equity."""

    events_value = dataset.get("events")
    metadata_value = dataset.get("metadata")
    if not isinstance(events_value, list) or not isinstance(metadata_value, dict):
        raise CoreError("E_INTERNAL", "Canonical dataset is malformed.")
    events = sorted(events_value, key=lambda event: int(event["source_sequence"]))
    if not events:
        raise CoreError("E_DATASET_INVALID", "Canonical dataset has no events.")
    opening = _decimal(events[0]["reported_balance"])
    balance_points: list[dict[str, object]] = []
    closed_event_count = 0
    realised_net = Decimal("0")
    for event in events:
        balance = _decimal(event["reported_balance"])
        balance_points.append({
            "source_sequence": int(event["source_sequence"]),
            "timestamp": str(event["source_timestamp"]),
            "balance": _format_decimal(balance),
        })
        if event["event_type"] == "POSITION_CLOSE":
            closed_event_count += 1
            realised_net += _decimal(event["source_profit"]) + _decimal(event["source_commission"]) + _decimal(event["source_swap"])
    final_balance = _decimal(events[-1]["reported_balance"])
    return {
        "analysis_run_id": analysis_run_id or stable_uuid(
            "analysis-result",
            str(metadata_value.get("dataset_ref")),
            CALCULATION_VERSION,
            CORE_VERSION,
        ),
        "calculation_version": CALCULATION_VERSION,
        "core_version": CORE_VERSION,
        "dataset_ref": metadata_value.get("dataset_ref"),
        "dataset_id": metadata_value.get("dataset_id"),
        "source_import_id": metadata_value.get("source_import_id"),
        "source_sha256": metadata_value.get("source", {}).get("sha256"),
        "currency": metadata_value.get("settings", {}).get("Currency"),
        "opening_balance": _format_decimal(opening),
        "final_reported_balance": _format_decimal(final_balance),
        "reported_balance_change": _format_decimal(final_balance - opening),
        "closed_position_event_count": closed_event_count,
        "realised_net_from_closing_events": _format_decimal(realised_net),
        "balance_curve": {"status": "VERIFIED", "points": balance_points},
        "equity_curve": {
            "status": "UNAVAILABLE",
            "reason": "MT5 Deals export does not provide the mark-to-market inputs required for intratrade equity reconstruction.",
            "points": [],
        },
        "limitations": [
            "No trade or position pairing is inferred in M0.",
            "No intratrade equity is reconstructed from balance-only source facts.",
        ],
    }


def markdown_summary(statistics: dict[str, object]) -> str:
    """Create generated Markdown content; plugin controls the vault write boundary."""

    lines = [
        "## Trading Research Lab — M0 analysis",
        "",
        f"- Dataset: `{statistics['dataset_ref']}`",
        f"- Analysis run: `{statistics['analysis_run_id']}`",
        f"- Dataset ID: `{statistics['dataset_id']}`",
        f"- Source import ID: `{statistics['source_import_id']}`",
        f"- Source SHA-256: `{statistics['source_sha256']}`",
        f"- Core version: `{statistics['core_version']}`",
        f"- Calculation version: `{statistics['calculation_version']}`",
        f"- Currency: `{statistics['currency']}`",
        f"- Opening balance: `{statistics['opening_balance']}`",
        f"- Final reported balance: `{statistics['final_reported_balance']}`",
        f"- Reported balance change: `{statistics['reported_balance_change']}`",
        f"- Closing deal events: `{statistics['closed_position_event_count']}`",
        "- Balance curve: verified against the balances the report lists.",
        "- Source quality: deal facts as recorded in the MT5 report; trades are not paired into positions.",
        "- Equity curve: not available; floating profit and loss was not reconstructed.",
        "",
        "### M0 limitations",
        "",
        *[f"- {item}" for item in statistics["limitations"]],
    ]
    return "\n".join(lines) + "\n"


def _decimal(value: object) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _format_decimal(value: Decimal) -> str:
    return format(value, "f")
