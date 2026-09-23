# UI/UX pass: audit and proposal

**Status:** APPROVED in full (D1–D5) and IMPLEMENTED 2026-09-24; see
`internal/development-journal/2026-09-24-ui-ux-pass.md`. Revert tag:
`plugin-pre-uiux-pass`.
The owner's brief covers sections 1–4, with the hard rule that all guidance
must come from computed, verified results.

## 1. Audit (ordered by impact)

1. **The Advanced page is a wall of raw output.**
   - What-If and Monte Carlo render as 11–12-row definition lists. The few
     numbers that matter sit among plumbing: analysis basis, policy id,
     input artifact, artifact id, PRNG, seed, and path indices.
   - The two optimisation evidence viewers dump full tables with source
     hashes and typed-path inputs.
2. **Results come without interpretation.**
   - Monte Carlo shows `min / p05 / p50 / p95 / max` in currency only, with
     no link to account size or decisions.
   - The fan draws 100 overlapping lines with no band.
   - The historical order's own drawdown is never placed among the shuffles.
3. **Milestone jargon and raw codes are in user-facing text**:
   - buttons: "Run M2 trade analysis", "Run M3 daily balance analysis",
     "Run M6 fixed-cost scenario", "Run M6 Monte Carlo shuffle"
   - status lines: "M3 basic analysis completed…", "M2 analysis completed…",
     "M6 What-If…"
   - "Not captured in M0"
   - `USER_SUPPLIED` in field labels
   - raw enums `MT5_VERIFIED`, `INFERRED`, `UNAVAILABLE`
4. **Provenance and plumbing appear in the main views**: dataset refs,
   SHA-256 hashes, snapshot paths, adapter ids, and canonical artifact ids
   (full list in §3).
5. **The Advanced page overlaps the Parameters page.** The M6 "Optimisation
   parameter-grid evidence" and "Paired forward evidence" viewers predate the
   Parameters study and forward attach, and give a worse version of the same
   job (typed paths, `USER_SUPPLIED` date fields, raw tables).
6. **Charts are inconsistent.** The Monte Carlo histogram and fan are not in
   `ChartFrame` (no Expand); the histogram has no reference lines. Some
   results use KPI tiles (Overview, Portfolio), others plain lists.
7. **Sidebar polish:** nested items are indented, the text sits far from the
   left edge, and there are no icons.

## 2. Side menu (proposal §1)

- **Spacing:**
  - container side padding from `0.25rem` to `0`
  - group headings from `0.4rem` to `0.15rem` left padding
  - item buttons from `0.5rem` to `0.25rem` left padding
  - the report card keeps its inner padding but aligns to the same left edge
- **Icons:**
  - The project has **no icon library** (dependencies: react and react-dom
    only).
  - Obsidian's own API ships **Lucide** icons through `setIcon(el, id)`: no
    new dependency, and it matches Obsidian's look.
  - Proposed ids:
    - Overview `layout-dashboard`
    - Data & import `file-input`
    - Analysis `line-chart`
    - Portfolio `layers`
    - Parameters `sliders-horizontal`
    - Advanced `flask-conical`
    - Research notes `notebook-pen`
    - Help `life-buoy`
    - the report card `file-check`
  - Each id is checked with `getIconIds()`, with no icon if it is missing
    (older Obsidian).

## 3. Hide technical internals (proposal §2)

A single reusable **"Technical details · audit trail"** block, collapsed by
default, sits at the bottom of each result card or page. Nothing is deleted:
the same fields and buttons move there.

| # | Element | Where now | Proposed |
| --- | --- | --- | --- |
| 1 | "Technical source evidence" panel: dataset ref, source SHA-256, managed snapshot status and path, adapter id/version/mode, event count and quality code, observed price scales, canonical artifact ids, warnings, limitations, Verify button | Data & import | Audit trail at the bottom of the page. **Non-empty warnings** are also surfaced as a notice in the step-1 summary. |
| 2 | Status line "Managed raw snapshot verified: `<sha>`" | Data & import status | "Snapshot verified"; the hash goes to the audit trail |
| 3 | "Dataset: `mt5:<sha>`" | Analysis → Verified results | Audit trail |
| 4 | "Equity curve: `UNAVAILABLE` — reason" line | Analysis → Verified results | Removed from this card; the Equity section already covers it, and the reason moves to the audit trail |
| 5 | Analysis basis, Policy id, Artifact id; quality counts shown as `MT5_VERIFIED` / `INFERRED` | Analysis → Trade and event analysis | Audit trail; the counts shown in words ("verified closes", "inferred lifecycles") |
| 6 | Analysis basis, Policy id, Artifact id | Analysis → Time, balance, and risk | Audit trail |
| 7 | "Intratrade equity: Status `UNAVAILABLE` / Required later evidence" block | Analysis → Time, balance, and risk | Replaced by one sentence pointing to the Equity section |
| 8 | What-If: Analysis basis, Policy, Input artifact, Artifact | Advanced | Audit trail |
| 9 | Monte Carlo: Analysis basis, Method (sampling, PRNG), Input artifact, least/worst path index | Advanced | Audit trail; the **seed stays visible** next to the result for reproducibility |
| 10 | Optimisation and paired-forward viewers: source hashes, snapshot, artifact | Advanced | Audit trail (see decision D1) |
| 11 | "Local run diagnostics" (timings, worker handshake, "not captured in M0") | Data & import | Hidden behind a setting, "Show developer diagnostics" (D3) |
| 12 | Milestone codes in labels, buttons and status (M0/M2/M3/M6); `USER_SUPPLIED`, `MT5_VERIFIED`, `INFERRED`, `UNAVAILABLE` | Various | Replaced by words ("Run trade analysis", "declared by you", "verified", "inferred", "not available"); the raw codes stay in the audit trail |

