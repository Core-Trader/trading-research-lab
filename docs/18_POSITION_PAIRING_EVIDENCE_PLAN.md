# Position Pairing Evidence Plan

## Decision summary

Regular MT5 Strategy Tester Excel exports remain the normal working files for
the application. Users must not be required to run a forensic EA for ordinary
imports, event-level analysis, balance reconciliation, or future risk analysis.

A forensic export is nevertheless valuable as a development-only reference
dataset before the product claims to reconstruct individual positions or
completed trades. It verifies the pairing algorithm against MT5's own position
identifiers; it is not a permanent operational dependency of the app.

## Current account-mode record

| Field | Current value |
| --- | --- |
| Account position mode | `HEDGING` |
| Evidence source | Owner declaration, 2026-09-20 |
| Verification state | `DECLARED`, not terminal-snapshot verified |
| Consequence | More than one independent, including opposite-direction, position can exist for one symbol. Do not use a one-position-per-symbol pairing rule. |

## Account-mode intake policy

The Excel Deals report currently does not expose `ACCOUNT_MARGIN_MODE`, so an
importer cannot derive it from that file. The app must use the following order
of evidence and persist both the value and its evidence state:

1. `VERIFIED_TEST_RUN`: an attached test-run forensic manifest records the
   account mode from the same Strategy Tester execution.
2. `VERIFIED_TERMINAL_SNAPSHOT`: the app queries an explicitly selected, open
   MT5 terminal and stores a timestamped local snapshot.
3. `DECLARED`: the user selects the account mode in the import/scenario form.
4. `UNKNOWN`: no selection or evidence exists; trade/position reconstruction is
   blocked.

An open-terminal query may be convenient, but it is not proof of the mode used
by an historical test report unless the terminal snapshot is tied to that exact
test configuration and run. The MT5 Python integration can obtain information
from a connected terminal, including account information and history; this is a
future optional local integration, not a dependency of Excel import.

## Why regular reports are insufficient for verified position reconstruction

MT5 provides `DEAL_POSITION_ID` as the identifier of the position affected by a
deal. The current Excel report exposes Deal ticket and Order ID but not that
position ID. In a hedging account, the same symbol can have several concurrent
positions, so timestamp, direction, volume, and order number alone cannot
always identify which position an exit closed.

Therefore the application supports two distinct result qualities:

| Result | Works from regular Excel report | Quality statement |
| --- | --- | --- |
| Deal/event, balance, and source-cash analysis | Yes | `SOURCE_REPORTED` |
| Position/trade grouping with a linked position ID | Yes, when an enriched audit source is attached | `MT5_VERIFIED` |
| Position/trade grouping inferred from ordinary report rows | Potentially later | `INFERRED`, never claimed to reproduce MT5 exactly |

An ambiguous regular report must remain event-level rather than being silently
assigned arbitrary trade pairs. This is a data limitation, not a limitation that
an app can safely hide.

The owner approved showing a future regular-report pairing when it is explicitly
labelled `INFERRED`. The UI must show the label beside the result and explain
that it is not equivalent to MT5 Position-ID evidence.

## Supplied EA source — read-only assessment

The following frozen source was read without modification, compilation, or
execution:

| Field | Value |
| --- | --- |
| Path | `C:\RoboForex MT5 Terminal\MQL5\Experts\EA-DCA-V1.0\EA_DCA_CENT_V1.mq5` |
| SHA-256 | `C1B3E0002D3B2A1B313F0C7A3B4E85948B71993C4662ACEC6D8885B8A74D7237` |
| Source role | Cent-account go-live frozen baseline, as declared in its header |
| Account-mode behaviour | Calls `AccountInfoInteger(ACCOUNT_MARGIN_MODE)` and warns when not hedging |
| Position-ID behaviour | After an order fills, resolves the resulting Deal through `DEAL_POSITION_ID` for its internal sequence tracking |
| Existing audit export | None found |

This confirms that the EA itself already depends on hedging-compatible position
semantics and knows how to obtain the required MT5 Position ID. It does not
change the evidence limitation of the ordinary Excel report.

The source header explicitly directs that it must not be hand-edited. Any future
forensic work must therefore use an approved, separately named test copy and
respect the EA's upstream/re-baselining governance. The frozen baseline is never
modified in place.

## Recommended forensic utility — later milestone

Do not build a forensic EA now. The present milestone has not begun time
conversion, replay, or trade pairing, and modifying the strategy EA now would
increase scope and create avoidable reproducibility risk.

Immediately before the trade-pairing milestone, create a separate, test-only
**MT5 Position Audit Exporter**. For a Strategy Tester run, it should be an
audit include/module compiled into an approved forensic copy of the EA, rather
than a change to the frozen EA used for ordinary research. It must not send
orders, alter inputs, affect strategy decisions, or replace normal reports.

The exporter should run after the test completes and write a versioned CSV or
JSON plus manifest containing:

- terminal/build and exporter version;
- backtest configuration fingerprint and source-report SHA-256 where available;
- `ACCOUNT_MARGIN_MODE`, `ACCOUNT_HEDGE_ALLOWED`, and relevant account metadata;
- Deal ticket, Order ID, `DEAL_POSITION_ID`, time including milliseconds, type,
  entry, symbol, volume, price, commission, swap, profit, fee, magic, reason,
  and comment where available;
- explicit source time context and file creation details;
- a schema version and SHA-256 for the audit artifact.

Use the forensic output only to create regression fixtures and validate the
product's documented pairing rules. Retain it privately under `data/raw/` or a
separately ignored forensic-data directory; do not commit account identifiers
or trading history.

## Required acceptance examples

Before enabling a `MT5_VERIFIED` position/trade view, capture and reconcile at
least one test case for each applicable behaviour:

1. ordinary complete open and close;
2. partial close;
3. multiple fills of one order;
4. concurrent same-symbol positions in a hedging account;
5. opposite-direction simultaneous positions;
6. reversal (`DEAL_ENTRY_INOUT`) and close-by (`DEAL_ENTRY_OUT_BY`) if the EA or
   broker can produce them;
7. commission, swap, and fee treatment.

The reconciliation must agree with the source at Deal level before any grouped
position metrics are trusted.

## Manual review before that milestone

1. **Approved 2026-09-20:** The EA source is registered and must remain
   unchanged; a separately named forensic *copy* may be created when the
   pairing milestone begins.
2. **Approved 2026-09-20:** That forensic copy may be compiled and run locally
   only in the portable `C:\RoboForex MT5 Terminal\terminal64.exe /portable`
   environment.
3. Review the exact forensic schema, redaction rules, and storage location
   before any export is produced.
4. Review the user-facing `INFERRED` label and ambiguity warning before the
   ordinary-report pairing view is released.
