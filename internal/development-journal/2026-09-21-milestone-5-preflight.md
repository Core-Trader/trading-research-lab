# Milestone 5 — Sequential Batch Preflight Implementation Record

**Date:** 2026-09-21  
**Status:** Closed; implementation and owner validation completed on 2026-09-21

## Delivered

- Core method `portfolio.preflight_mt5_excel_batch` independently intakes or
  reuses each explicitly selected MT5 Excel report under M1 rules.
- Preflight returns only ordered member evidence and `ELIGIBLE`/`BLOCKED`
  findings for duplicate source hashes, shared deal identifiers, overlapping
  event coverage, currency mismatch, ambiguous order, and balance discontinuity.
- The result labels same-account membership as
  `USER_SUPPLIED_SINGLE_ACCOUNT` and retains M3's equity limitation.
- Obsidian now provides an add-to-list report picker: reports can be added one
  at a time or through native multi-file selection, reviewed by name, removed,
  or cleared before submission. The compact preflight panel has no combined-
  automatic-document action.
- Eligible batches now have a separately confirmed action that writes a bounded
  Parquet combined realised-balance table plus JSON manifest. It creates no
  Markdown research document, equity result, or daily portfolio metric.
- The panel can now display the created combined realised-balance summary and
  source-qualified curve, then run a separate qualified report-clock daily
  realised-balance drawdown. The gap warning remains visible; equity and
  prop-firm calculations remain unavailable.

## Validation evidence

- Research Core: 27 pytest tests pass, including M5 preflight, bounded-artifact,
  qualified-drawdown, and worker-capability coverage.
- Plugin: 7 existing automated tests and production TypeScript/esbuild build
  pass.
- Isolated technical verification using `s1_EURUSD.xlsx` and `s2_EURUSD.xlsx`:
  the pair is `ELIGIBLE`; the explicit artifact has 116 source balance rows,
  `10,000.00 → 10,237.25 USD`, and `+237.25 USD`; the qualified worst observed
  daily realised-balance drawdown is `16.85 USD` on `2026-01-30`. The expected
  `DEAL_ID_REUSED` and `GAP_UNDETERMINED` warnings remain visible.

## Owner review outcome

The owner confirmed the visual Obsidian review. The selected-batch workflow and
qualified daily-drawdown presentation passed review. M5 closure evidence is
recorded in `internal/docs/MILESTONE_5_CLOSURE_REPORT.md`.