## 4. Advanced panel visuals (proposal §3)

- **What-If (fixed cost):**
  - Two KPI tiles, **Net P/L before** and **after**, with a coloured delta
    badge.
  - Two 100% bars showing wins / losses / breakevens before vs after; counts
    on hover.
  - The declared cost is shown as the input echo.
  - Exact values in each tile's tooltip and in "Details".
- **Monte Carlo**:
  - **Summary card:** tiles for *Median worst drawdown* (p50), *95th
    percentile* (p95), *Worst reordering* (max), and *Your actual order*
    (new, see C1).
  - **Percentile strip:** one horizontal axis with markers for min, p05, p50,
    p95, and max, plus a highlighted marker for the historical order. Hover
    shows exact values.
  - **Histogram in `ChartFrame`** (Expand), with vertical reference lines at
    p50 and p95 and at the historical drawdown; axis labels in currency.
  - **Fan as a band:** a shaded 5th–95th percentile band of cumulative P/L
    at each sampled point, a median line, and the historical path on top, in
    `ChartFrame`. This needs Core percentile bands (C1). The 100 raw paths
    become an optional "show sample paths" toggle.
  - The percentile table moves under "Exact values" (collapsed).
- **Optimisation parameter-grid and paired-forward viewers (D1):** replace
  with a short card, "Parameter studies and forward checks now live on
  **Parameters**", with a link. The logic and stored evidence are kept. If
  the owner prefers to keep them, they become a summary card (passes,
  inputs, modelling) with the table collapsed.

## 5. Interpretation and tips (proposal §4)

**Hard rule.** Every sentence below is filled from Core fields. Comparisons
(ranks, percentages, differences, ratios) are calculated in the **Core**, not
the plugin, because the plugin never duplicates quantitative calculation.
Anything without a Core source is left out and flagged.

### Monte Carlo: How to read this

| Draft text | Data source |
| --- | --- |
| "Each of the **{path_count}** paths replays your same **{population_count}** closed trades in a different order. Every path ends at the same total (**{invariant_final_pnl} {ccy}**); only the drawdown along the way changes." | `configuration.path_count`, `population_count`, `invariant_final_pnl` (existing) |
| "Half of the reorderings had a worst drawdown of **{p50} {ccy}** or less, 95% had **{p95} {ccy}** or less, and the worst had **{maximum} {ccy}**." | `drawdown_summary.p50 / p95 / maximum` (existing) |
| "Your actual trade order had a worst drawdown of **{historical_max_drawdown} {ccy}**. That is deeper than **{historical_rank_percent}%** of the reorderings." | **New (C1):** `historical_max_drawdown`, `historical_rank_percent` |
| "The shaded band holds the middle 90% of paths at each point. It is widest after trade **{widest_at_event}**, where it spans **{widest_band} {ccy}**: the order in which trades arrive moves the running total by up to that much." | **New (C1):** `fan_bands` (p05/p50/p95 per sampled index), `widest_band`, `widest_at_event` |
| "These drawdowns are measured on closed-trade P/L from zero, not account equity." | Existing warning; restated plainly |

### Monte Carlo: Tips

1. **Sizing:** "At this report's size, the 95th-percentile drawdown is
   **{p95_percent_of_opening}%** of the starting balance
   (**{opening_balance} {ccy}**). If that is more than you would accept,
   reduce position size in proportion; drawdowns here scale with lot size."
   - Source: **new (C1)** `p95_percent_of_opening` and `opening_balance`,
     from the dataset's opening balance.
   - "Scale with lot size" holds because the method only reorders fixed P/L
     values: halving the P/L halves every drawdown.
2. **Ordering luck:** "Your real order was deeper than
   **{historical_rank_percent}%** of reorderings, so the history may have
   been [unluckier / luckier] than typical." [Unluckier or luckier] is chosen
   by the Core, comparing the historical drawdown with p50.
   - Source: **new (C1)** `historical_vs_median` = "DEEPER" / "SHALLOWER" /
     "EQUAL".
3. **Equity reality check** (only when an equity log is attached): "This
   report's equity drawdown was **{ratio}×** its closed-trade drawdown, so
   the drawdowns above understate the risk."
   - Source: equity metrics `maximum_equity_drawdown` and performance
     `balance_metrics.maximum_drawdown`. The ratio must move from the plugin
     (current `drawdownGap`) into the Core (C1) to follow the calculation
     rule.

