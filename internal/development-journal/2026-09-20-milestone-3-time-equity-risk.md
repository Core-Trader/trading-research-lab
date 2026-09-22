# Milestone 3 — Time, Equity, and Risk Foundation Implementation Record

**Date:** 2026-09-20  
**Status:** Implementation and owner validation in progress

## Scope implemented

- Default report-clock grouping: timestamps and report dates are used exactly as
  supplied and labelled `SOURCE_REPORTED_CLOCK`; no timezone conversion occurs.
- `generic-realised-balance-daily-drawdown-v1`: Decimal-safe maximum decline
  from each report-date realised-balance high-water mark, with partial edge-day
  coverage warnings and controlled Parquet/JSON artifacts.
- Explicit intratrade-equity availability: MT5 Deals exports produce
  `UNAVAILABLE`, including the evidence required for a future verified result.
- Obsidian displays compact M3 result/availability data returned by the Python
  Research Core; it contains no financial formula.

## Validation evidence

- Research Core: 20 pytest tests pass, including source-clock, daily-drawdown,
  unavailable-equity, deterministic-artifact, and worker-IPC coverage.
- Plugin: 2 safety tests and the production TypeScript/esbuild build pass.

## Deliberate deferrals

Optional broker-time conversion, intratrade marks/equity reconstruction,
currency conversion, daily-loss breach decisions, and all broker/prop-firm
rules remain out of M3 baseline scope.

## Manual review required

Use a representative MT5 report in the Obsidian development vault. Confirm the
report-clock basis, realised-balance-only label, partial-coverage warning,
worst-day result, and explicitly unavailable equity result against
`MILESTONE_3_OWNER_REVIEW_CHECKLIST.md`. Do not close M3 before this review.
