import assert from "node:assert/strict";
import test from "node:test";
import { betterHint, compareTable, defaultObjectives, frontierMatchesAxes, scatterPoints } from "../src/components/exploration/exploration-model.ts";
import type { ParameterEvaluation, StudyMetric } from "../src/types.ts";

const metric = (id: string, direction: "MAX" | "MIN" | null, label = id): StudyMetric => ({ id, column: id, label, default_direction: direction, unit: "", basis: "MT5_REPORTED" });
const METRICS = [metric("mt5_result", null), metric("net_profit", "MAX", "Net profit"), metric("equity_drawdown_pct", "MIN", "Equity drawdown %"), metric("trades", null, "Trades")];

const candidate = (id: string, pass: string, lot: string, profit: string, dd: string, status: "PARETO" | "DOMINATED" | "CONSTRAINED", isDefault = false) => ({
  id, pass, parameters: { InpLot: lot, InpMode: "1" }, metrics: { net_profit: profit, equity_drawdown_pct: dd, trades: "20", mt5_result: null },
  is_default: isDefault, pareto: { status, rank: status === "PARETO" ? 1 : status === "DOMINATED" ? 2 : null, dominated_by_count: status === "DOMINATED" ? 1 : 0, dominated_by_example: null, violations: status === "CONSTRAINED" ? [{ metric: "trades", operator: ">=", threshold: "30", value: "20", reason: "NOT_SATISFIED" as const }] : [] },
});

function evaluation(defaultSignature: Record<string, string> | null, withDefaultCandidate: boolean): ParameterEvaluation {
  return {
    evaluation_id: "e", configuration_hash: "h", counts: { PARETO: 1, DOMINATED: 1, CONSTRAINED: 1, INCOMPLETE: 0 }, front_count: 2, warnings: [],
    study: { study_ref: "s", context: { title: null, deposit: null, modelling_mode: null, source_filename: null }, pass_count: 3, full_grid_size: "9", metrics: METRICS,
      parameters: [{ name: "InpLot", kind: "NUMERIC", ordinal: true, in_schema: true, tested_values: [] }, { name: "InpMode", kind: "NUMERIC", ordinal: false, in_schema: true, tested_values: [] }],
      default: { signature: defaultSignature, pass_id: withDefaultCandidate ? "a" : null, status: defaultSignature ? (withDefaultCandidate ? "IN_OPTIMISATION" : "NOT_TESTED") : "NO_SCHEMA" }, findings: [] },
    candidates: [candidate("a", "1", "0.02", "100", "10", "PARETO", withDefaultCandidate), candidate("b", "2", "0.030", "90", "12", "DOMINATED"), candidate("c", "3", "0.02", "300", "30", "CONSTRAINED")],
  };
}

test("default objectives prefer MT5 net profit up and equity drawdown down", () => {
  assert.deepEqual(defaultObjectives(METRICS), [{ metric: "net_profit", direction: "MAX" }, { metric: "equity_drawdown_pct", direction: "MIN" }]);
  assert.deepEqual(defaultObjectives([metric("recovery_factor", "MAX"), metric("trades", null)]), [{ metric: "recovery_factor", direction: "MAX" }]);
});

test("frontier line only when axes are exactly the two objectives", () => {
  const objectives = defaultObjectives(METRICS);
  assert.equal(frontierMatchesAxes(objectives, "equity_drawdown_pct", "net_profit"), true);
  assert.equal(frontierMatchesAxes(objectives, "trades", "net_profit"), false);
  assert.equal(frontierMatchesAxes([...objectives, { metric: "trades", direction: "MAX" }], "equity_drawdown_pct", "net_profit"), false);
});

test("better hints follow objectives first, then catalogue defaults", () => {
  assert.equal(betterHint("equity_drawdown_pct", [], METRICS), "lower");
  assert.equal(betterHint("trades", [{ metric: "trades", direction: "MAX" }], METRICS), "higher");
  assert.equal(betterHint("mt5_result", [], METRICS), undefined);
});

test("scatter points carry Core status and the default flag unchanged", () => {
  const points = scatterPoints(evaluation({ InpLot: "0.02", InpMode: "1" }, true), "equity_drawdown_pct", "net_profit", "trades");
  assert.deepEqual(points.map((point) => [point.label, point.x, point.y, point.size, point.status, point.isDefault]), [
    ["Pass 1", "10", "100", "20", "PARETO", true], ["Pass 2", "12", "90", "20", "DOMINATED", false], ["Pass 3", "30", "300", "20", "CONSTRAINED", false],
  ]);
});

test("compare table marks parameter differences from the default, numerically", () => {
  const { columns, rows } = compareTable(evaluation({ InpLot: "0.02", InpMode: "1" }, true), ["b", "a"]);
  assert.deepEqual(columns.map((column) => column.title), ["★ Default", "Pass 2"]);
  const lot = rows.find((row) => row.label === "InpLot")!;
  assert.deepEqual(lot.cells, [{ value: "0.02", differs: false }, { value: "0.030", differs: true }]);
  const mode = rows.find((row) => row.label === "InpMode")!;
  assert.equal(mode.cells[1]!.differs, false);
  assert.deepEqual(rows.at(-1)!.cells.map((cell) => cell.value), ["Pareto frontier", "Dominated by 1 (front 2)"]);
});

test("an untested default shows its .set values and 'not tested' metrics", () => {
  const { columns, rows } = compareTable(evaluation({ InpLot: "0.05", InpMode: "2" }, false), ["c"]);
  assert.equal(columns[0]!.candidate, null);
  assert.equal(rows.find((row) => row.label === "InpLot")!.cells[0]!.value, "0.05");
  assert.equal(rows.find((row) => row.label === "Net profit")!.cells[0]!.value, "not tested");
  assert.equal(rows.at(-1)!.cells[0]!.value, "not in this optimisation");
  assert.equal(rows.at(-1)!.cells[1]!.value, "Fails trades >= 30");
  assert.deepEqual(compareTable(evaluation(null, false), ["a"]).columns.map((column) => column.title), ["Pass 1"]);
});
