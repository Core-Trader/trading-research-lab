import assert from "node:assert/strict";
import test from "node:test";
import { metricText, shadeMatrix, sortRows, sweepGuidance } from "../src/components/sweep/sweep-model.ts";
import type { SweepComparison, SweepEvaluation, SweepRow } from "../src/types.ts";

const row = (symbol: string, profit: string | null, dd: string): SweepRow => ({ symbol, pass: "1", source_sequence: "1", zero_trades: false, net_profit: profit, equity_drawdown_pct: dd, pareto: { status: "DOMINATED", rank: 2, dominated_by_count: 1, dominated_by_example: null, violations: [] } });

test("metric text follows the unit and the 2-decimal policy", () => {
  assert.equal(metricText({ column: "Profit", id: "net_profit", label: "Net profit", default_direction: "MAX", unit: "currency" }, "522.8612"), "522.86");
  assert.equal(metricText({ column: "Equity DD %", id: "equity_drawdown_pct", label: "Equity drawdown %", default_direction: "MIN", unit: "percent" }, "14.2414"), "14.24%");
  assert.equal(metricText({ column: "Trades", id: "trades", label: "Trades", default_direction: null, unit: "count" }, "114"), "114");
  assert.equal(metricText(undefined, null), "—");
});

test("sorting is numeric, keeps missing values last, and ties break by symbol", () => {
  const rows = [row("B", "10", "1"), row("A", "10", "1"), row("C", null, "1"), row("D", "-5", "1")];
  assert.deepEqual(sortRows(rows, { key: "net_profit", direction: "desc" }).map((item) => item.symbol), ["A", "B", "D", "C"]);
  assert.deepEqual(sortRows(rows, { key: "net_profit", direction: "asc" }).map((item) => item.symbol), ["D", "A", "B", "C"]);
  assert.deepEqual(sortRows(rows, { key: "symbol", direction: "asc" }).map((item) => item.symbol), ["A", "B", "C", "D"]);
});

test("grid shading uses the metric's direction and leaves untested cells unshaded", () => {
  const comparison = { metric: "equity_drawdown_pct", metric_label: "Equity drawdown %", sweeps: [], comparable: true, differences: [], warnings: [],
    matrix: [{ symbol: "A", values: ["10", "30"], tested: [true, true] }, { symbol: "B", values: ["20", null], tested: [true, false] }] } as SweepComparison;
  assert.deepEqual(shadeMatrix(comparison, "MIN"), [[1, 0], [0.5, null]]);
  assert.deepEqual(shadeMatrix(comparison, "MAX"), [[0, 1], [0.5, null]]);
  assert.deepEqual(shadeMatrix(comparison, null), [[null, null], [null, null]]);
});

test("guidance flags missing inputs, optimistic modes and zero-trade symbols from Core fields", () => {
  const evaluation = { evaluation_id: "e", front_count: 2, warnings: [], counts: { PARETO: 3, CONSTRAINED: 2 }, rows: [row("A", "1", "1"), row("B", "2", "2")],
    sweep: { modelling_mode: "1 minute OHLC", declared_set: null, zero_trade_symbols: ["XAUUSD"] } } as unknown as SweepEvaluation;
  const guidance = sweepGuidance(evaluation, "Equity drawdown %", "Net profit");
  assert.ok(guidance.read[1]!.startsWith("3 of 2 symbols are on the frontier") || guidance.read[1]!.includes("are on the frontier"));
  assert.ok(guidance.flags.some((flag) => flag.includes("No trades on XAUUSD")));
  assert.ok(guidance.flags.some((flag) => flag.includes("No .set was attached")));
  assert.ok(guidance.flags.some((flag) => flag.includes("fill at exactly the requested price")));
});
