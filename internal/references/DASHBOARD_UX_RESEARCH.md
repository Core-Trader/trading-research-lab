# Dashboard and UI/UX Reference Research

**Status:** Research findings, 2026-09-22. This does not approve any scope.
**Purpose:** Collect dashboard, widget, template, and layout patterns from
comparable trading-analysis products and the approved Journalit reference, then
classify them against TRL's locked rules and the MVP Fast Track.
**Code reuse:** None. Journalit code was read at the pinned commit only; nothing
was copied, so `EXTERNAL_CODE_USAGE_REGISTER.md` is unchanged.

## Evidence quality

| Source | What was available | Reliability |
| --- | --- | --- |
| QuantAnalyzer (StrategyQuant) | Product and "extensive reports" pages; documentation search results | Feature lists only; no screenshots inspected |
| StrategyQuant X | Product page; databank documentation | Workflow and databank concepts; little visual detail |
| FXOptimize | Home page; search summaries | Marketing claims; not verified hands-on |
| Forex Tester | Site returned HTTP 403 to automated fetch; search snippets only | Weak: only the Statistics panel and profit/equity chart concepts |
| EA Studio (forexsb) | Report documentation page | Good: documented tab structure |
| TradeZella | Help-centre widget reference | Good: complete documented widget list |
| TradesViz, Tradervue, Edgewonk | Comparison articles (vendor-authored, biased) | Weak; category-level only |
| Myfxbook, FX Blue | Help pages and articles | Good for drawdown-definition differences |
| Journalit `098d277…` | Source code and README screenshots, read locally | Strong: actual implementation |
| Strategy Factory `31e778a…` | `QUANTANALYZER_ALTERNATIVES.md`, report scripts | Its "dashboard" is QuantStats HTML tear sheets, not an interactive UI |

## Recurring patterns across products

1. **KPI stat-tile row at the top.** Seen in Journalit, TradeZella, and QuantAnalyzer's
   overview. Common tiles: net P/L, win rate, profit factor, expectancy, trade count,
   average win/loss, max drawdown. Journalit also shows a small change indicator
   ("past 30d") under each tile.
2. **One large primary chart** of cumulative P/L or balance, with drawdown shown
   either underneath (Journalit review template, FXOptimize) or as a separate chart.
3. **Per-trade and per-day P/L bar charts** in green and red around a zero line
   (Journalit "Trades chart" and "Daily performance"; TradeZella "Net daily P&L").
4. **Calendar heatmap** of daily P/L, coloured green/red/grey, with weekly totals in
   a side column (Journalit, TradeZella; Journalit also has a year heatmap).
5. **Breakdown tables and charts** by weekday, hour, month, and year. QuantAnalyzer
   stresses a monthly-results table and day/hour results. Journalit uses horizontal
   diverging bars for instrument, weekday, and direction.
6. **Tabbed strategy report.** EA Studio uses Stats, Chart, Balance, and Journal tabs.
   StrategyQuant X opens a results screen from a databank row (double-click).
7. **Databank / result grid with configurable column "views"** (StrategyQuant X)
   for comparing many strategies or passes.
8. **Robustness views:** Monte Carlo, walk-forward matrix, what-if, and parameter
   permutation (StrategyQuant X, QuantAnalyzer, FXOptimize).
9. **Side-by-side comparison** of two strategies or setups. Journalit's comparison
   has a metric table with an edge column and overlaid cumulative-performance lines.
10. **Display unit switches:** money, percent, R-multiple, pips, and a privacy view
    that hides amounts (TradeZella).
11. **Period filter chips** (today, week, month, quarter, year, all, custom) in
    journal-style tools.
12. **Composite scores and verdicts** (Zella Score 0–100; Journalit "winner" and
    "confidence"; StrategyQuant fitness; FXOptimize portfolio profiles).

## Journalit-specific findings (pinned commit)

- **Widgets embedded in Markdown notes.** `src/components/reviewV2/WidgetCodeblockProcessor.ts`
  registers a code-block processor per widget type (`journalit-<type>`). The block
  body is JSON configuration, and a React root is mounted in the rendered note.
  This is the most relevant pattern for TRL Report notes: a report could embed
  `trl-…` blocks that render Core results inside the note.
- **Declarative widget catalogue.** `src/data/widgetRegistry.ts` holds
  `{ type, name, description, category, availableIn, defaultConfig }`, with
  categories charts, statistics, content, tables, and layout. `src/components/home/homeTypes.ts`
  adds min, default, and max grid sizes per widget.
- **Uniform widget states.** `DashboardWidgets/BaseWidget.tsx` gives every widget the
  same skeleton, error, empty-with-action, and body states, using a skeleton shape
  per chart type.
- **Template "canvas" (Layout Builder).** `src/components/templateBuilder/TemplateEditor.tsx`
  (about 2,000 lines) is a drag-and-drop canvas using `@dnd-kit`. It composes
  review templates (trade, daily, weekly, monthly, quarterly, yearly) from the
  widget catalogue, with editor and preview modes and a template library.
  This is not Obsidian Canvas.
- **Libraries:** `recharts` (charts), `react-grid-layout` (resizable home grid),
  `@dnd-kit` (template editor), and `react-window` (virtualised lists).
