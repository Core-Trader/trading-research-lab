"""Deterministically map supported MT5 Deals rows to canonical account events.

This module deliberately does *not* pair opening and closing deals into trades or
positions. The observed export has no documented position identifier and does
not establish the account's netting/hedging semantics. It therefore preserves
the source event facts and stops at an auditable event representation.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from hashlib import sha256

from trading_research_lab.mt5_excel import Mt5Deal, Mt5ExcelImport, SourceArtifact


class NormalizationError(ValueError):
    """Raised when a source Deal cannot be mapped without guessing its semantics."""


class CanonicalEventType(StrEnum):
    """The intentionally small Step 4 canonical event vocabulary."""

    OPENING_BALANCE = "OPENING_BALANCE"
    POSITION_OPEN = "POSITION_OPEN"
    POSITION_CLOSE = "POSITION_CLOSE"


@dataclass(frozen=True)
class CanonicalAccountEvent:
    """One immutable canonical event with complete source traceability."""

    event_id: str
    source_artifact_sha256: str
    source_sequence: int
    source_deal_id: str
    source_order_id: str | None
    source_timestamp_text: str
    source_timestamp: datetime
    broker_time_profile_id: str
    event_type: CanonicalEventType
    side: str | None
    symbol: str | None
    volume: Decimal | None
    price: Decimal | None
    source_price_scale: int | None
    source_commission: Decimal
    source_swap: Decimal
    source_profit: Decimal
    reported_balance: Decimal
    comment: str | None

    @property
    def source_net_cash_change(self) -> Decimal | None:
        """Signed cash movement reported on a trading deal; balance setup is excluded."""

        if self.event_type == CanonicalEventType.OPENING_BALANCE:
            return None
        return self.source_profit + self.source_commission + self.source_swap


@dataclass(frozen=True)
class NormalizedMt5Import:
    """A normalised, source-preserving MT5 import ready for later replay work."""

    artifact: SourceArtifact
    settings: dict[str, str]
    events: tuple[CanonicalAccountEvent, ...]

    @property
    def opening_balance_event(self) -> CanonicalAccountEvent:
        matches = [
            event
            for event in self.events
            if event.event_type == CanonicalEventType.OPENING_BALANCE
        ]
        if len(matches) != 1:
            raise NormalizationError(
                f"Expected exactly one opening balance event, found {len(matches)}."
            )
        return matches[0]

    @property
    def trading_events(self) -> tuple[CanonicalAccountEvent, ...]:
        return tuple(
            event
            for event in self.events
            if event.event_type != CanonicalEventType.OPENING_BALANCE
        )


def normalize_mt5_import(
    imported: Mt5ExcelImport,
    *,
    broker_time_profile_id: str,
) -> NormalizedMt5Import:
    """Normalise a supported MT5 import without converting source timestamps.

    ``broker_time_profile_id`` records the intended interpretation of the
    source's naive terminal-clock timestamps. Conversion to UTC is a later,
    date-aware responsibility and is intentionally outside this milestone.
    """

    profile = broker_time_profile_id.strip()
    if not profile:
        raise NormalizationError("broker_time_profile_id must be a non-empty identifier.")

    events = tuple(
        _normalise_deal(
            deal=deal,
            artifact_sha256=imported.artifact.sha256,
            source_sequence=source_sequence,
            broker_time_profile_id=profile,
        )
        for source_sequence, deal in enumerate(imported.deals, start=1)
    )
    if len(events) != len(imported.deals):
        raise NormalizationError("Normalisation did not preserve the source Deal row count.")
    opening_event_count = sum(
        event.event_type == CanonicalEventType.OPENING_BALANCE for event in events
    )
    if opening_event_count != 1 or events[0].event_type != CanonicalEventType.OPENING_BALANCE:
        raise NormalizationError(
            "The supported report contract requires exactly one opening balance "
            "as the first Deals row; later balance operations are not yet supported."
        )
    return NormalizedMt5Import(
        artifact=imported.artifact,
        settings=dict(imported.settings),
        events=events,
    )


def _normalise_deal(
    *,
    deal: Mt5Deal,
    artifact_sha256: str,
    source_sequence: int,
    broker_time_profile_id: str,
) -> CanonicalAccountEvent:
    event_type, side = _event_type_for(deal, source_sequence)
    if event_type != CanonicalEventType.OPENING_BALANCE and (
        deal.symbol is None or deal.volume is None or deal.price is None
    ):
        raise NormalizationError(
            f"Deal {deal.deal_id!r} at source sequence {source_sequence} is missing "
            "symbol, volume, or price required for a trading event."
        )

    return CanonicalAccountEvent(
        event_id=_stable_event_id(artifact_sha256, source_sequence, deal.deal_id),
        source_artifact_sha256=artifact_sha256,
        source_sequence=source_sequence,
        source_deal_id=deal.deal_id,
        source_order_id=deal.order_id,
        source_timestamp_text=deal.timestamp_text,
        source_timestamp=deal.timestamp,
        broker_time_profile_id=broker_time_profile_id,
        event_type=event_type,
        side=side,
        symbol=deal.symbol,
        volume=deal.volume,
        price=deal.price,
        source_price_scale=deal.source_price_scale,
        source_commission=deal.commission,
        source_swap=deal.swap,
        source_profit=deal.profit,
        reported_balance=deal.balance,
        comment=deal.comment,
    )


def _event_type_for(
    deal: Mt5Deal, source_sequence: int
) -> tuple[CanonicalEventType, str | None]:
    if deal.deal_type == "balance":
        if deal.direction is not None:
            raise NormalizationError(
                f"Balance deal {deal.deal_id!r} at source sequence {source_sequence} "
                "has an unsupported Direction."
            )
        return CanonicalEventType.OPENING_BALANCE, None

    if deal.deal_type not in {"buy", "sell"}:
        raise NormalizationError(
            f"Deal {deal.deal_id!r} at source sequence {source_sequence} has unsupported "
            f"Type {deal.deal_type!r}."
        )
    if deal.direction == "in":
        return CanonicalEventType.POSITION_OPEN, deal.deal_type.upper()
    if deal.direction == "out":
        return CanonicalEventType.POSITION_CLOSE, deal.deal_type.upper()
    raise NormalizationError(
        f"Deal {deal.deal_id!r} at source sequence {source_sequence} has unsupported "
        f"Direction {deal.direction!r} for Type {deal.deal_type!r}."
    )


def _stable_event_id(artifact_sha256: str, source_sequence: int, deal_id: str) -> str:
    payload = f"mt5-deal-event-v1|{artifact_sha256}|{source_sequence}|{deal_id}"
    return sha256(payload.encode("utf-8")).hexdigest().upper()
