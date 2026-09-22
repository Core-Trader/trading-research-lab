# 2026-09-22 — MVP dashboard tier A (plugin-only)

**Track:** MVP Fast Track, MVP-B/MVP-C. Tier A of the backlog in
`internal/references/DASHBOARD_UX_RESEARCH.md`, approved by the owner.
**External code:** none reused. The tile-row, chart-tooltip, and uniform-state
patterns were independently implemented after reviewing Journalit screenshots
and `BaseWidget.tsx` concepts; nothing was copied, so
`EXTERNAL_CODE_USAGE_REGISTER.md` is unchanged.
**Core:** unchanged. Every displayed figure is a Core-supplied string.

## What changed

- **KPI tile row** on Overview (`components/dashboard-model.ts`, `dashboard-summary.tsx`):
  net close-event P/L, close events (wins/losses/breakeven), win rate, gross
  profit / loss, worst daily realised decline (date and % of the day's opening
  balance), and reported balance change. Colour comes from the sign of the
  Core string (`signTone`) with no arithmetic. A tile whose source was not
  calculated says "Not calculated" and offers the run action; a tile whose
  automatic calculation failed shows "Unavailable" and the Core error message.
- The earlier Verified balance, close-event, and daily-risk cards were replaced
  by the tiles. The Import → Analyse → Document strip is kept, since the owner
  accepted it.
- **Balance chart** (`components/balance-chart.tsx`, `chart-geometry.ts`): high
  and low y-axis labels (the Core strings of those points), first and last
  timestamps, a dashed opening-balance reference line, and a hover tooltip plus
  keyboard inspection (arrows, Shift+arrows, Home/End, Esc) showing the Core
  balance, timestamp, and source sequence. The caption states source-event order
  and "realised balance only, not intratrade equity". Used on Overview, Analysis,
  and the combined batch result.
- **Uniform card states** (`components/dashboard-card.tsx`): ready, loading
  skeleton, error, and empty with action. The first import shows skeleton cards.
- `research-view.tsx` now keeps per-card errors from the automatic post-import
  calculations; they clear when the matching manual run succeeds.

## Validation

- Plugin: 24/24 Node tests pass (9 new: chart geometry, KPI mapping and tone,
  error and not-calculated tiles).
- `npm run build` passes. Research Core is unchanged (42 tests at last run).
- Rendered the real components with synthetic data in a scratchpad harness
  served locally. Checked: desktop layout (6 tiles in one row), error tile, chart
  axes, hover tooltip flip, and loading skeletons.
- **Not validated:** inside Obsidian with a real report, Obsidian light theme,
  and true phone or narrow-pane widths (the browser mobile preset did not narrow
  the page). These belong to the owner review and the MVP-C narrow-width item.

## Notes

- Points are evenly spaced by source event order, not by time, as before.
- Local UI harness launch config lives in git-ignored `.claude/launch.json`.
