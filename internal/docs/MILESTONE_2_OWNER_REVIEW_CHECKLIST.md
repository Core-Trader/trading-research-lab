# Milestone 2 — Owner Review Checklist

Approved and manually accepted by the owner on 2026-09-20. Keep this checklist
with the M2 closure evidence.

- [x] **Inference boundary:** allow optional inferred lifecycles for a
      user-declared `HEDGING` analysis, while unknown/netting reports remain
      event-level in M2.
- [x] **Matching rule:** approve chronological FIFO within the same symbol and
      direction as `mt5-excel-hedging-fifo-v1`.
- [x] **Partial closes:** approve Decimal volume-proportional economics with a
      deterministic final-allocation remainder rule, fully recorded in output.
- [x] **Quality presentation:** approve separate verified close-event and
      inferred-lifecycle metrics, with no silent mixed-quality totals.
- [x] **Metrics:** approve count, net P/L, gross profit/loss, win/loss/
      breakeven counts/rates, quality counts, and distributions as M2 scope.
- [x] **Account mode:** approve displaying the supplied `HEDGING` declaration
      as `USER_SUPPLIED`; it is not fetched from a regular MT5 Excel export.
- [x] **Fixtures and acceptance:** approve the synthetic fixture plan and manual
      review checklist in `MILESTONE_2_FIXTURE_PLAN.md`.
- [x] **Scope boundary:** confirm M2 excludes timezone conversion, equity/risk,
      prop-firm policy, portfolio replay, optimisation, and forensic-EA import.
