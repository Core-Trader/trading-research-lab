# Step 4 — Canonical Event Normalisation

## Goal

Turn an already validated MT5 Excel `Deals` import into a deterministic,
source-traceable sequence of canonical account events. This is a narrow domain
layer between file parsing and later account replay; it is not a trade matcher,
portfolio engine, database migration, or GUI feature.

## Input evidence and supported mapping

The four currently reviewed Strategy Tester reports contain one `balance` row
and Buy/Sell rows whose `Direction` is `in` or `out`. The event adapter supports
only that observed vocabulary:

| MT5 `Type` | MT5 `Direction` | Canonical event | Canonical side |
| --- | --- | --- | --- |
| first `balance` row only | empty | `OPENING_BALANCE` | empty |
| `buy` | `in` | `POSITION_OPEN` | `BUY` |
| `sell` | `in` | `POSITION_OPEN` | `SELL` |
| `buy` | `out` | `POSITION_CLOSE` | `BUY` |
| `sell` | `out` | `POSITION_CLOSE` | `SELL` |

Any other type, direction, a later balance operation, or a trading row without
symbol/volume/price is blocked with a `NormalizationError`. The adapter must not
silently guess the meaning of charges, balance operations, partial fills,
reversals, stop-out events, or future MT5 vocabulary.

## Canonical event contract

Every event retains the source artifact SHA-256, source Deal ID, source Order
ID where present, one-based source sequence, original timestamp text, parsed
naive source-clock timestamp, broker-time-profile identifier, money fields,
balance, and price-scale metadata. Its ID is the SHA-256 of:

```text
mt5-deal-event-v1 | source artifact SHA-256 | source sequence | source Deal ID
```

This makes an ID deterministic for a specific immutable input and preserves
uniqueness even if an unexpected export repeats a Deal ID.

`source_sequence` is the one-based order within the parsed Deals table, not an
arrival time or an inferred temporal order. Later replay ordering must use its
separately versioned ordering contract.

## Cash and balance rules

For trading events only, `source_net_cash_change` is:

```text
source_profit + source_commission + source_swap
```

All components retain the source sign. `OPENING_BALANCE` has no cash-change
value: its `reported_balance` establishes the starting balance and its source
Profit cell must never be mistaken for realised trading profit.

## Time rule

Normalisation does not convert timestamps to UTC. The source report provides a
terminal-clock datetime without an embedded timezone. The event records the
approved `broker_time_profile_id` (currently
`roboforex-eet-eest-v0.1`) as provenance only. A later, date-aware conversion
step must be separately specified and tested before any calendar or
daily-drawdown result is calculated.

## Deliberately deferred: trade and position pairing

An MT5 Deal row alone is not sufficient evidence to pair an open and close into
a completed trade across all account modes. The observed export has no verified
position identifier, and a valid pairing algorithm differs for hedging and
netting accounts, partial closes, reversals, and multi-deal executions.

Accordingly, Step 4 never creates a `Trade` entity and never infers holding
period, trade P/L, or position state. Those require a later approved source
contract that includes the necessary MT5/account semantics.

## Acceptance checks

1. The number of events equals the number of imported Deals rows.
2. Every event has immutable source provenance and a deterministic ID.
3. Current EURUSD and USDJPY imports retain source cash signs and USDJPY's
   three-decimal source price scale.
4. Unsupported source vocabulary fails explicitly.
5. No raw report is changed and no UTC conversion, daily-risk calculation,
   trade pairing, database, or UI is introduced.

## Owner manual review before the next scope

1. Confirm the mapping table matches your intended interpretation of the MT5
   `In` and `Out` rows.
2. Inspect a few event records against the original EURUSD and USDJPY Deal
   lines, especially their source sequence, price precision, and signed costs.
3. Confirm that deferring trade/position pairing is acceptable until an export
   with verified position/account-mode information is available.
4. Confirm `roboforex-eet-eest-v0.1` should remain provenance only until the
   date-aware timestamp conversion milestone.

## Owner review status — 2026-09-20

Confirmed by the owner:

1. The current mapping table is approved.
2. MT5 `In`/`Out` interpretation as open/close events is approved for this
   event-level model.
3. `roboforex-eet-eest-v0.1` remains provenance only; no UTC conversion or
   calendar-risk calculation is authorised by this confirmation.

Still pending: the later decision to create completed Trade/Position entities.
That decision requires the evidence specified below and a separate approved
pairing contract.

The current account mode is owner-declared as `HEDGING`. This rules out a
one-position-per-symbol assumption, but it is not yet a terminal-snapshot
verification for these historical reports. See
`docs/18_POSITION_PAIRING_EVIDENCE_PLAN.md`.

The current account mode is owner-declared as `HEDGING`. This rules out a
one-position-per-symbol assumption, but it is not yet a terminal-snapshot
verification for these historical reports. See
`docs/18_POSITION_PAIRING_EVIDENCE_PLAN.md`.

## Evidence required for a later trade/position-pairing milestone

1. The MT5 account's `ACCOUNT_MARGIN_MODE` value for the source account or
   test environment, recorded as netting or hedging. A netting account permits
   one position per symbol; a hedging account can hold multiple, including
   opposite-direction, positions for the same symbol.
2. A machine-readable source export or local MT5 extraction that includes each
   Deal's `DEAL_POSITION_ID` alongside Deal ticket, Order ID, time (preferably
   millisecond time), type, entry, symbol, volume, price, commission, swap, and
   profit. The current Excel report does not expose the position ID.
3. Representative examples from the intended account mode: normal open/close,
   partial close, multiple fills for one order, concurrent same-symbol exposure,
   reversal (`INOUT`), and any `OUT_BY` close-by operation if it is supported.
4. A declared pairing/output policy: whether the product reports a position
   lifecycle, FIFO/LIFO lots where relevant, or only the broker-provided
   position ID grouping; and how it will represent a reversal or partial close.
5. Reconciliation evidence showing the resulting groups reproduce known
   source-level volume, realised cash components, and closing balance.

## Owner review status — 2026-09-20

Confirmed by the owner:

1. The current mapping table is approved.
2. MT5 `In`/`Out` interpretation as open/close events is approved for this
   event-level model.
3. `roboforex-eet-eest-v0.1` remains provenance only; no UTC conversion or
   calendar-risk calculation is authorised by this confirmation.

Still pending: the later decision to create completed Trade/Position entities.
That decision requires the evidence specified below and a separate approved
pairing contract.

## Evidence required for a later trade/position-pairing milestone

1. The MT5 account's `ACCOUNT_MARGIN_MODE` value for the source account or
   test environment, recorded as netting or hedging. A netting account permits
   one position per symbol; a hedging account can hold multiple, including
   opposite-direction, positions for the same symbol.
2. A machine-readable source export or local MT5 extraction that includes each
   Deal's `DEAL_POSITION_ID` alongside Deal ticket, Order ID, time (preferably
   millisecond time), type, entry, symbol, volume, price, commission, swap, and
   profit. The current Excel report does not expose the position ID.
3. Representative examples from the intended account mode: normal open/close,
   partial close, multiple fills for one order, concurrent same-symbol exposure,
   reversal (`INOUT`), and any `OUT_BY` close-by operation if it is supported.
4. A declared pairing/output policy: whether the product reports a position
   lifecycle, FIFO/LIFO lots where relevant, or only the broker-provided
   position ID grouping; and how it will represent a reversal or partial close.
5. Reconciliation evidence showing the resulting groups reproduce known
   source-level volume, realised cash components, and closing balance.
