# MVP UI Information Architecture

**Status:** Implemented for owner usability review — 2026-09-22.  
**Purpose:** keep the everyday research path clear while retaining, but not
foregrounding, the provenance and advanced capabilities required by TRL.

## Workspace sections

| Section | Intended user task | Included capability |
| --- | --- | --- |
| Overview | Understand the current research result and next action. | Fixed summary cards, verified balance curve, and Import → Analyse → Document workflow. |
| Data & import | Bring in MT5 exports and inspect source evidence only when needed. | Single report intake, explicit sequential same-account preflight, and technical source evidence. |
| Analysis | Inspect verified outcomes and qualified risk results. | Basic balance result, verified close events, inferred lifecycles only when declared, and source-clock realised daily drawdown. |
| Research | Link human research notes safely. | Explicit Strategy → Experiment → Report workflow and bounded generated content. |
| Advanced | Run optional qualified studies. | What-If, Monte Carlo, optimisation evidence, and paired-forward evidence. |

## Presentation rules

- Dataset IDs, hashes, artifact references, manifests, calculation versions,
  diagnostics, and limitations remain available but are not dashboard headline
  content.
- The UI must use plain research language before internal milestone labels.
- Importing a report populates the dashboard but does not create Markdown.
  Strategy, Experiment, and Report notes remain explicit actions in Research.
- The standard report-supported dashboard set is calculated automatically after
  a successful import: verified balance, verified close-event summary,
  source-clock realised daily drawdown, and explicit intratrade-equity
  availability. Inferred lifecycles and all advanced studies remain manual.
- The dashboard shows only values supported by the selected result's evidence.
  It must not label a reported balance curve as equity or present unavailable
  metrics as zero.
- Display formatting is presentation only (2026-09-22): percentages are shown
  to 2 decimal places by rounding the Core decimal string (half away from zero,
  no binary floats), with the full Core value available on hover; ISO report
  timestamps are shown with a space instead of `T` and no timezone change.
  Chart geometry (scaling, colour intensity) may use numbers, but every label
  and tooltip value is a Core string.
- Overview (tier A/B, 2026-09-22) shows the KPI tile row, verified balance
  curve, per-close-event P/L bars, a daily P/L calendar with ISO-week totals,
  and a year × month results table. All period sums come from the Core
  `analysis.close_event_display_series` method on the report clock.
- The dashboard is fixed for the MVP. No drag/drop layouts, custom widgets,
  saved layouts, broad filtering, or visual strategy scoring are introduced.
- Advanced tools must remain visibly qualified as research evidence, not trading
  instructions or future-performance claims.

## Monte Carlo visual follow-up

The accepted order-permutation result currently provides only summary values.
Before adding a distribution chart, the Python Core must provide a bounded,
versioned chart series representing the actual generated path results. The
plugin may render that series but must not calculate it.

## External inspiration boundary

The layout uses independently implemented patterns seen in trading-journal and
analysis tools: dashboard-first navigation, headline cards, a primary chart,
and drill-down views. No external source code, styling, assets, widgets, or
calculation logic was copied or adapted.
