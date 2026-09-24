# Proposal: combining equity logs in Portfolio

**Status:** DRAFT 2026-09-24. Awaiting the owner (E1–E7).

This is workflow gap 1 of the 6 that remain. The sources are in
`internal/references/REFERENCE_REGISTER.md`.

## Why

Portfolio combines closed-trade balances only. For averaging, grid, or DCA
EAs the real risk is floating: two EAs can each look safe while both are deep
underwater at the same moment. The playbook says to build the combined curve
and measure it, because a low correlation is not enough. Every attached TRL
equity log already records, per row:
- the closing equity
- the lowest equity and when it happened
- the highest equity
- the peak margin

## What TRL would add

A **"Combined equity (floating losses included)"** section in Portfolio,
next to today's realised combination, which is unchanged.

1. **When it is available (E1):** only when every report in the chosen
   tracks has an equity log attached. Otherwise TRL lists the reports without
   one and links to Data & import → Companion files. It does not mix
   equity with balance-only tracks.
2. **Method (E2):**
   - **Common time grid:** the coarsest log interval among the tracks. For
     example, one H1 log and one M1 log combine hourly.
   - **Per track, per interval:**
     - the close is the last logged equity
     - the low is the lowest logged equity inside the interval
     - with no row, the last value carries forward
     - before a track starts it adds nothing; after it ends it keeps its
       final result, as the realised combination does today
   - **Combined equity** = your starting capital + the sum of each track's
     equity change from its own deposit, with lots as reported (the same
     sizing as today).
   - **The low of a sum is not the sum of lows**, because each track's low
     happened at its own moment. So TRL gives the combined equity drawdown as
     a **range**:
     - **observed:** measured on the combined interval closes; it can miss
       a low
     - **conservative:** peak to the sum of the tracks' lows, as if every
       low coincided
     - the true value lies between the two
     - this is the same bounding idea as the prop-firm check's conservative
       bound (a TRL method; there is no external source for the bound itself)
3. **Outputs (E3):**
   - the combined equity drawdown range, next to the combined realised
     drawdown
   - each track's own equity drawdown
   - **diversification:** the combined drawdown compared with the sum of the
     tracks' own equity drawdowns and with the worst single track (playbook:
     measure the combined curve)
   - a chart of combined equity (a close line with a band down to the
     conservative low) over the combined balance
4. **Daily equity loss (E4):** per day (midnight on the report clock, as in
   Portfolio today), the lowest combined equity against the start of the
   day, again as a range. This makes combinations useful for daily-loss rules.
5. **Margin (E5):**
   - the peak margin of all tracks summed per interval (conservative)
   - the lowest combined margin level = combined low equity ÷ summed margin
     × 100 (MT5's definition)
   - your broker's stop-out level is **your own number**: if you enter it,
     TRL flags the intervals below it
   - always stated: separate backtests did not share one account, so no real
     stop-out was simulated
6. **Clock check (E6):** logs use each tester's server time. If the tracks
   come from different brokers or servers, TRL warns that times may not line
   up. It does not convert them.
7. **Guidance and record (E7):**
   - labelled, sourced reading and tips through the shared, hideable
     guidance
   - "Combined equity checked" recorded to the Experiment note

## Not included

- Simulating one shared account (joint margin calls, stop-outs, or trades
  that would not have opened). That needs tick-level joint simulation.
- Weights or position rescaling; sizing stays as reported.
- Converting between broker time zones.

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| E1 | Available only when every report in the chosen tracks has an equity log; otherwise list the missing ones and link to attaching them | **Yes** |
| E2 | Common grid = the coarsest log interval; the combined equity drawdown shown as a range (observed to conservative) | **Yes** |
| E3 | Outputs: the drawdown range next to the realised drawdown, each track's equity drawdown, diversification against the sum and the worst single track, and the band chart | **Yes** |
| E4 | Daily combined equity loss (report-clock midnight), as a range | **Yes** |
| E5 | Summed peak margin and the lowest combined margin level (MT5 formula); an optional stop-out level of your own flags intervals, with the no-shared-account caveat | **Yes** |
| E6 | Warn, not block, when tracks come from different brokers or servers | **Yes** |
| E7 | Labelled, sourced guidance (hideable); record to the note | **Yes** |

## Build order

1. Core: `portfolio_equity.py`.
   - Load and chain each track's logs.
   - Build the grid and the per-interval close and low.
   - Combine, then compute the drawdown range, daily loss, and margin.
   - Tests: two hand-built logs whose lows fall at different times, where
     the conservative bound is deeper than the observed value and the truth
     lies between; carry-forward; a missing-log refusal; mixed intervals;
     margin level by hand. Then the worker method.
2. The plugin section, the chart, the guidance model, and the record to the
   note.
3. Update the Help guides: close the gap; Optimisation checklist step 6 to
   "In TRL".
