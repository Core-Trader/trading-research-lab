# Milestone 6 — Paired Forward-Analysis Policy

**Status:** Accepted evidence-only paired viewer. No ranking or
parameter-selection feature is authorised.  
**Representative local evidence:**
`EA_DCA_CENT_V1_2020-2025.xml`,
`EA_DCA_CENT_V1_2020-2025_FORWARD.xml`, and
`EA_DCA_CENT_V1_FORWARD_IS.set`.

## Purpose

Preserve and display one explicitly declared in-sample parameter grid beside its
matched forward/out-of-sample grid. The capability is evidence comparison, not
parameter selection or proof of strategy robustness.

## Approved source facts for the representative pair

| Fact | Value | Source status |
| --- | --- | --- |
| Full tester period | 2020-01-01 to 2025-12-31 | XML title |
| In-sample period | 2020-01-01 to 2024-12-31 | USER_SUPPLIED |
| Forward period | 2025-01-01 to 2025-12-31 | USER_SUPPLIED |
| Symbol / timeframe | EURUSD / H4 | XML title |
| Server / deposit / leverage | RoboForex-Pro / 15000 USD / 1:1000 | XML metadata |
| Modelling mode | 1-minute OHLC | USER_SUPPLIED |
| Pair cardinality | 170 in-sample rows, 170 forward rows | XML tables |
| Pair identity result | 170 complete parameter signatures match | TRL source comparison |

## Strict input boundary

The first slice accepts exactly two explicitly selected local MT5 SpreadsheetML
XML parameter-grid exports plus a declared context object. Each source must have
the `Tester Optimizator Results` worksheet, unique non-empty `Pass` values, the
same ordered set of `Inp*` input columns, parameter and metric columns, and an
immutable SHA-256 snapshot before parsing artifacts are written.

The context object must explicitly declare in-sample/forward date ranges and
modelling mode as `USER_SUPPLIED`. It blocks missing, overlapping, or
non-contiguous ranges. Source XML facts remain authoritative.

## Pairing rule

Pair each row by the canonical ordered signature:

```text
<parameter column name>=<source cell value> | ...
```

MT5 `Pass` is retained as evidence but is **not** the pairing key. The Core must
block missing, duplicated, or different signatures, unequal row counts, and
must not silently use an intersection or discard rows.

## First-slice outputs

The Core writes versioned Parquet paired evidence plus JSON manifest. The plugin
shows both source identities, snapshot hashes, source metadata, declared
context, complete-pairing status, parameters, and source-reported in-sample and
forward metrics side by side. It may filter/sort for inspection only.

It must not score, rank, colour as preferred, select, recommend, or create a
research document from a row.

## Explicit exclusions

- selecting or recommending a parameter set;
- robustness score, overfitting probability, confidence claim, or threshold;
- recomputation of MT5 metrics, equity, drawdown, Sharpe, recovery factor, or
  profit factor;
- portfolio construction, currency conversion, broker/prop-firm compliance,
  live deployment, or automated EA `.set` generation;
- incompatible EA builds, testing contexts, or parameter schemas.

## Required deterministic fixtures

- complete two-row signature pairing;
- matching pass labels with different inputs blocks;
- complete signatures with different pass labels remains eligible;
- missing, extra, duplicate, or schema-different parameters block with no pair
  artifact;
- missing/overlapping/non-contiguous declared dates block;
- changed source/context gives a distinct result and preserves prior evidence;
- tampered snapshot blocks;
- the 170-pass local pair is smoke evidence only, never a source-controlled
  fixture.

## Owner approval and completed manual review

The owner approved the strict pairing, declared context, source-evidence-only
display, exclusions, and fixtures on 2026-09-21. The implementation snapshots
both local XML sources, blocks incomplete or ambiguous signatures, writes a
bounded Parquet table/JSON manifest, and displays source metrics side by side.
It creates no research document.

The owner completed the Obsidian review on 2026-09-21 and confirmed:

1. the two specified exports import as 170 complete parameter signatures;
2. the declared periods and `1-minute OHLC` display as user supplied;
3. source metric columns appear side by side with no score, recommendation, or
   `.set` export; and
4. the viewer creates no Markdown, strategy, experiment, or report.

## Original approval checklist

1. Approve strict two-file XML boundary and complete-signature matching.
2. Approve the user-supplied context fields and blocks.
3. Approve side-by-side source-metric display with inspection-only filtering.
4. Confirm no selection, threshold, score, recommendation, or `.set` export.
5. Approve fixtures and manual panel-review package.