- **Visual language (README screenshots):** dark cards; uppercase muted tile labels
  with large values; green/red semantics; thin grid lines; compact period chips;
  and a small chart header with a selector such as "50 trades" or "20 days".

## Fit with TRL's rules

| Pattern | TRL position |
| --- | --- |
| Any tile or chart value | Must come from the Core; the plugin only renders it (ADR-003). A tile needs a Core field first. |
| Equity wording | Only realised balance is available from MT5 Excel. Charts must say "balance", never "equity" (MVP UI rules). |
| Drawdown | Products differ: FX Blue uses closed trades, Myfxbook includes floating losses. TRL must state its basis (realised balance, source clock) on every drawdown visual. |
| Composite scores, "winner" or "confidence" verdicts | **DEFERRED — POST-MVP.** They conflict with the deferred scoring and automatic-selection decision (M6 parameter-selection package). |
| Drag/resize layouts, template canvas, saved layouts | **DEFERRED — POST-MVP** (MVP Fast Track explicitly excludes them). |
| Period chips, unit views | **DEFERRED — POST-MVP.** A backtest report is one fixed period; a percent view needs Core fields. |
| Prop-firm challenge widgets | **DEFERRED — POST-MVP** (prop-firm rules excluded). |
| Markdown-embedded result widgets | Strong fit for Reports. It needs a design for reading persisted Core artifacts by analysis-run ID; it is not an MVP blocker. |

## Recommended backlog (prioritised)

### A. MVP, plugin-only (Core data already exists)

1. **KPI tile row** on Overview, styled as muted uppercase label plus large value.
   Tiles: net close-event P/L, close events, win rate, gross profit / gross loss,
   worst daily realised decline, and reported balance change. This mostly restyles
   the existing cards.
2. **A readable balance chart:** y-axis labels, first and last dates, a zero or
   opening-balance reference line, and a hover tooltip showing the Core-supplied
   timestamp and balance. Today it is a bare polyline with no axes.
3. **Uniform widget states** (loading skeleton, error, empty with action) through
   one small `DashboardCard` wrapper. This is the Journalit `BaseWidget` idea,
   implemented independently.

### B. MVP, needs a small Core addition (a bounded, versioned display series, as done for the Monte Carlo histogram)

4. **Per-close-event P/L bar chart** (green/red around zero), from the existing
   close-event artifact.
5. **Daily realised-P/L calendar heatmap** with weekly totals, from existing daily
   rows (source-clock days, labelled as such).
6. **Monthly results table** (realised P/L by month and year), QuantAnalyzer-style.

### C. Needs a Core specification and fixtures first

7. **Whole-period realised-balance drawdown** (peak-to-trough) plus an underwater
   chart. This was already noted as missing in the 2026-09-22 modularisation
   journal entry.
8. **Profit factor, expectancy, average win/loss** tiles. These are formula choices,
   so their definitions must be written down and tested.

### D. DEFERRED — POST-MVP

9. `trl-…` code-block widgets inside Report notes (Journalit pattern).
10. Experiment A-vs-B comparison view with overlaid curves. No winner or confidence verdicts.
11. Weekday and hour breakdowns (these need a timezone-semantics decision first).
12. Configurable grid layout, widget picker, template canvas, unit and privacy views, period chips.

## Charting dependency note

Journalit uses `recharts`. Adding it to TRL would be a new runtime dependency and
must pass ADR-014 (dependency licensing). The alternative is to extend TRL's small
SVG components (balance curve and histogram already exist). Recommendation: stay
with in-house SVG for items 1–6, which are simple line, bar, and grid visuals, and
revisit if interactive zoom or brushing becomes a requirement.

## Sources

- QuantAnalyzer: https://strategyquant.com/quantanalyzer/ ; https://strategyquant.com/quantanalyzer/extensive-reports/
- StrategyQuant X: https://strategyquant.com/ ; https://strategyquant.com/doc/strategyquant/databank/
- FXOptimize: https://fxoptimize.com/ ; https://www.forexfactory.com/thread/1391025-fxoptimize-free-ea-portfolio-optimizer
- Forex Tester: https://forextester.com/ (HTTP 403 to automated fetch) ; https://www.tradingheroes.com/forex-tester-2-tip-how-to-view-the-equity-graph/
- EA Studio report: https://forexsb.com/wiki/eas-guide/report
- TradeZella widgets: https://help.tradezella.com/en/articles/7118437-understanding-dashboard-widgets-and-stats
- TradesViz comparison (vendor-authored): https://www.tradesviz.com/tradesviz-vs-tradezella/
- Myfxbook drawdown: https://help.myfxbook.com/knowledge-base/drawdown/ ; FX Blue vs Myfxbook: https://fortraders.com/blog/use-myfxbook-fx-blue-pro
- Journalit (local, pinned `098d27747df1b3a5fb177ff3a147d9a5cfbe0dcb`): paths cited above and `assets/readme/*.png`
- Strategy Factory (local, pinned `31e778a78b465ce1a0e16e232f762ebe8ca80b52`): `QUANTANALYZER_ALTERNATIVES.md`, `generate_reports.py`
