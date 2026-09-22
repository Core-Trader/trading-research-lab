# Concurrent Portfolio Combination (FXOptimize-inspired) — Draft Specification

**Status:** DRAFT, 2026-09-22. **Scope decision required:** portfolio
aggregation is classified **DEFERRED — POST-MVP** in `MVP_FAST_TRACK.md`.
Implementation needs the owner to pull it forward (decision P0) and answer
P1–P8.
**Inspiration:** FXOptimize (public feature descriptions only; no code). It
combines several EA backtests on one simulated account. TRL keeps its
evidence rules: no lot rescaling, no margin claims, and no automatic "best
portfolio" selection.
**Relationship to M5:** separate. M5 continues one account over consecutive
periods. This package combines reports that trade **concurrently**.

## 1. Question answered

"If these selected strategies (each an MT5 Strategy Tester report) had traded
at the same time on one account, with the lot sizes they actually used, what
would the combined realised result have looked like, and how much did their
drawdowns overlap?"

## 2. Inputs and eligibility

- Two or more explicitly selected reports, each an independent M1 intake.
- Same source currency (P5; no conversion).
- Each report's verified close events are the contribution. Position opens,
  floating P/L, margin, and equity are unavailable.
- **Duplicate guard:** matching `(timestamp, deal id, symbol, P/L)` close events
  across two members block the combination (for example the same EA exported
  twice over overlapping periods). This is flagged, never silently deduplicated.
- The user declares the **combined starting capital** (P1).

## 3. Combination rule (v1, "as reported")

- Merge all members' verified close events into one chronological stream by
  report timestamp. Ties are ordered by member order, then source sequence.
- Combined realised balance = declared starting capital + cumulative sum of
  merged close-event net P/L.
- **No lot scaling, no re-sizing, and no equity or margin simulation.** Each
  EA's lots are exactly as in its own backtest, and each backtest ran on its
  own balance. Warnings state that compounding or margin interaction between
  EAs is not modelled.
- Window (P2): **common window**, the overlap of all members' spans (default),
  or **union**, with members contributing only inside their own span.

## 4. Outputs

- The combined realised-balance curve, plus per-member cumulative P/L curves on
  the same time axis.
- **C1 performance metrics on the combined stream** (reusing
  `performance_metrics` logic on the derived series).
- **Drawdown stacking:** the combined maximum drawdown next to each member's own
  maximum drawdown (within the same window) and their sum. The difference is
  shown descriptively as "drawdown overlap", never as a score.
- **Contribution table:** each member's net P/L, share of combined P/L, close
  events, and worst day.
- **Correlation matrix** of daily realised close-event P/L (report-clock days,
  P4) with the number of days used per pair.
- Monthly results and the daily calendar reuse the tier B display series.

## 5. Explicitly excluded (DEFERRED — POST-MVP)

- Automatic search over subsets, Pareto frontiers, ranking, or "optimal"
  portfolios (conflicts with the selection deferral).
- Lot or risk rescaling, weights, and equal-risk allocation (money management).
- Prop-firm pass rates, live account sync, and multi-currency conversion.

## 6. Owner decisions

| ID | Question | Proposed default |
| --- | --- | --- |
| P0 | Pull concurrent portfolio combination forward into the MVP track? | Owner choice. Recommended **yes, v1 "as reported" only**: it is the feature the owner expects from batch import. |
| P1 | Combined starting capital | **Declared by the user** (defaulting to the largest member opening balance, shown as `USER_SUPPLIED`). |
| P2 | Time window | **Common window** by default; union as an option. |
| P3 | Tie ordering for identical timestamps | Member order as selected, then source sequence. |
| P4 | Correlation days | **Days where either member has a close event**; zero-event days excluded; Pearson; `null` below 10 shared days. |
| P5 | Mixed currencies | **Blocked.** |
| P6 | Duplicate-event guard key | `(timestamp, deal id, symbol, net P/L)`; any match blocks. |
| P7 | Where it lives in the UI | A new **Portfolio** section beside Data & import, with its own dashboard. |
| P8 | Per-member weights (for example 0.5× an EA) | **No** in v1: it is a sizing change and therefore deferred. |

## 7. Fixture plan (outline)

Two synthetic members with known interleaved close events: exact merged order,
combined balance, combined MDD versus member MDDs, contribution sums equal to the
combined total, correlation on a hand-computed series, a duplicate-guard block,
a currency block, common-window versus union trimming, determinism, and the
immutability of member datasets.
