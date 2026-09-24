import { plain } from "./plain-language.ts";
import { formatPercent, formatTimestamp, roundDecimalString } from "./display-format.ts";
import type { CostBreakdown, DailyDrawdownResult, DatasetEvidence, PerformanceMetrics, SignificanceResult, StatisticsResult, TradeAnalysisResult } from "../types";
import { belowMinimum } from "../application/research-settings.ts";

export const UNAVAILABLE = "Unavailable";

type DocumentReference = { id: string; path: string } | null;

export type DashboardInputs = {
  statistics: StatisticsResult | null;
  evidence: DatasetEvidence | null;
  closeEvents: TradeAnalysisResult | null;
  dailyDrawdown: DailyDrawdownResult | null;
  strategy: DocumentReference;
  experiment: DocumentReference;
  report: DocumentReference;
  performance?: PerformanceMetrics | null;
  /** Significance of the average trade (G6) and your own minimum trades (G5). */
  significance?: SignificanceResult | null;
  /** C2: opening-deal amounts left out of close-event figures. */
  costs?: CostBreakdown | null;
  minTrades?: number | null;
  /** Failure messages from automatic dashboard calculations, per source. */
  errors?: { closeEvents?: string | null; dailyDrawdown?: string | null; displaySeries?: string | null; performance?: string | null };
};

export type KpiSource = "statistics" | "closeEvents" | "dailyDrawdown" | "performance";
export type KpiTone = "positive" | "negative" | "neutral" | "warning";

export type Kpi = {
  id: "net-pnl" | "close-events" | "win-rate" | "worst-day" | "balance-change" | "max-drawdown" | "return-drawdown" | "profit-factor" | "expectancy" | "avg-win-loss" | "stagnation" | "sqn";
  label: string;
  source: KpiSource;
  state: "ready" | "empty" | "error";
  value: string;
  detail: string;
  tone: KpiTone;
  /** Full-precision Core value when the displayed value is rounded for presentation. */
  exact?: string;
};

export type DashboardModel = {
  currency: string;
  dataset: { filename: string; detail: string; adapter: string; status: string };
  balance: { opening: string; final: string; change: string };
  closeEvents: { netPnl: string; detail: string; winRate: string } | null;
  dailyRisk: { worstDecline: string; worstDeclinePercent: string; worstDate: string } | null;
  documents: { linkedCount: number; strategy: boolean; experiment: boolean; report: boolean };
  kpis: Kpi[];
};

/**
 * Presentation-only mapping from Core results to dashboard text. It never
 * derives a financial value: every figure is a Core-supplied string, and a
 * missing value renders as "Unavailable", never as zero.
 */
