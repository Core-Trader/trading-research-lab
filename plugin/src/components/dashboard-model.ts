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
};

export type DashboardModel = {
  currency: string;
  dataset: { filename: string; detail: string; adapter: string; status: string };
  balance: { opening: string; final: string; change: string };
  closeEvents: { netPnl: string; detail: string; winRate: string } | null;
  dailyRisk: { worstDecline: string; worstDeclinePercent: string; worstDate: string } | null;
  documents: { linkedCount: number; strategy: boolean; experiment: boolean; report: boolean };
};

/**
 * Presentation-only mapping from Core results to dashboard text. It never
 * derives a financial value: every figure is a Core-supplied string, and a
 * missing value renders as "Unavailable", never as zero.
 */
export function buildDashboardModel(inputs: DashboardInputs): DashboardModel | null {
  const { statistics, evidence, closeEvents, dailyDrawdown, strategy, experiment, report } = inputs;
  if (statistics === null || evidence === null) return null;
  const currency = statistics.currency ?? "source currency";
  const money = (value: string | null | undefined): string => value === null || value === undefined ? UNAVAILABLE : `${value} ${currency}`;
  const percent = (value: string | null | undefined): string => value === null || value === undefined ? UNAVAILABLE : `${value}%`;
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
    closeEvents: closeEvents === null ? null : {
      netPnl: money(closeEvents.summary.net_pnl),
      detail: `${closeEvents.summary.count} events · ${closeEvents.summary.win_count} wins / ${closeEvents.summary.loss_count} losses`,
      winRate: percent(closeEvents.summary.win_rate),
    },
    dailyRisk: dailyDrawdown === null ? null : {
      worstDecline: money(dailyDrawdown.worst_day.maximum_drawdown),
      worstDeclinePercent: percent(dailyDrawdown.worst_day.maximum_drawdown_percent),
      worstDate: dailyDrawdown.worst_day.date,
    },
    documents: {
      linkedCount: [strategy, experiment, report].filter((item) => item !== null).length,
      strategy: strategy !== null,
      experiment: experiment !== null,
      report: report !== null,
    },
  };
}
