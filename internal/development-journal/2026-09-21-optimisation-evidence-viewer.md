# Milestone 6 Optimisation Evidence Viewer — 2026-09-21

## Delivered

Implemented the approved local MT5 SpreadsheetML parameter-grid evidence viewer.
The Core validates the expected worksheet, unique pass IDs, and at least one
`Inp*` parameter column; snapshots the source XML by SHA-256; writes bounded
Parquet pass rows and a JSON manifest; and returns source-preserved cells to the
Obsidian plugin. The plugin allows local XML selection plus inspection-only
sorting/filtering.

## Boundaries

`1-minute OHLC` is stored as a `USER_SUPPLIED` declaration, not inferred from
the XML. No reported metric is recomputed. No best pass, parameter selection,
robustness, portfolio, broker, prop-firm, or live-trading claim is produced. No
Markdown research document is written.

## Validation

- 41 Research Core tests passed, including parameter-grid snapshot/reuse and
  source-cell retention coverage.
- 7 plugin tests passed.
- Plugin production TypeScript/esbuild build passed.

## Owner review required

Complete the panel checks in
`MILESTONE_6_OPTIMISATION_ANALYSIS_DECISION_PACKAGE.md`.