export function buildDashboardModel(inputs: DashboardInputs): DashboardModel | null {
  const { statistics, evidence, closeEvents, dailyDrawdown, strategy, experiment, report, errors, performance } = inputs;
  if (statistics === null || evidence === null) return null;
  const currency = statistics.currency ?? "source currency";
  const money = (value: string | null | undefined): string => value === null || value === undefined ? UNAVAILABLE : `${roundDecimalString(value, 2)} ${currency}`;
  const percent = (value: string | null | undefined): string => formatPercent(value) ?? UNAVAILABLE;
  const summary = closeEvents?.summary ?? null;
  const worstDay = dailyDrawdown?.worst_day ?? null;

  const pending = (source: KpiSource): Pick<Kpi, "state" | "value" | "detail" | "tone"> => {
    const error = source === "closeEvents" ? errors?.closeEvents : source === "dailyDrawdown" ? errors?.dailyDrawdown : source === "performance" ? errors?.performance : null;
    return error
      ? { state: "error", value: UNAVAILABLE, detail: error, tone: "neutral" }
      : { state: "empty", value: "Not calculated", detail: source === "closeEvents" ? "Run verified trade analysis." : source === "performance" ? "Run trade analysis to calculate performance metrics." : "Run daily balance analysis.", tone: "neutral" };
  };

  const kpis: Kpi[] = [
    summary
      ? { id: "net-pnl", label: "Net close-event P/L", source: "closeEvents", state: "ready", value: money(summary.net_pnl), detail: openingExclusionLine(inputs.costs ?? null) ?? "Sum of verified close events", tone: signTone(summary.net_pnl) }
      : { id: "net-pnl", label: "Net close-event P/L", source: "closeEvents", ...pending("closeEvents") },
    summary
      ? { id: "close-events", label: "Close events", source: "closeEvents", state: "ready", value: String(summary.count), detail: [`${summary.win_count} wins · ${summary.loss_count} losses · ${summary.breakeven_count} breakeven`, belowMinimum(summary.count, inputs.minTrades ?? null) ? `fewer than your minimum of ${inputs.minTrades}` : "", significanceLine(inputs.significance ?? null)].filter(Boolean).join(" · "), tone: belowMinimum(summary.count, inputs.minTrades ?? null) ? "warning" : "neutral" }
      : { id: "close-events", label: "Close events", source: "closeEvents", ...pending("closeEvents") },
    summary
      ? { id: "win-rate", label: "Win rate", source: "closeEvents", state: "ready", value: percent(summary.win_rate), detail: "Winning verified close events", tone: "neutral", exact: summary.win_rate === null ? undefined : `Core value: ${summary.win_rate}%` }
      : { id: "win-rate", label: "Win rate", source: "closeEvents", ...pending("closeEvents") },
    worstDay
      ? { id: "worst-day", label: "Worst daily decline", source: "dailyDrawdown", state: "ready", value: money(worstDay.maximum_drawdown), detail: `${worstDay.date} · ${percent(worstDay.maximum_drawdown_percent)} of day's opening balance`, tone: isZero(worstDay.maximum_drawdown) ? "neutral" : "negative", exact: worstDay.maximum_drawdown_percent === null ? undefined : `Core value: ${worstDay.maximum_drawdown_percent}% of the day's opening balance` }
      : { id: "worst-day", label: "Worst daily decline", source: "dailyDrawdown", ...pending("dailyDrawdown") },
    ...performanceKpis(performance ?? null, currency, pending),
    { id: "balance-change", label: "Reported balance change", source: "statistics", state: "ready", value: money(statistics.reported_balance_change), detail: `${roundDecimalString(statistics.opening_balance, 2)} → ${roundDecimalString(statistics.final_reported_balance, 2)}`, tone: signTone(statistics.reported_balance_change) },
  ];

  return {
    currency,
    dataset: {
      filename: evidence.original_filename,
      detail: `${evidence.event_count} source events · ${evidence.source_quality}`,
      adapter: `Read by ${evidence.adapter.adapter_id} version ${evidence.adapter.adapter_version}`,
      status: `Source copy: ${plain(evidence.raw_snapshot_status).toLowerCase()}`,
    },
    balance: {
      opening: money(statistics.opening_balance),
      final: money(statistics.final_reported_balance),
      change: money(statistics.reported_balance_change),
    },
    closeEvents: summary === null ? null : {
      netPnl: money(summary.net_pnl),
      detail: `${summary.count} events · ${summary.win_count} wins / ${summary.loss_count} losses`,
      winRate: percent(summary.win_rate),
    },
    dailyRisk: worstDay === null ? null : {
      worstDecline: money(worstDay.maximum_drawdown),
      worstDeclinePercent: percent(worstDay.maximum_drawdown_percent),
      worstDate: worstDay.date,
    },
    documents: {
      linkedCount: [strategy, experiment, report].filter((item) => item !== null).length,
      strategy: strategy !== null,
      experiment: experiment !== null,
      report: report !== null,
    },
    kpis,
  };
}

/** Colour hint read from the sign of a Core decimal string; no arithmetic. */
export function signTone(value: string): KpiTone {
  const trimmed = value.trim();
  if (isZero(trimmed)) return "neutral";
  return trimmed.startsWith("-") ? "negative" : "positive";
}

function isZero(value: string): boolean {
  return /^[+-]?0*(?:\.0*)?$/.test(value.trim());
}

const REASON_TEXT: Record<string, string> = { NO_LOSSES: "No losses", NO_CLOSE_EVENTS: "No close events", NO_DRAWDOWN: "No drawdown" };

