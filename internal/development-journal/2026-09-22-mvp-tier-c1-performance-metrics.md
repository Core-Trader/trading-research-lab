# 2026-09-22 — Tier C1 performance metrics; Van Tharp and visualisation drafts

**Authority:** `MVP_TIER_C_PERFORMANCE_METRICS.md`. The owner accepted all
defaults D1–D7 on 2026-09-22.
**External code:** none. Van K. Tharp concepts are recorded as concepts only.

## Implemented (C1)

- Core `performance_metrics.py`, worker method `analysis.performance_metrics`,
  calculation version `mvp-performance-metrics-1`:
  - Balance basis: maximum drawdown (amount, % of high-water mark at the
    trough, peak/trough/recovery), return/drawdown, and a full drawdown series.
  - Stagnation: longest by time, longest by close events, and ongoing. A new
    high must be strictly higher.
  - Close events: profit factor (null `NO_LOSSES`/`NO_CLOSE_EVENTS`), average
    win and loss, payoff, expectancy, and longest winning and losing streaks
    (breakeven ends a streak).
  - Quotients are 8 dp `ROUND_HALF_EVEN`; sums are exact. No artifact is written.
- Plugin: six new KPI tiles, a longest-stagnation band on the balance curve, a
  drawdown (underwater) chart under it, and a streak line in the close-event
  card. Values are rounded to 2 dp for display, with the exact Core value on
  hover. Undefined values show their reason ("No losses", "No drawdown").
- Fix found by the compiler: the new state variable `performance` shadowed the
  global `performance.now()` used by run diagnostics; renamed to
  `performanceMetrics`.

## Validation

- Core 68/68: fixtures F1–F13 from the spec as exact-string tests, plus
  structured-error and worker-exposure tests.
- Plugin 36/36 (performance tiles, reasons, pending and error states, service
  mapping). Build passes.
- End to end without Obsidian: a synthetic 160-trade report run through the
  real worker and rendered by the real components. Expectancy, profit factor,
  and return/drawdown were checked by hand against the raw sums.
- **Not validated:** Obsidian with a real report, light theme, narrow panes.

## Drafted (not implemented)

- `MVP_TIER_C2_VAN_THARP_METRICS.md`: R-multiples, R distribution, expectancy
  (R), SQN (raw and N capped at 100), and opportunity/expectunity. It uses a
  declared 1R or an average-loss proxy, because verified 1R is not available:
  MT5 Orders carry S/L **prices**, but no tick value or contract size, and DCA
  entries share stops. Decisions T1–T7 are pending.
- `MVP_VISUALISATION_AUDIT.md`: 13 modules reviewed. The highest-value
  plugin-only next visuals are V2 (paired-forward scatter) and V3 (optimisation
  scatter/heatmap), with no-selection guardrails.
