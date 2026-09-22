import { formatPercent } from "./display-format.ts";
import type { DailyDrawdownResult, DatasetEvidence, StatisticsResult, TradeAnalysisResult } from "../types";

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
  /** Failure messages from automatic dashboard calculations, per source. */
  errors?: { closeEvents?: string | null; dailyDrawdown?: string | null; displaySeries?: string | null };
};

export type KpiSource = "statistics" | "closeEvents" | "dailyDrawdown";
export type KpiTone = "positive" | "negative" | "neutral";

export type Kpi = {
  id: "net-pnl" | "close-events" | "win-rate" | "gross" | "worst-day" | "balance-change";
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
  const { statistics, evidence, closeEvents, dailyDrawdown, strategy, experiment, report, errors } = inputs;
  if (statistics === null || evidence === null) return null;
  const currency = statistics.currency ?? "source currency";
  const money = (value: string | null | undefined): string => value === null || value === undefined ? UNAVAILABLE : `${value} ${currency}`;
  const percent = (value: string | null | undefined): string => formatPercent(value) ?? UNAVAILABLE;
  const summary = closeEvents?.summary ?? null;
  const worstDay = dailyDrawdown?.worst_day ?? null;

  const pending = (source: KpiSource): Pick<Kpi, "state" | "value" | "detail" | "tone"> => {
    const error = source === "closeEvents" ? errors?.closeEvents : source === "dailyDrawdown" ? errors?.dailyDrawdown : null;
    return error
      ? { state: "error", value: UNAVAILABLE, detail: error, tone: "neutral" }
      : { state: "empty", value: "Not calculated", detail: source === "closeEvents" ? "Run verified trade analysis." : "Run daily balance analysis.", tone: "neutral" };
  };

  const kpis: Kpi[] = [
    summary
      ? { id: "net-pnl", label: "Net close-event P/L", source: "closeEvents", state: "ready", value: money(summary.net_pnl), detail: "Sum of verified close events", tone: signTone(summary.net_pnl) }
      : { id: "net-pnl", label: "Net close-event P/L", source: "closeEvents", ...pending("closeEvents") },
    summary
      ? { id: "close-events", label: "Close events", source: "closeEvents", state: "ready", value: String(summary.count), detail: `${summary.win_count} wins · ${summary.loss_count} losses · ${summary.breakeven_count} breakeven`, tone: "neutral" }
      : { id: "close-events", label: "Close events", source: "closeEvents", ...pending("closeEvents") },
    summary
      ? { id: "win-rate", label: "Win rate", source: "closeEvents", state: "ready", value: percent(summary.win_rate), detail: "Winning verified close events", tone: "neutral", exact: summary.win_rate === null ? undefined : `Core value: ${summary.win_rate}%` }
      : { id: "win-rate", label: "Win rate", source: "closeEvents", ...pending("closeEvents") },
    summary
      ? { id: "gross", label: "Gross profit / loss", source: "closeEvents", state: "ready", value: `${summary.gross_profit} / ${summary.gross_loss}`, detail: currency, tone: "neutral" }
      : { id: "gross", label: "Gross profit / loss", source: "closeEvents", ...pending("closeEvents") },
    worstDay
      ? { id: "worst-day", label: "Worst daily decline", source: "dailyDrawdown", state: "ready", value: money(worstDay.maximum_drawdown), detail: `${worstDay.date} · ${percent(worstDay.maximum_drawdown_percent)} of day's opening balance`, tone: isZero(worstDay.maximum_drawdown) ? "neutral" : "negative", exact: worstDay.maximum_drawdown_percent === null ? undefined : `Core value: ${worstDay.maximum_drawdown_percent}% of the day's opening balance` }
      : { id: "worst-day", label: "Worst daily decline", source: "dailyDrawdown", ...pending("dailyDrawdown") },
    { id: "balance-change", label: "Reported balance change", source: "statistics", state: "ready", value: money(statistics.reported_balance_change), detail: `${statistics.opening_balance} → ${statistics.final_reported_balance}`, tone: signTone(statistics.reported_balance_change) },
  ];

  return {
    currency,
    dataset: {
      filename: evidence.original_filename,
      detail: `${evidence.event_count} source events · ${evidence.source_quality}`,
      adapter: `${evidence.adapter.adapter_id} v${evidence.adapter.adapter_version}`,
      status: evidence.raw_snapshot_status,
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
