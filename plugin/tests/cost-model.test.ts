import assert from "node:assert/strict";
import test from "node:test";
import { costGuidance } from "../src/components/analysis/cost-model.ts";
import { SOURCES } from "../src/components/help/research-workflow.ts";
import type { CostBreakdown, CostRow } from "../src/types.ts";

const row = (overrides: Partial<CostRow> = {}): CostRow => ({ trade_result_before_costs: "80", commission_open: "-10.50", commission_close: "-10.50", swap_charged: "-2", swap_credited: "4", commissions: "-21", swaps: "2", net: "61", costs: "19", cost_share_percent: "23.75", closed_trades: 2, volume: "0.6", ...overrides });
const base: CostBreakdown = {
  calculation_version: "cost-breakdown-1", evaluation_id: "e", dataset_ref: "ds", currency: "USD", source_filename: "r.xlsx", summary: row(),
  reconciliation: { opening_balance: "1000", computed_final: "1061", reported_final: "1061", difference: "0", status: "MATCHES" },
  per_trade_exclusion: { amount: "-10.50", per_closed_trade: "-5.25", opening_commission: "-10.50" },
  intensity: { cost_per_closed_trade: "9.50", commission_per_lot: "35", cost_share_percent: "23.75" },
  by_symbol: [{ symbol: "EURUSD", ...row({ cost_share_percent: "18" }) }, { symbol: "USDJPY", ...row({ cost_share_percent: "30" }) }], by_month: [], warnings: [],
};
const all = (g: ReturnType<typeof costGuidance>) => [...g.read, ...g.tips, ...g.flags];

test("sourced points cite registered sources; others cite none", () => {
  for (const point of all(costGuidance(base))) {
    if (point.label === "S") assert.ok(point.source && point.source in SOURCES, point.text);
    else assert.equal(point.source, undefined, point.text);
  }
});

test("opening commissions left out of per-trade figures are named with their size", () => {
  const text = all(costGuidance(base)).map((point) => point.text).join(" ");
  assert.match(text, /-10\.50 USD on opening deals is left out/);
  assert.match(text, /about -5\.25 USD per closed trade/);
  const none = { ...base, per_trade_exclusion: { amount: "0", per_closed_trade: "0", opening_commission: "0" } };
  assert.doesNotMatch(all(costGuidance(none)).map((point) => point.text).join(" "), /left out of them/);
});

test("a reconciliation difference comes first and is never hidden", () => {
  const broken = { ...base, reconciliation: { ...base.reconciliation, difference: "7", status: "DIFFERS" as const } };
  assert.match(costGuidance(broken).flags[0]!.text, /differ by 7\.00 USD/);
});

test("a net swap credit is named, not shown as a negative cost share", () => {
  const credit = { ...base, summary: row({ costs: "-5", cost_share_percent: null }), intensity: { ...base.intensity, cost_share_percent: null } };
  const tips = costGuidance(credit).tips.map((tip) => tip.text);
  assert.ok(tips.some((tip) => /costs added 5\.00 USD/.test(tip)));
  assert.ok(!tips.some((tip) => /Costs take -/.test(tip)));
});

test("swaps larger than commissions point to holding time", () => {
  const swappy = { ...base, summary: row({ swap_charged: "-19.94", commissions: "-4.44" }) };
  assert.ok(costGuidance(swappy).tips.some((tip) => /holding positions overnight/.test(tip.text)));
  assert.ok(!costGuidance(base).tips.some((tip) => /holding positions overnight/.test(tip.text)));  // -2 swaps vs -21 commissions
});

test("tips: What-If doubling, the costliest symbol, and no cost blame for losing trades", () => {
  const tips = costGuidance(base).tips.map((tip) => tip.text);
  assert.ok(tips.some((tip) => /What-If/.test(tip) && /9\.50 USD/.test(tip)));
  assert.ok(tips.some((tip) => /largest share on USDJPY \(30\.00 %\)/.test(tip)));
  const losing = { ...base, summary: row({ trade_result_before_costs: "-40", cost_share_percent: null }), intensity: { ...base.intensity, cost_share_percent: null } };
  assert.ok(costGuidance(losing).tips.some((tip) => /lost money before costs/.test(tip.text)));
});
