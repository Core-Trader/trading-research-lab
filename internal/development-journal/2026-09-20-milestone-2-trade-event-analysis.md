# Milestone 2 — Trade and Event Analysis Implementation Record

**Date:** 2026-09-20  
**Status:** Implementation and owner validation in progress

## Scope implemented

- Source-verified close-event summaries remain separate from lifecycle results.
- Optional lifecycle reconstruction requires a displayed `USER_SUPPLIED`
  `HEDGING` declaration and applies `mt5-excel-hedging-fifo-v1`: chronological
  FIFO within the same symbol and direction.
- Partial allocation uses Decimal arithmetic. When an event is fully allocated,
  the final allocation receives the exact remaining source economics; unpaired
  volume is never given guessed P/L or duration.
- The worker writes compact, versioned M2 Parquet/JSON artifact references under
  its controlled dataset workspace. The plugin receives compact metrics only.
- The plugin displays source-verified close events and inferred lifecycles in
  distinct sections, including quality counts, policy, warnings, and the
  user-supplied account-mode status.

## Validation evidence

- Research Core: 16 pytest tests pass, including M2 FIFO, partial allocation,
  unpaired-event, account-mode, deterministic-artifact, and worker-IPC cases.
- Plugin: existing two safety tests and a production TypeScript/esbuild build
  pass after the M2 presentation change.

## Boundaries retained

M2 does not add forensic-EA ingestion, account-mode discovery, timezone
conversion, equity/drawdown/risk calculation, prop-firm overlays, portfolio
replay, optimisation, Monte Carlo, or any modification of M1 raw snapshots.

## Manual review required

Use a representative MT5 report in the Obsidian development vault. Review the
separate close-event and lifecycle panels under both `HEDGING` and `Not
declared`, then record acceptance or defects against
`MILESTONE_2_OWNER_REVIEW_CHECKLIST.md`. Do not close M2 before this review.
