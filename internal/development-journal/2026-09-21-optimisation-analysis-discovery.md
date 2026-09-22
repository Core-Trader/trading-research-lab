# Milestone 6 Optimisation-Analysis Discovery — 2026-09-21

## Work completed

Reviewed the local representative MT5 export
`data/raw/ReportOptimizer-52010662.xml` and prepared the optimisation-analysis
decision package. No importer, calculation, UI, artifact, or external source
reuse was added.

## Source finding

The first XML SpreadsheetML workbook contains report metadata and seven
aggregate symbol rows with reported performance values. The newly supplied XML
contains 162 pass rows and four explicit tested EA inputs per pass:
`InpMultiplierSystem`, `InpInitialLot`, `InpQQEOverbought`, and
`InpQQEOversold`. It still does not contain in/out-of-sample labels, forward
outcomes, recorded modelling mode, or an established selection rule.

## Decision recommendation

The potentially safe first slice is source-preserving intake and inspection of
the qualified parameter-grid table. It may sort/filter for reading but cannot
rank/select parameters, recommend a pass, form a portfolio, or claim robustness.
Genuine parameter-selection analysis stays blocked until forward/out-of-sample
evidence and a predeclared selection policy are available and approved. The
later supplied 2020–2024 and 2025 XML exports were checked: numeric MT5 pass IDs
are not safe pairing keys because only 11 complete input combinations match.

A subsequently supplied full-run 2020–2025 pair was also checked: all 170
complete parameter combinations match. It is suitable for a future pairing
feature. The owner supplied the forward partition as 2025-01-01 through
2025-12-31; no paired-analysis implementation is authorised yet.

## Manual owner review

Review `MILESTONE_6_OPTIMISATION_ANALYSIS_DECISION_PACKAGE.md` and decide
whether to approve the limited evidence-viewer slice and its source boundary.
