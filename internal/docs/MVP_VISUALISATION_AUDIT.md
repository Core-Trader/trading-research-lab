# MVP Visualisation Audit

**Status:** Audit and proposal, 2026-09-22. No scope is approved by this document.
**Question answered:** which TRL modules show results as text today where a
graphic would help, and what data each graphic needs.
**Rules:** all plotted values come from the Core. The plugin may only scale,
position, and colour them. A chart must never suggest a forecast, a ranking,
or a "best" choice (selection is deferred). Every chart names its basis
(balance, close events, inferred lifecycles, user-supplied).

## Already graphical

| Area | Visual | Since |
| --- | --- | --- |
| Overview | KPI tiles, balance curve with tooltip, P/L bars, daily calendar, monthly table | Tiers A/B |
| Monte Carlo | Drawdown histogram, percentile table, path fan | M6 + tier B |
| M5 batch | Combined balance curve (shared chart component) | M5 |

## Candidates

"Data" says whether the Core already returns the values over IPC (**IPC**),
whether they sit only in a Parquet artifact (**artifact → series**, meaning a
bounded Core display series is needed), or whether a new calculation is needed
(**new calc**).

| # | Module / panel | Today (text) | Proposed visual | Data | Value | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| V1 | **Tier C1 metrics** (approved) | — | Underwater (drawdown) chart under the balance curve; stagnation band on the balance curve; streak markers on the P/L bars | New calc (C1 spec) | **High** | Built with C1 |
| V2 | **Paired forward evidence** (M6) | Raw table of paired rows | **Scatter: in-sample metric (x) vs forward metric (y)** per parameter signature, with a y = x reference line and quadrant shading (both positive / diverging) | IPC (`rows`) | **High** | Descriptive: no point is highlighted as best; the user picks the metric columns |
| V3 | **Optimisation grid** (M6) | Sortable table | **Scatter of two chosen metric columns** (for example profit vs drawdown) across all passes; optional **2-parameter heatmap** of one metric | IPC (`rows`) | **High** | Same no-selection rule; plots MT5-reported values only |
| V4 | **Close-event distribution** (M2) | Summary numbers | **Histogram of close-event net P/L** (Core-binned), wins and losses coloured | Artifact → series | **High** | Also the base for the C2 R-multiple histogram |
| V5 | **Daily realised drawdown** (M3) | Worst day only | **Bar chart of each day's maximum realised decline**, worst day marked | Artifact → series (daily rows exist) | Medium | Basis: realised balance, report clock |
| V6 | **What-If fixed cost** (M6) | Before/after numbers | **Two cumulative close-event P/L curves** (source vs scenario) plus the delta | Artifact → series | Medium | Research roadmap already lists a comparison view |
| V7 | **M5 batch preflight** | Member list text and findings | **Timeline (Gantt) of member reports** by date range, with gaps and overlaps highlighted and BLOCKED findings coloured | IPC (`members` first/last timestamps) | Medium | Makes chronological eligibility visible at a glance |
| V8 | **Inferred lifecycles** (M2, hedging only) | Summary numbers | Holding-time histogram; P/L vs holding-time scatter | Artifact → series | Medium | Must carry the `INFERRED` badge on the chart |
| V9 | **C2 Van Tharp** (draft) | — | **R-multiple histogram** with expectancy marker | New calc (C2 spec) | High, if C2 approved | 1R source badge required |
| V10 | **Research documents** (M4) | Linked / not linked text | Small **Strategy → Experiment → Report chain** graphic with status per node | Plugin state | Low–medium | Navigation aid; no calculation |
| V11 | **Source evidence** (M1) | Hashes and paths | **Provenance chain**: source file → verified snapshot (SHA) → canonical dataset → analyses | IPC (`evidence`) | Low | Trust aid; hashes stay available in text |
| V12 | **Run diagnostics** (M0) | Timings list | Stacked timing bar per stage | Plugin-local timings | Low | Non-financial; plugin may compute durations |
| V13 | **Equity availability** (M3) | Status text | — | — | None | Intentionally text: nothing exists to plot |

## Recommended order

1. **V1** with C1 (approved; it is being implemented).
2. **V2 + V3**: optimisation and forward evidence are the least readable panels
   today, and the data is already over IPC, so these are **plugin-only**.
3. **V4**: small Core display series; reused by C2.
4. **V7** (plugin-only) and **V5** (small series).
5. **V6, V8** after that; **V10–V12** as polish.

## Guardrails for V2/V3 (optimisation and forward)

- No automatic highlighting of the top-right point, no "best" marker, no
  trend lines implying a relationship, and no colour scale implying good or bad
  beyond sign.
- The user chooses the axes from MT5-reported metric columns; the caption names
  both source files and the declared modelling mode.
- Hover shows the full parameter signature and MT5-reported values verbatim.
