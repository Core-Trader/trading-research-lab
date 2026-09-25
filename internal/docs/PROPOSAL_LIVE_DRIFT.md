# Proposal: live drift monitoring

**Status:** FUTURE: recorded 2026-09-25, not scheduled. Owner decisions not yet taken.

This proposal is recorded so it is ready to take up later; nothing is built.
Sources are in `internal/references/REFERENCE_REGISTER.md`. Anything not
registered there is marked **to be sourced when the proposal is taken up**.

## Why

The purpose is to detect whether live (or demo) results drift from what the
backtest led us to expect, before the difference becomes costly.

It extends the existing workflow gap "Importing demo or live account
statements to track real forward results". That gap is listed under "Not in
TRL yet" in the Research workflow (`plugin/src/components/help/research-workflow.ts`
and `product-docs/RESEARCH_WORKFLOW.md`), after step 9, "Final test on the
held-out months", and step 10, "Visual check and decision". It is the
continuation of step 9: after going live, keep checking.

This is **analysis of live results only**. TRL does not connect to a broker,
place trades, or execute anything. Milestone 6 already excludes live trading
and broker execution (`ROADMAP.md`).

## Two complementary ways to detect drift

### 1. Same-period comparison (execution drift against strategy drift)

- **The re-run:** periodically re-run the backtest in MT5 over exactly the
  live period, with the same `.set`, real ticks, and ideally the live broker's
  server.
- **Deal by deal:** compare the re-run with the live account:
  - missed or extra trades
  - entry and exit price differences (slippage)
  - timing
  - commissions and swaps
- **What it separates:**
  - **Execution drift:** the same signals, filled differently. Sources:
    spreads, slippage, delays, and requotes. MT5 simulates delays in the
    tester (MT5 Help: Strategy Testing, registered).
  - **Strategy drift:** the live period itself is different from what the
    backtest covered.

### 2. Distribution comparison (live results against expected bands)

Live results are checked against the bands TRL already computes from the
backtest:
- **Resampling:** is live equity inside the bootstrap Monte Carlo fan's 5–95 %
  band at the same trade count? (`monte_carlo_bootstrap.py`; Efron 1979,
  NIST 1.3.3.4, and Künsch 1989, registered)
- **Average trade:** is it inside the backtest's significance interval?
  (`significance.py`; NIST 1.3.5.2, registered)
- **Costs:** do live costs per lot stay below the break-even?
  (`cost_breakdown.py`, `execution_costs.py`)
- **Windows:** is the live window inside the range of the backtest's windows?
  (`windows.py`)

Drift is stated as "outside the expected band", with each point labelled and
sourced as elsewhere in TRL (S/W/C/U). **There is never a verdict** such as
"the EA is broken". Any threshold for acting on drift is **user-defined**; none
is proposed here.

## Pieces needed (and what can be reused)

1. **Account-history importer (new, Core):**
   - reads the MT5 account history export (MT5 Help, Trading Report, is
     registered for its definitions; **its export format is to be sourced
     when the proposal is taken up**)
   - filters by magic number when several EAs share an account
   - excludes deposits, withdrawals, and other balance operations from P/L
   - provenance and an immutable raw snapshot, as for all imports
     (DATA_MODEL.md)
   - reuses: the intake, the dataset store, the canonical events
   - needs: the non-trade deal types that the backtest importer rejects today
     (see the deferred C6 in `PROPOSAL_COST_BREAKDOWN.md`)
2. **Deal-by-deal comparison engine (new, Core):** matches live deals to the
   same-period re-run by symbol, direction, time window, and volume. It
   reports matches, misses, extras, and the differences in price, time, and
   cost. The matching tolerances are **user-defined**.
3. **Drift checks (reuse):** `monte_carlo_bootstrap.py`, `significance.py`,
   `cost_breakdown.py`, `execution_costs.py`, and `windows.py`, run on the
   backtest; live values are then placed against their bands.
4. **A live-safe equity logger mode (new design, separate from today's
   logger):**
   - **today:** the logger is inert outside the Strategy Tester (and during
     optimisations): `TrlEquityInit` returns early at
     `mql5/Include/TRL_EquityLogger.mqh` line 101
   - a live mode needs:
     - an explicit opt-in
     - periodic `FileFlush`: today there is none, because the tester writes
       at the end
     - cheaper deal counting than `HistorySelect(0, …)` on every balance
       change (lines 63–70 and 184)
     - one file per session, with terminal and VPS restarts handled
     - awareness of VPS disk use and privacy, since the file holds live
       account equity
5. **A drift view (plugin):** sourced, hideable guidance through the shared
   components (GUIDE-1), plus a record to the Experiment note (NOTES-2 block
   kind "live-drift").

## Cautions to design in

- **Small early samples:** "too early to tell" while live trades are few,
  reusing the minimum-trades setting and the width of the significance
  interval. No number is proposed; the minimum is the user's own.
- **Market regime change against EA drift:** the same-period re-run separates
  them. If the re-run also deteriorates, the market changed; if only live
  deteriorates, execution or setup drifted.
- **Dependent DCA basket trades:** use the block method (Künsch 1989,
  registered) for the bands. A single-trade band understates risk for baskets.
- **Broker and server differences:** the backtest server, the live server,
  symbol specifications, and time zones may differ. Show them, do not
  convert them (as in EQP-1), and prefer a re-run on the live broker's
  server.

## Draft owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| L1 | An account-history importer: magic-number filter, balance operations excluded from P/L, immutable raw snapshot, provenance | **Yes, first:** everything else depends on it |
| L2 | A same-period deal-by-deal comparison with the MT5 re-run, with user-defined matching tolerances | **Yes, second:** it is the only way to separate execution drift from strategy drift |
| L3 | Live-against-bands drift checks (bootstrap fan, significance interval, cost break-even, window range), stated as "outside the expected band" with labels, never a verdict | **Yes, third** |
| L4 | A live-safe equity logger mode (opt-in, periodic flush, cheaper deal counting, per-session files, VPS awareness) as a separate design | **Yes, fourth:** it needs its own design and its own live-safety review |
| L5 | Every threshold for acting on drift is user-defined; TRL proposes none | **Yes** |

Suggested order: L1, then L2, then L3, then L4.

## Not included

- Connecting to a broker, reading a live account over the network, or
  trading. The owner exports the history; TRL reads files.
- Alerts or notifications.
- Any automatic decision to stop or change an EA.

## Sources

- **Registered:**
  - MT5 Help: Trading Report (definitions only)
  - MT5 Help: Strategy Testing (delays; forward testing)
  - MT5 Help: Real and Generated Ticks
  - NIST e-Handbook 1.3.5.2 (t-test and interval), 1.2.5.1, 1.3.5.13 (runs),
    1.3.3.4 (bootstrap)
  - Efron (1979); Künsch (1989)
  - Bailey et al. (2014, qualitative)
  - the owner's playbook
- **To be sourced when the proposal is taken up:**
  - the MT5 account-history export format and its columns
  - MQL5 file-writing and flushing behaviour for live runs
  - `HistorySelect` cost guidance
  - any published method for deal matching or drift detection
