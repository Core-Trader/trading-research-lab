# 2026-09-24: Symbol scan (MT5 symbol sweep import)

The owner supplied three sweeps (`data/raw/SYMBOL-SWEEP-1..3.xml`, git-ignored):
- **EAs:** EA_DCA_CENT_V1, Jagfx-DCA_V2.0.4, and DCA_EA
- **Test:** each on the same 20 forex symbols, H4, 2025-03-01 to 2026-03-01
- **Account:** RoboForex-Pro, 15 000 USD at 1:1000

Before this work, TRL rejected them; its first importer rejected a sweep file
on purpose (it is not a parameter grid).

## Decisions

- Owner-approved: S1–S8 as recommended, and S9 (at most 6 sweeps compared at
  once; a design choice).
- The owner asked for UX and design coherence. The page therefore reuses the
  Parameters page patterns:
  - numbered sections
  - Browse buttons with editable paths
  - a declared modelling mode
  - the filter editor
  - the shared trade-off scatter
  - the neighbourhood-style shaded grid
  - the guidance block and the audit trail
  - the same "record in Experiment note" block

## Core (`symbol_sweep.py`, `mt5-symbol-sweep-1`)

- **Import:**
  - snapshot the raw file (SHA-256; re-import returns the existing record)
  - keep the metric strings exactly as exported, with the metric ids from
    the parameter-exploration catalogue
  - read the title (EA, chart symbol, timeframe, dates) and properties
    (server, deposit, leverage, build)
  - record a declared `.set` as DECLARED_NOT_VERIFIABLE, with its input values
- **Refusals:**
  - parameter grids and exports with input columns, which point to the
    Parameters page
  - duplicate symbols
  - no Symbol column
  - no declared mode
- **Evaluation and comparison:**
  - evaluation uses the shared `pareto.py` (checked against a brute force)
  - comparison lists differences (period, timeframe, deposit, leverage,
    server, mode) and marks untested symbols; 2 to 6 sweeps
- **Shortlist:** Markdown with the sweeps and the next step (workflow step 3).
- **Tests:** 7 new, including exact parsing of the owner's files; the Core
  total is 266.

## Plugin

- **Page:** Symbol scan, first in the Research group (icon `scan-search`).
- **Sections:**
  1. import
  2. library, with open, compare (up to 6), and delete
  3. symbols: axes, filters, scatter (click a point to shortlist), a
     sortable table, guidance, audit
  4. comparison grid, shaded by the metric's own direction
  5. record the shortlist
- **Model tests:** formatting by unit, sorting, shading, guidance. The plugin
  total is 102; the build is clean.
- **Harness with real Core output** (3 sweeps):
  - library 3 rows; 20 points and 20 table rows
  - grid 3 × 20 with 60 shaded cells, and no differences banner (the sweeps
    are like-for-like)
  - no page overflow at 1280 or 620 px
  - shortlist then record works
- **One UX fix from the check:** the "recorded" confirmation moved next to
  the Record button, because at the top of the page it was out of view.
- The Research workflow guide, step 2, now points to the page, and the gap
  is removed.
- Screenshots timed out in the pane, so the checks were done on the DOM.

**The owner still needs to** review the page visually in Obsidian.
