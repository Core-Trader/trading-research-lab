import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardModel, UNAVAILABLE } from "../src/components/dashboard-model.ts";
import type { DailyDrawdownResult, DatasetEvidence, StatisticsResult, TradeAnalysisResult } from "../src/types.ts";

const statistics = {
  currency: "USD",
  opening_balance: "10000.00",
  final_reported_balance: "10250.50",
  reported_balance_change: "250.50",
} as StatisticsResult;

const evidence = {
  original_filename: "ReportTester.xlsx",
  event_count: 42,
  source_quality: "MT5_VERIFIED",
  raw_snapshot_status: "VERIFIED",
  adapter: { adapter_id: "mt5-excel", adapter_version: "1", intake_mode: "M1" },
} as DatasetEvidence;

function closeEvents(winRate: string | null): TradeAnalysisResult {
  return { summary: { count: 20, net_pnl: "250.50", gross_profit: "400.00", gross_loss: "-149.50", win_count: 12, loss_count: 8, breakeven_count: 0, win_rate: winRate, loss_rate: null, breakeven_rate: null } } as TradeAnalysisResult;
}

const empty = { closeEvents: null, dailyDrawdown: null, strategy: null, experiment: null, report: null };

test("no dashboard model exists before a verified import", () => {
  assert.equal(buildDashboardModel({ ...empty, statistics: null, evidence }), null);
  assert.equal(buildDashboardModel({ ...empty, statistics, evidence: null }), null);
});

test("dashboard shows Core-supplied values verbatim with their currency", () => {
  const model = buildDashboardModel({ ...empty, statistics, evidence, closeEvents: closeEvents("60.00") });
  assert.ok(model);
  assert.deepEqual(model.balance, { opening: "10000.00 USD", final: "10250.50 USD", change: "250.50 USD" });
  assert.equal(model.closeEvents?.netPnl, "250.50 USD");
  assert.equal(model.closeEvents?.winRate, "60.00%");
  assert.equal(model.dataset.detail, "42 source events · MT5_VERIFIED");
});

test("missing Core values render as Unavailable, never as zero", () => {
  const drawdown = { worst_day: { date: "2026.01.02", maximum_drawdown: "12.00", maximum_drawdown_percent: null } } as DailyDrawdownResult;
  const model = buildDashboardModel({ ...empty, statistics, evidence, closeEvents: closeEvents(null), dailyDrawdown: drawdown });
  assert.equal(model?.closeEvents?.winRate, UNAVAILABLE);
  assert.equal(model?.dailyRisk?.worstDeclinePercent, UNAVAILABLE);
  assert.equal(model?.dailyRisk?.worstDecline, "12.00 USD");
});

test("uncalculated optional cards stay absent rather than defaulted", () => {
  const model = buildDashboardModel({ ...empty, statistics, evidence });
  assert.equal(model?.closeEvents, null);
  assert.equal(model?.dailyRisk, null);
});

test("unknown source currency is stated explicitly", () => {
  const model = buildDashboardModel({ ...empty, statistics: { ...statistics, currency: null }, evidence });
  assert.equal(model?.balance.opening, "10000.00 source currency");
});

test("document linkage counts the explicit Strategy, Experiment, and Report references", () => {
  const model = buildDashboardModel({ ...empty, statistics, evidence, strategy: { id: "s", path: "Strategies/S.md" }, report: null });
  assert.equal(model?.documents.linkedCount, 1);
  assert.equal(model?.documents.strategy, true);
  assert.equal(model?.documents.experiment, false);
});
