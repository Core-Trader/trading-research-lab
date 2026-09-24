import type { WidgetDefinition } from "./layout-model.ts";

/**
 * The widget registry (LAYOUT-1). Ids are global and stable so a future custom
 * dashboard can combine widgets from several pages. Pages whose numbered
 * sections depend on each other (Data & import, Symbol scan, Parameters,
 * Portfolio, Prop-firm check) keep a fixed order and are not listed here.
 */
export const OVERVIEW_WIDGETS: readonly WidgetDefinition[] = [
  { id: "overview.workflow", title: "Workflow steps", defaultSpan: 3, spans: [3] },
  { id: "overview.kpis", title: "Key results", defaultSpan: 3, spans: [3] },
  { id: "overview.balance", title: "Verified balance curve", defaultSpan: 2, spans: [2, 3] },
  { id: "overview.dataset", title: "Dataset", defaultSpan: 1, spans: [1, 2, 3] },
  { id: "overview.close-events", title: "Close-event P/L", defaultSpan: 2, spans: [2, 3] },
  { id: "overview.documents", title: "Research documents", defaultSpan: 1, spans: [1, 2, 3] },
  { id: "overview.calendar", title: "Daily P/L calendar", defaultSpan: 3, spans: [2, 3] },
  { id: "overview.monthly", title: "Monthly results", defaultSpan: 3, spans: [2, 3] },
];

export const ANALYSIS_WIDGETS: readonly WidgetDefinition[] = [
  { id: "analysis.results", title: "Verified results", defaultSpan: 3, spans: [3] },
  { id: "analysis.trades", title: "Trade and event analysis", defaultSpan: 3, spans: [3] },
  { id: "analysis.daily", title: "Time, balance, and risk foundation", defaultSpan: 3, spans: [3] },
  { id: "analysis.equity", title: "Equity (floating drawdown)", defaultSpan: 3, spans: [3] },
  { id: "analysis.r-multiples", title: "R-multiples (Van Tharp)", defaultSpan: 3, spans: [3] },
  { id: "analysis.windows", title: "Same settings over time (windows)", defaultSpan: 3, spans: [3] },
];

export const HELP_WIDGETS: readonly WidgetDefinition[] = [
  { id: "help.workflow", title: "Research workflow", defaultSpan: 3, spans: [3] },
  { id: "help.equity-logger", title: "Equity logger (floating drawdown)", defaultSpan: 3, spans: [3] },
  { id: "help.mt5-exports", title: "What to export from MT5", defaultSpan: 3, spans: [3] },
];
