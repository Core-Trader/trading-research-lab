import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardModel, signTone, UNAVAILABLE } from "../src/components/dashboard-model.ts";
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

test("KPI tiles show Core strings with sign-based tone and no derived values", () => {
  const drawdown = { worst_day: { date: "2026.01.02", maximum_drawdown: "12.00", maximum_drawdown_percent: "0.12" } } as DailyDrawdownResult;
  const model = buildDashboardModel({ ...empty, statistics, evidence, closeEvents: closeEvents("60.00"), dailyDrawdown: drawdown });
  const byId = Object.fromEntries((model?.kpis ?? []).map((kpi) => [kpi.id, kpi]));
  assert.deepEqual(Object.keys(byId), ["net-pnl", "close-events", "win-rate", "gross", "worst-day", "balance-change"]);
  assert.equal(byId["net-pnl"]?.value, "250.50 USD");
  assert.equal(byId["net-pnl"]?.tone, "positive");
  assert.equal(byId["close-events"]?.value, "20");
  assert.equal(byId["close-events"]?.detail, "12 wins · 8 losses · 0 breakeven");
  assert.equal(byId["gross"]?.value, "400.00 / -149.50");
  assert.equal(byId["worst-day"]?.value, "12.00 USD");
  assert.equal(byId["worst-day"]?.tone, "negative");
  assert.equal(byId["worst-day"]?.detail, "2026.01.02 · 0.12% of day's opening balance");
  assert.equal(byId["balance-change"]?.detail, "10000.00 → 10250.50");
});

test("uncalculated KPI tiles say so, and failed ones carry the Core error", () => {
  const model = buildDashboardModel({ ...empty, statistics, evidence, errors: { closeEvents: "E_ANALYSIS: no close events", dailyDrawdown: null } });
  const netPnl = model?.kpis.find((kpi) => kpi.id === "net-pnl");
  const worstDay = model?.kpis.find((kpi) => kpi.id === "worst-day");
  assert.equal(netPnl?.state, "error");
  assert.equal(netPnl?.value, UNAVAILABLE);
  assert.equal(netPnl?.detail, "E_ANALYSIS: no close events");
  assert.equal(worstDay?.state, "empty");
  assert.equal(worstDay?.value, "Not calculated");
  assert.ok(model?.kpis.every((kpi) => kpi.value !== "0" && kpi.value !== "0.00 USD" || kpi.state === "ready"));
});

test("sign tone reads the Core string without arithmetic", () => {
  assert.equal(signTone("-0.01"), "negative");
  assert.equal(signTone("0.00"), "neutral");
  assert.equal(signTone("-0.00"), "neutral");
  assert.equal(signTone("+3.5"), "positive");
  assert.equal(signTone("12"), "positive");
});

test("document linkage counts the explicit Strategy, Experiment, and Report references", () => {
  const model = buildDashboardModel({ ...empty, statistics, evidence, strategy: { id: "s", path: "Strategies/S.md" }, report: null });
  assert.equal(model?.documents.linkedCount, 1);
  assert.equal(model?.documents.strategy, true);
  assert.equal(model?.documents.experiment, false);
});