**Flagged, not included:**
- **Prop-firm comparison** ("your p95 is above the X% daily limit"). The app
  has no firm limits yet, and prop checks need **equity**, not closed-trade
  P/L (PL-006). This arrives with the prop-firm module, which will pass the
  firm's limits to the Core. Until then the Monte Carlo card says "Prop-firm
  limit comparison: available with the prop-firm module" and gives no
  numbers.
- Any probability of ruin, forecast, "safe" threshold, or recommended risk
  percentage. None of these is computed, so they are left out.

### Portfolio Pareto: How to read this

| Draft text | Data source |
| --- | --- |
| "Each point is one combination of your tracks run on one account. Across: its worst drawdown of combined realised balance (**{ccy}**). Up: its net P/L over the period. Better is **up and to the left**." | Axes from the explore objectives: `net_pnl` MAX and `maximum_drawdown` MIN (existing) |
| "**{counts.PARETO}** of **{subset_count}** combinations are on the frontier. For each of them, no other combination has both more profit and less drawdown." | `counts.PARETO`, `subset_count` (existing) |
| "To choose, start from the drawdown you can accept, find the frontier point at or left of it, and take the highest one. Moving right along the frontier buys profit with drawdown." | Structural description of the frontier; no numbers |
| For the selected frontier point: "The next frontier step (**{next_label}**) adds **{step_pnl} {ccy}** of profit for **{step_dd} {ccy}** more drawdown, **{step_ratio} {ccy}** of profit per 1 {ccy} of drawdown. The previous step gave **{prev_ratio}**." | **New (C1):** `frontier_steps` (frontier points sorted by drawdown, each with profit and drawdown deltas and their ratio) |
| For a dominated point: "**{example_label}** has at least as much profit (**{example_pnl}**) with no more drawdown (**{example_dd}**)." | `pareto.dominated_by_example` plus that subset's own `net_pnl` and `maximum_drawdown` (existing; display only) |
| "Return-to-drawdown for this combination: **{return_to_drawdown}**." | `return_to_drawdown` (existing) |

### Portfolio Pareto: Tips

1. "If the next step's ratio (**{step_ratio}**) is lower than the previous
   one's (**{prev_ratio}**), each extra unit of drawdown is buying less
   profit from here on." The Core returns `diminishing` = true/false per
   step.
2. For a dominated selection: "Consider **{example_label}**: same or better
   on both axes." (existing fields)
3. "These drawdowns are realised balance; open-position drawdown can be
   deeper."
   - Always shown.
   - The equity version (E6, the conservative combined low) is **not built
     yet**, so it is flagged and deferred.

## 6. Core additions needed (C1)

Each needs a version bump and tests.

- `monte_carlo`:
  - `historical_max_drawdown`
  - `historical_rank_percent` (the share of generated paths with a strictly
    smaller maximum drawdown)
  - `historical_vs_median`
  - `fan_bands` (p05, p50, p95 per sampled index, nearest-rank, like the
    existing percentiles)
  - `widest_band` and `widest_at_event`
  - `opening_balance` and `p50_percent_of_opening` / `p95_percent_of_opening`
    (Decimal, 8 dp, ROUND_HALF_EVEN)
- `portfolio.explore` (and the saved-combination comparison): `frontier_steps`
  with `from_id`, `to_id`, `step_pnl`, `step_drawdown`, `step_ratio`, and
  `diminishing`.
- `equity_log.equity_metrics`: `equity_to_balance_drawdown_ratio`, given the
  report's balance drawdown. This moves the one ratio the plugin currently
  computes into the Core.

## 7. Implementation order

1. **Quick wins (plugin only):**
   - A1: sidebar spacing and Lucide icons.
   - A2: jargon and raw codes replaced by words (§3 #12).
   - A3: the audit-trail component, moving the §3 items; the Data-page notice
     for non-empty warnings.
   - A4: developer diagnostics behind a setting.
2. **Visuals:**
   - B1: What-If tiles and bars.
   - B2: Monte Carlo summary card, percentile strip, and `ChartFrame` for the
     histogram and fan, with reference lines from existing fields.
   - B3: the Advanced legacy viewers, per D1.
3. **Guidance:**
   - C1: the Core additions (§6) with tests and version bumps.
   - B4: the fan band, which needs `fan_bands`.
   - C2: a reusable "How to read this · Tips" block with the §5 templates.
   - C3: flag placeholders for the prop-firm comparison and portfolio equity
     (E6).

## 8. Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| D1 | Replace the Advanced page's legacy optimisation and paired-forward viewers with a link to Parameters (logic and data kept)? | **Yes** |
| D2 | Use Obsidian's built-in Lucide icons (`setIcon`) rather than adding a library? | **Yes** |
| D3 | Hide "Local run diagnostics" behind a "Show developer diagnostics" setting (default off)? | **Yes** |
| D4 | Approve the Core additions in §6 (new fields; existing values unchanged)? | **Yes** |
| D5 | Keep the Monte Carlo seed visible next to results (not only in the audit trail)? | **Yes**, for reproducibility |
