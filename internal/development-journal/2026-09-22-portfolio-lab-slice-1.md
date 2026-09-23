# 2026-09-22 — Portfolio Lab: scope approval and slice 1 (Core combination engine)

**Authority:** decisions PL-001 to PL-006 (`DECISION_LOG.md`) and
`PORTFOLIO_LAB_SPEC.md`. Scope records updated in `MVP_FAST_TRACK.md` (new
MVP-P stage) and `ROADMAP.md`. The draft `PORTFOLIO_CONCURRENT_COMBINATION.md`
is superseded.

## Implemented

- `portfolio_lab.py`: worker method `portfolio.combine(tracks, starting_capital,
  window?, day_boundary?)`, version `mvp-portfolio-combine-1`.
  - Tracks are lists of `dataset_ref`s. Multi-report tracks must pass the
    sequential checks (new `portfolio_preflight.preflight_datasets`, sharing
    the M5 rules via a refactored `_evaluate`; M5 behaviour and ids unchanged).
  - UNION and COMMON windows; merge order is timestamp, then track order, then
    source order; the combined balance starts from the user-declared capital.
  - Metrics via the new `performance_metrics.series_metrics` (the same code as
    C1/C2); per-track contribution and standalone maximum drawdown; drawdown
    overlap offset; pairwise daily-P/L Pearson correlation (≥ 10 days, days
    where either track traded); combined daily series; active-track spans.
  - Guards: track chain invalid, currency mismatch, duplicate close events
    (same timestamp, deal, symbol, and P/L), no common window, and
    configuration limits (1–10 tracks, one report per combination).
- Tests: P1–P13, P15, P16 (property check that combined maximum drawdown ≤ sum
  of standalone maximum drawdowns), configuration errors, and the worker. The
  Core suite is 107/107.

## Real-data check (owner reports, temporary workspace)

`DCA_EA` Jan–May and May–Sep 2026 chain into one track, combined with each
`EA_DCA_CENT_V1` report at 10,000 capital. For example, the 2024–2026 CENT
report plus the DCA chain (UNION): net 2661.45, realised maximum drawdown
48.74 (0.45%), return/drawdown 54.6, daily correlation 0.06 over 172 days.

**Interpretation:** realised-balance drawdowns of DCA EAs are tiny because
losses stay in open positions, which the reports do not show. This confirms
PL-006: no prop-firm conclusion may rest on these figures. The equity logger
comes first.

## Next

Slice 2 (plugin Portfolio section: track builder, track comparison, combined
dashboard). The Portfolio Lab analysis also needs an explicit on-screen
realised-balance caveat for DCA-style EAs.

## Slice 2 (2026-09-23): plugin Portfolio section

- New **Portfolio** workspace page (`components/portfolio/`):
  - `portfolio-lab.tsx`: report library (multi-file import through M1 intake,
    then registry refresh), track builder ("New track" / "Chain onto…",
    rename, include toggle, remove), starting capital (placeholder suggests
    the largest initial deposit), window (union/common), and combine with a
    stale-run guard.
  - `combined-dashboard.tsx`: KPI tiles, active-track bars, combined balance
    with stagnation band, drawdown chart, contribution table with standalone
    results, drawdown-overlap sentence, and a correlation matrix on a neutral
    colour scale (no good/bad colouring).
  - `portfolio-model.ts`: pure track operations and `spanTimeline`, with tests.
  - A permanent realised-balance caveat for DCA/grid/martingale EAs.
- Core `mvp-portfolio-combine-2`: a neutral correlation warning. The owner's
  real tracks correlate only 0.03–0.13, so "usually highly correlated" was
  wrong.
- Checked with the owner's real reports (three tracks including one chain) in
  the harness: net 2828.44, realised maximum drawdown 48.74 (0.45%), and a
  drawdown offset of 43.39 against standalone drawdowns summing to 92.13.
- Suites: Core 107/107, plugin 44/44, build passes. **Not validated in
  Obsidian**. The track-builder view was not rendered in the harness because
  it depends on the Obsidian runtime.
