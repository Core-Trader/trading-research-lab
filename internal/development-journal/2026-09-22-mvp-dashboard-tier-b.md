# 2026-09-22 — MVP dashboard tier B (Core display series + Monte Carlo visuals)

**Track:** MVP Fast Track. Tier B of `internal/references/DASHBOARD_UX_RESEARCH.md`,
owner-approved with the two Monte Carlo additions (confidence table, path fan).
**External code:** none reused. StrategyQuant concepts only (MC fan and
confidence table; monthly table; P/L calendar), independently implemented;
`EXTERNAL_CODE_USAGE_REGISTER.md` unchanged.

## Research Core

- New `display_series.py` and worker method `analysis.close_event_display_series`
  (`mvp-close-event-display-series-1`). It returns per-event net P/L (bounded to
  2,000 events; above that the bars are **omitted, not downsampled**) and exact
  Decimal sums of verified close-event net P/L per report-clock day, ISO 8601
  week, month, and year, with close-event, win, and loss counts. Balance
  operations are excluded, there is no timezone conversion, and no artifact is
  written.
- Monte Carlo calculation version `m6-monte-carlo-order-permutation-3` adds
  `drawdown_percentiles` (p50/p80/p90/p95/p99, nearest-rank) and a bounded
  `path_fan` (historical path + first 100 generated paths, `EVEN_INDEX_SAMPLE_V1`
  above 250 points). Spec updated in `MILESTONE_6_MONTE_CARLO.md`. Path
  generation is unchanged: a test pins path drawdowns produced by the committed
  version-2 code.

## Plugin

- `ResearchService.closeEventDisplaySeries`; the series is fetched automatically
  after import and again after a manual trade-analysis run, with its own card
  error state.
- Overview: close-event P/L bars (hover/keyboard tooltip), daily P/L calendar
  (Monday-first, ISO-week totals, month navigation, intensity shading), and a
  year × month table with Core yearly totals ("—" = no events, not zero).
  Research documents moved beside the bars; the grid is now a fixed 3 columns
  (1 column below 58rem).
- Advanced → Monte Carlo: percentile table and path fan under the histogram.
- `display-format.ts`: presentation-only rounding of Core percentage strings to
  2 dp (string-based, half away from zero) with the exact value on hover, plus
  readable timestamps. This was added after rendering real Core output showed
  values such as `1.7172728619735802723136467%`.
- `tsconfig.json`: `noEmit` + `allowImportingTsExtensions`, so modules loaded by
  the Node test runner can import sibling runtime modules with `.ts` extensions.

## Validation

- Core: 53/53 pytest (11 new: grouping, ISO week at a year boundary, exact
  Decimal sums, reconciliation with the close-event summary, omission bound,
  bad timestamps, worker exposure, percentile monotonicity, fan bounds and
  sampling, fan-to-artifact consistency, version-2 pin).
- Plugin: 33/33 Node tests (bar/multi-line geometry, intensity, calendar
  layout including ISO weeks, display rounding, service mapping). Build passes.
- End to end without Obsidian: a synthetic 160-trade report was run through the
  real `Worker.dispatch`, and the JSON was rendered by the real components in a
  local harness. The W23 calendar total equals the sum of its days; monthly
  and event sums equal net P/L (711.42).
- **Not validated:** inside Obsidian with a real MT5 report, light theme, and
  narrow panes.

## Open points

- The Core emits unquantised percentages (for example `win_rate`,
  `maximum_drawdown_percent`). The plugin rounds for display only. Whether the
  Core should quantise these fields is a later calculation-policy decision.