/** Tier C1 tiles. Quotients are Core strings rounded to 2 dp for display, exact on hover. */
function performanceKpis(performance: PerformanceMetrics | null, currency: string, pending: (source: KpiSource) => Pick<Kpi, "state" | "value" | "detail" | "tone">): Kpi[] {
  const ids: Array<[Kpi["id"], string]> = [["max-drawdown", "Max drawdown (balance)"], ["return-drawdown", "Return / drawdown"], ["profit-factor", "Profit factor"], ["expectancy", "Expectancy (avg per close event)"], ["avg-win-loss", "Avg win / avg loss"], ["stagnation", "Longest stagnation"], ["sqn", "SQN (Van Tharp)"]];
  if (performance === null) return ids.map(([id, label]) => ({ id, label, source: "performance", ...pending("performance") }));
  const balance = performance.balance_metrics;
  const close = performance.close_event_metrics;
  const stagnation = performance.stagnation.longest_by_time;
  const r2 = (value: string | null): string => value === null ? "—" : roundDecimalString(value, 2);
  const exact = (label: string, value: string | null): string | undefined => value === null ? undefined : `Core value: ${label}${value}`;
  const drawdownDetail = balance.peak && balance.trough
    ? `${balance.maximum_drawdown_percent === null ? "% unavailable" : `${r2(balance.maximum_drawdown_percent)}% of peak`} · ${formatTimestamp(balance.peak.timestamp).slice(0, 10)} → ${formatTimestamp(balance.trough.timestamp).slice(0, 10)} · ${balance.recovery_status === "RECOVERED" ? "recovered" : "not recovered"}`
    : "The balance never fell below a previous high.";
  return [
    { id: "max-drawdown", label: "Max drawdown (balance)", source: "performance", state: "ready", value: isZero(balance.maximum_drawdown) ? REASON_TEXT.NO_DRAWDOWN! : `${roundDecimalString(balance.maximum_drawdown, 2)} ${currency}`, detail: drawdownDetail, tone: isZero(balance.maximum_drawdown) ? "neutral" : "negative", exact: exact("", balance.maximum_drawdown_percent === null ? null : `${balance.maximum_drawdown_percent}% of the high-water mark at the trough`) },
    { id: "return-drawdown", label: "Return / drawdown", source: "performance", state: "ready", value: balance.return_to_drawdown === null ? REASON_TEXT[balance.return_to_drawdown_reason ?? ""] ?? "—" : r2(balance.return_to_drawdown), detail: "Balance change ÷ max drawdown", tone: balance.return_to_drawdown === null ? "neutral" : signTone(balance.return_to_drawdown), exact: exact("", balance.return_to_drawdown) },
    { id: "profit-factor", label: "Profit factor", source: "performance", state: "ready", value: close.profit_factor === null ? REASON_TEXT[close.profit_factor_reason ?? ""] ?? "—" : r2(close.profit_factor), detail: `Gross ${close.gross_profit} ÷ |${close.gross_loss}| ${currency}`, tone: "neutral", exact: exact("", close.profit_factor) },
    { id: "expectancy", label: "Expectancy (avg per close event)", source: "performance", state: "ready", value: close.expectancy === null ? "—" : `${r2(close.expectancy)} ${currency}`, detail: "Mean net P/L per verified close event", tone: close.expectancy === null ? "neutral" : signTone(close.expectancy), exact: exact("", close.expectancy) },
    { id: "avg-win-loss", label: "Avg win / avg loss", source: "performance", state: "ready", value: `${r2(close.average_win)} / ${r2(close.average_loss)}`, detail: `${currency} · payoff ratio ${r2(close.payoff_ratio)}`, tone: "neutral", exact: exact("", `${close.average_win ?? "—"} / ${close.average_loss ?? "—"}; payoff ${close.payoff_ratio ?? "—"}`) },
    { id: "stagnation", label: "Longest stagnation", source: "performance", state: "ready", value: `${r2(stagnation.duration_days)} days`, detail: `${stagnation.close_events} close events · ${stagnation.status === "ONGOING" ? "still ongoing" : "ended by a new high"} · from ${formatTimestamp(stagnation.start.timestamp).slice(0, 10)}`, tone: "neutral", exact: exact("", `${stagnation.duration_days} days; ${stagnation.share_of_report_period_percent ?? "—"}% of the report period`) },
    { id: "sqn", label: "SQN (Van Tharp)", source: "performance", state: "ready", value: close.sqn_capped_100 === null ? "—" : r2(close.sqn_capped_100), detail: close.sqn === null ? "Needs at least 2 close events with varying results" : `N capped at 100 · raw SQN ${r2(close.sqn)} (N = ${close.close_event_count}) · no quality band`, tone: "neutral", exact: exact("", close.sqn_capped_100 === null ? null : `capped ${close.sqn_capped_100}; raw ${close.sqn}; √N × mean ÷ sample stdev of close-event P/L`) },
  ];
}

/** One line for the Overview (G6): what the significance check says, in words. */
export function significanceLine(result: SignificanceResult | null): string {
  if (!result || !result.mean_test.interval) return "";
  if (result.validity === "NOT_VALID") return "average-trade test not valid (wins and losses not random)";
  const level = `${Math.round(Number(result.confidence) * 100)} %`;
  return Number(result.mean_test.interval.low) > 0 ? `average trade above zero at ${level}` : `average trade not distinguishable from zero at ${level}`;
}

/** C2: the Overview net P/L tile names opening-deal amounts it leaves out (the balance change includes them). */
export function openingExclusionLine(costs: CostBreakdown | null): string | null {
  if (!costs || Number(costs.per_trade_exclusion.amount) === 0) return null;
  return `Closing deals only; excludes ${Number(costs.per_trade_exclusion.amount).toFixed(2)} ${costs.currency ?? ""} on opening deals (the balance change includes it)`;
}
