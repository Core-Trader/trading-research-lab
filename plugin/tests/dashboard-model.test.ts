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
  assert.deepEqual(Object.keys(byId), ["net-pnl", "close-events", "win-rate", "worst-day", "max-drawdown", "return-drawdown", "profit-factor", "expectancy", "avg-win-loss", "stagnation", "sqn", "balance-change"]);
  assert.equal(byId["net-pnl"]?.value, "250.50 USD");
  assert.equal(byId["net-pnl"]?.tone, "positive");
  assert.equal(byId["close-events"]?.value, "20");
  assert.equal(byId["close-events"]?.detail, "12 wins · 8 losses · 0 breakeven");
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

const point = (sequence: number, timestamp: string, balance: string) => ({ source_sequence: sequence, timestamp, balance });

function performance(overrides: { profit_factor?: string | null; profit_factor_reason?: "NO_LOSSES" | null; maximum_drawdown?: string } = {}): any {
  const drawdown = overrides.maximum_drawdown ?? "130";
  return {
    balance_metrics: {
      opening_balance: "1000", final_balance: "1170", balance_change: "170", maximum_drawdown: drawdown,
      maximum_drawdown_percent: drawdown === "0" ? null : "11.81818182",
      peak: drawdown === "0" ? null : point(2, "2026-01-06T12:00:00", "1100"), trough: drawdown === "0" ? null : point(4, "2026-01-08T12:00:00", "970"),
      recovery: null, recovery_status: drawdown === "0" ? null : "RECOVERED",
      return_to_drawdown: drawdown === "0" ? null : "1.30769231", return_to_drawdown_reason: drawdown === "0" ? "NO_DRAWDOWN" : null,
    },
    drawdown_series: [],
    stagnation: { period_count: 2, longest_by_time: { start: point(2, "2026-01-06T12:00:00", "1100"), end: point(5, "2026-01-09T12:00:00", "1170"), status: "ENDED_BY_NEW_HIGH", duration_seconds: 259200, duration_days: "3.00000000", share_of_report_period_percent: "75.00000000", close_events: 3 } },
    close_event_metrics: {
      close_event_count: 4, net_pnl: "170", gross_profit: "300", gross_loss: "-130",
      profit_factor: overrides.profit_factor === undefined ? "2.30769231" : overrides.profit_factor, profit_factor_reason: overrides.profit_factor_reason ?? null,
      average_win: "150.00000000", average_loss: "-65.00000000", payoff_ratio: "2.30769231", expectancy: "42.50000000", standard_deviation: "133.00000000", sqn: "0.63909774", sqn_capped_100: "0.63909774",
      longest_winning_streak: { count: 1, net_pnl: "100", first_source_sequence: 2, last_source_sequence: 2 },
      longest_losing_streak: { count: 2, net_pnl: "-130", first_source_sequence: 3, last_source_sequence: 4 },
    },
  };
}

test("performance tiles round Core quotients for display and keep the exact value on hover", () => {
  const model = buildDashboardModel({ ...empty, statistics, evidence, performance: performance() });
  const byId = Object.fromEntries((model?.kpis ?? []).map((kpi) => [kpi.id, kpi]));
  assert.equal(byId["max-drawdown"]?.value, "130 USD");
  assert.equal(byId["max-drawdown"]?.detail, "11.82% of peak · 2026-01-06 → 2026-01-08 · recovered");
  assert.equal(byId["profit-factor"]?.value, "2.31");
  assert.equal(byId["profit-factor"]?.exact, "Core value: 2.30769231");
  assert.equal(byId["profit-factor"]?.detail, "Gross 300 ÷ |-130| USD");
  assert.equal(byId["expectancy"]?.value, "42.50 USD");
  assert.equal(byId["avg-win-loss"]?.value, "150.00 / -65.00");
  assert.equal(byId["stagnation"]?.value, "3.00 days");
  assert.equal(byId["return-drawdown"]?.value, "1.31");
});

test("undefined performance values show their reason, never zero or infinity", () => {
  const model = buildDashboardModel({ ...empty, statistics, evidence, performance: performance({ profit_factor: null, profit_factor_reason: "NO_LOSSES", maximum_drawdown: "0" }) });
  const byId = Object.fromEntries((model?.kpis ?? []).map((kpi) => [kpi.id, kpi]));
  assert.equal(byId["profit-factor"]?.value, "No losses");
  assert.equal(byId["max-drawdown"]?.value, "No drawdown");
  assert.equal(byId["return-drawdown"]?.value, "No drawdown");
  assert.ok(!Object.values(byId).some((kpi) => /Infinity|∞/.test(String(kpi?.value))));
});

test("performance tiles without Core metrics are pending, or carry the Core error", () => {
  const pending = buildDashboardModel({ ...empty, statistics, evidence });
  assert.equal(pending?.kpis.find((kpi) => kpi.id === "profit-factor")?.value, "Not calculated");
  const failed = buildDashboardModel({ ...empty, statistics, evidence, errors: { performance: "E_DATASET_INVALID: bad timestamps" } });
  assert.equal(failed?.kpis.find((kpi) => kpi.id === "stagnation")?.detail, "E_DATASET_INVALID: bad timestamps");
});

test("SQN tile shows the capped value with raw N and no quality band", () => {
  const byId = Object.fromEntries((buildDashboardModel({ ...empty, statistics, evidence, performance: performance() })?.kpis ?? []).map((kpi) => [kpi.id, kpi]));
  assert.equal(byId["sqn"]?.value, "0.64");
  assert.equal(byId["sqn"]?.detail, "N capped at 100 · raw SQN 0.64 (N = 4) · no quality band");
  assert.ok(!/poor|good|excellent|holy/i.test(byId["sqn"]?.detail ?? ""));
});
