import assert from "node:assert/strict";
import test from "node:test";
import { executionCostGuidance } from "../src/components/advanced/execution-cost-model.ts";
import { SOURCES } from "../src/components/help/research-workflow.ts";
import type { ExecutionCostResult } from "../src/types.ts";

const metrics = { net: "71.5", profit_factor: null, win_rate_percent: "100", expectancy: "35.75", wins: 2, losses: 0, breakeven: 0 };
const base: ExecutionCostResult = {
  calculation_version: "execution-costs-1", evaluation_id: "e", dataset_ref: "ds", currency: "USD",
  configuration: { extra_spread_per_lot: null, slippage_per_lot: null, per_symbol: {} }, applied: false, lots_dealt: "0.6", break_even_per_lot: "101.66666667",
  before: { balance_change: "61", max_drawdown: "7", closed_trades: metrics }, after: null, by_symbol: [],
  round_turn_check: { per_deal_total: "0", round_turn_total: "0", consistent: true }, warnings: [],
};
const applied: ExecutionCostResult = { ...base, applied: true, configuration: { ...base.configuration, extra_spread_per_lot: "10" }, after: { balance_change: "52", extra_cost_total: "9", max_drawdown: "9", closed_trades: metrics } };
const all = (g: ReturnType<typeof executionCostGuidance>) => [...g.read, ...g.tips, ...g.flags];

test("sourced points cite registered sources; others cite none", () => {
  for (const result of [base, applied]) for (const point of all(executionCostGuidance(result))) {
    if (point.label === "S") assert.ok(point.source && point.source in SOURCES, point.text);
    else assert.equal(point.source, undefined, point.text);
  }
});

test("with no parameters the break-even is read and the inputs are offered as optional", () => {
  const guidance = executionCostGuidance(base);
  assert.match(guidance.read[0]!.text, /extra 101\.67 USD per lot/);
  assert.ok(guidance.tips.some((tip) => tip.label === "U" && /optional/.test(tip.text)));
});

test("applied costs are read as the user's assumption, with delay left to MT5", () => {
  const text = all(executionCostGuidance(applied)).map((point) => point.text).join(" ");
  assert.match(text, /from 61\.00 to 52\.00 USD/);
  assert.match(text, /random delay/);
  assert.match(text, /own assumption/);
});

test("an edge wiped out by the assumed costs is named; an inconsistent round turn is flagged", () => {
  const wiped = { ...applied, after: { ...applied.after!, balance_change: "-3" } };
  assert.ok(executionCostGuidance(wiped).tips.some((tip) => /remove the whole edge/.test(tip.text)));
  const uneven = { ...applied, round_turn_check: { per_deal_total: "9", round_turn_total: "8", consistent: false } };
  assert.ok(executionCostGuidance(uneven).flags.some((flag) => /volumes differ/.test(flag.text)));
});
