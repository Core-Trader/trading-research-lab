# Milestone 6 — Optimisation Analysis Decision Package

**Status:** Accepted first-slice evidence viewer. No ranking or parameter
selection is authorised.  
**Representative sources reviewed:**
`data/raw/ReportOptimizer-52010662.xml` and
`data/raw/EA_DCA_CENT_V1_parameter_optimisation.xml` (local-only MT5
SpreadsheetML exports).

## Discovery result

The first source is a well-formed SpreadsheetML workbook with one `Tester
Optimizator Results` worksheet and seven aggregate rows—one per symbol. It is a
**multi-symbol Strategy Tester results table**, not a parameter grid.

The newly supplied parameter-optimisation source is also a well-formed
SpreadsheetML workbook with one `Tester Optimizator Results` worksheet. It
contains **162 pass rows** and report-level title, server, deposit, leverage,
and creation metadata. Its tested context is titled `EA_DCA_CENT_V1 EURUSD,H4
2026.01.01-2026.05.19`. Each row carries pass identity, reported metrics, and
the four evidenced EA input values: `InpMultiplierSystem`, `InpInitialLot`,
`InpQQEOverbought`, and `InpQQEOversold`.

This second source is an evidenced **parameter grid**. It does not, however,
establish an in-sample/out-of-sample split, forward-test outcome, a recorded
modelling mode, all tester conditions, or a predeclared parameter-selection
rule. Its reported metrics are source facts, not TRL recomputations.

The subsequently supplied `EA_DCA_CENT_V1_IS_2020-2024.xml` and
`EA_DCA_CENT_V1_FORWARD_2025.xml` exports are valid independent parameter grids,
but are **not a safely paired forward set**: they share 170 numeric pass labels
but only 11 complete four-input parameter combinations. Pass identity alone is
therefore explicitly unavailable as a forward-pairing key. The local context
record is `data/raw/EA_DCA_CENT_V1_context_2020-2025.md`.

A later full-run pair, `EA_DCA_CENT_V1_2020-2025.xml` and
`EA_DCA_CENT_V1_2020-2025_FORWARD.xml`, has 170 matching complete parameter
signatures across 170 rows. The owner supplied the forward partition as
`2025-01-01` through `2025-12-31` (in-sample `2020-01-01` through
`2024-12-31`). It is ready for a future paired forward-analysis policy, not for
selection or robustness claims.

## Recommendation

Approve an initial **source-preserving MT5 parameter-grid evidence viewer**. It
may import and display the reported metadata and all pass rows exactly as
supplied, with source hash, parameter-cell provenance, and explicit limitations.
It may support user-directed table sorting/filtering for inspection, but it must
not call any row “best,” select a parameter set, merge rows into a portfolio,
recompute reported metrics, or claim robustness.

The seven-row multi-symbol table may be supported later as a distinct qualified
source type. It must never be presented as parameter optimisation.

## Minimum source evidence for future parameter analysis

- exact EA identity, version/build, and input parameter names, values, ranges,
  and steps for each pass (the current source establishes names and values, but
  not separately recorded ranges/steps);
- tester symbol(s), timeframe(s), date range, modelling/test conditions, broker
  environment, deposit/currency/leverage, and source report hash;
- the reported optimisation objective and all imported result columns;
- pass identity that is unique within the source export;
- explicit in-sample, forward/out-of-sample, or unavailable label for every
  result;
- declared selection rule established before viewing the candidate outcome;
- any filtering/exclusions, manual changes, and reruns recorded as configuration
  rather than silently applied.

## First-slice input and behaviour boundary

If the owner approves the evidence-viewer slice, it must:

1. accept only an explicitly selected local MT5 SpreadsheetML/XML export;
2. create or reuse an immutable managed snapshot and record source hash;
3. preserve report-level metadata and table cells as supplied, including missing
   values and labels;
4. identify the new source as `PARAMETER_GRID_IN_SAMPLE_OR_UNDECLARED` and the
   older seven-row source as `MULTI_SYMBOL_AGGREGATE_RESULTS`;
5. display source facts separately from TRL-derived availability/limitations;
6. write only versioned canonical table/manifest artifacts, never modify source;
7. allow inspection-only sorting/filtering, but block parameter selection,
   robustness scoring, recommendation, portfolio construction, and optimisation
   claims beyond the source facts.

## Explicit exclusions

- automatic “best pass” or “best symbol” recommendation;
- parameter selection or live-trading recommendation;
- confidence, robustness, walk-forward, or out-of-sample claims without the
  required source evidence;
- recomputation/normalisation of profit factor, Sharpe, recovery factor, or
  equity drawdown percentage;
- cross-currency comparison, aggregation, portfolio construction, or prop-firm
  compliance;
- external optimiser invocation, strategy generation, and direct broker access.

## Required deterministic fixtures if the viewer slice is approved

- representative valid parameter-grid SpreadsheetML table with exact metadata,
  row-cell, pass, and input-parameter retention;
- missing worksheet/header/required identity field blocks with no artifact;
- duplicate or ambiguous pass identity is retained and visibly qualified, never
  silently deduplicated;
- modified source creates a distinct managed snapshot/identity;
- tampered managed snapshot blocks evidence use;
- a parameterless multi-symbol table is marked unavailable for parameter
  selection;
- a parameter grid with no in/out-of-sample label permits evidence viewing but
  blocks every selection/robustness claim;
- a future selection-mode fixture blocks missing in/out-of-sample labels and
  missing user-approved selection configuration.

## Approved first-slice decisions

The owner approved the parameter-grid evidence-viewer slice on 2026-09-21:

- MT5 XML SpreadsheetML parameter-grid sources are accepted;
- the current modelling setting is recorded only as `USER_SUPPLIED`, with
  `1-minute OHLC` declared for the representative export;
- sorting/filtering is inspection only;
- no ranking, recommendation, selection, or portfolio aggregation occurs;
- out-of-sample/forward evidence remains required before a later selection or
  robustness workstream.

The Core snapshots the original XML, writes a bounded Parquet table and JSON
manifest, preserves all reported cells, and returns the evidence grid to the
desktop plugin. It creates no research document.

## Manual owner review required

Before implementation, confirm:

1. browse to and import `EA_DCA_CENT_V1_parameter_optimisation.xml`;
2. confirm the displayed pass count is 162 and the four input columns appear;
3. confirm `1-minute OHLC` appears as `USER_SUPPLIED`, not source-reported;
4. sort and filter rows, then confirm that no “best” pass or selection control
   appears;
5. confirm the warnings state that forward/out-of-sample evidence is absent;
6. confirm no strategy, experiment, report, or Markdown document is created.
