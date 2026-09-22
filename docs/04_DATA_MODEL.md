# Canonical Data Model

## Modelling rules

- Store timestamps as UTC instants plus the original text/timezone context when known.
- Store money, prices, volume, and rates as decimal strings or fixed-scale decimal values; never binary floating point as the source of truth. Preserve source display scale where supplied, because instruments can use different valid price precisions.
- Preserve a source reference for every normalised field that originated in an import.
- Unknown is a valid state. Do not convert missing values to zero.

## Core entities

| Entity | Meaning | Essential fields |
| --- | --- | --- |
| Strategy | Logical strategy/EA identity | `strategy_id`, name, version label |
| ImportArtifact | Immutable submitted file | hash, original filename, bytes, imported_at, parser_version |
| Backtest | A declared source test | `backtest_id`, strategy_id, artifact_id, symbol/context, source metadata |
| Trade | Source-level completed or partial trade record | source ticket, side, volume, opened/closed instants, prices, realised values |
| PositionEvent | Atomic normalized account-relevant event | event_id, source timestamp/text, broker-time-profile ID, type, source sequence, source reference |
| MarketMark | A price observation usable for marking | symbol, timestamp_utc, bid/ask/mid, source, quality |
| AccountScenario | Starting account and modelling choices | currency, opening balance, leverage, margin/cost policies, optional policy attachments |
| BrokerTimeProfile | Versioned source timestamp interpretation | broker label, server clock rule, timezone/offset schedule, effective dates, confidence |
| DailyDrawdownPolicy | Optional versioned daily-risk definition | timezone, reset time, baseline, P/L treatment |
| PropFirmRuleSet | Optional versioned compliance overlay | rule provider/version, daily/overall limits, measurement basis, reset policy |
| ReplayRun | Immutable simulation invocation | input manifest hash, engine version, configuration, status |
| LedgerEntry | Ordered replay output | sequence, event id, balance/equity, realised/unrealised P/L, warnings |
| RiskObservation | A maximum/minimum or breach at an instant | metric, value, timestamp, policy version, references |

## Event types

The first MT5 Deals adapter maps only the observed vocabulary documented in
`docs/17_STEP_4_EVENT_NORMALIZATION.md`: `OPENING_BALANCE`, `POSITION_OPEN`,
and `POSITION_CLOSE`. Source-signed commission, swap, and profit remain
components of the same source Deal event; Step 4 does not invent separate cash
events. Partial fills, modifications, financing, balance adjustments, marks,
or other MT5 Deal types will be added only when a documented adapter can
identify them reliably.

## Event ordering keys

Every normalized event initially has:

1. original source timestamp text and a naive terminal-clock datetime;
2. `broker_time_profile_id` that declares its intended source-time
   interpretation;
3. `source_sequence` from the Deals table;
4. stable source-record ID and deterministic event ID.

After an approved, date-aware conversion milestone, the replay ordering tuple
will add `timestamp_utc` and a versioned `event_type_priority`. Arrival order
is never used. The full ordering tuple is persisted in the replay manifest and
ledger.

## Trade economics

`gross_realised_pnl`, `commission`, `swap`, and `net_realised_pnl` are separate fields. Canonical cash components retain the source-signed convention: costs that reduce balance are negative. The adapter records the source convention and whether reported profit includes costs; the engine will not assume either.

## Instrument precision

`price` is a decimal value, never a binary float. When an adapter can read a source cell/display scale, it stores `source_price_scale` with the source text/value. The calculation layer must not impose a five-decimal FX assumption: the observed USDJPY report uses a three-decimal price display format, while a source numeric value may naturally omit trailing displayed zeros.

## Data quality states

`VALID`, `WARNING`, `BLOCKED`, and `UNVERIFIED` apply to imports and replay prerequisites. Examples: a missing close time is `BLOCKED` for a completed-trade reconciliation; missing intratrade marks may allow a balance-only replay but make equity drawdown `UNVERIFIED`.

## Policy attachment rules

Every replay supports broker-native analytics with no prop-firm policy attached. A prop-firm rule set is an optional projection over the same replay ledger, never a replacement for broker/account facts. Any calendar-based policy requires a `BrokerTimeProfile` sufficient to map source timestamps to instants; otherwise that policy result is `NOT_COMPARABLE`.
