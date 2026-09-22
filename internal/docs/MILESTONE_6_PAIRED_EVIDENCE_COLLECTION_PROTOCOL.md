# Milestone 6 — Paired Optimisation Evidence Collection Protocol

**Status:** Active collection guidance; no new calculation or selection feature.  
**Purpose:** make future MT5 optimisation/forward exports comparable with the
accepted paired-forward evidence viewer while automatic selection remains
deferred.

## What counts as one comparable pair

One pair contains:

1. an in-sample MT5 SpreadsheetML XML parameter-grid export; and
2. a forward MT5 SpreadsheetML XML parameter-grid export for the same EA build,
   symbol, timeframe, optimisation input schema, tested parameter grid, account
   context, and explicitly declared contiguous periods.

The two exports must have one row for every tested parameter combination. MT5
`Pass` values are retained as source evidence but are not relied on as the pair
key.

## Before running MT5

Record these facts beside the exports in a short local context note:

- EA name and build or source revision identifier;
- symbol and timeframe;
- account/server name, deposit currency, initial deposit, and leverage when
  shown by MT5;
- in-sample start/end and forward start/end dates;
- modelling mode and spread/execution settings when known;
- tested inputs, ranges, step semantics, and the `.set` file if used; and
- any deliberate differences from an earlier pair.

Do not describe unrecorded facts as source facts. Use `USER_SUPPLIED` for
details supplied outside the XML report.

## Export and naming convention

Export both grids as MT5 SpreadsheetML XML and retain the original files
unchanged in `data/raw`. Use a clear paired stem, for example:

```text
EA_DCA_CENT_V1_EURUSD_H4_2020-2024_IS.xml
EA_DCA_CENT_V1_EURUSD_H4_2025_FORWARD.xml
EA_DCA_CENT_V1_EURUSD_H4_2020-2025_context.md
```

Names assist human review only; the Core validates content and snapshots the
chosen files rather than trusting a filename.

## Manual checks before import

- Confirm both files are parameter grids, not aggregate multi-symbol results.
- Confirm the same `Inp*` columns appear in the same order.
- Confirm every intended parameter combination appears once in each file.
- Confirm the forward period begins on the day after the in-sample period ends.
- Confirm no EA/build, symbol, timeframe, input grid, modelling, or account
  change is being silently treated as comparable evidence.

If a fact differs, retain the pair as separate evidence. Do not force it into
an earlier comparison.

## What the accepted viewer will and will not establish

The viewer can preserve and show complete parameter-signature pairings and
MT5-reported metrics side by side. It does not establish causal performance,
robustness, future profitability, a preferred parameter set, or live-trading
suitability.

## Review trigger

After at least several like-for-like pairs exist, the owner may reopen
`MILESTONE_6_PARAMETER_SELECTION_DECISION_PACKAGE.md`. That review must choose
an explicit research objective and evidence policy before any ranking or
screening feature is considered.
