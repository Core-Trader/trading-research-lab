import assert from "node:assert/strict";
import test from "node:test";
import { axisPosition, fanBandGeometry, monteCarloGuidance, stripMarkers } from "../src/components/advanced/monte-carlo-model.ts";
import { paretoGuidance } from "../src/components/portfolio/pareto-guidance.ts";
import type { EquityMetrics, MonteCarloResult } from "../src/types.ts";

const mc = (overrides: Partial<MonteCarloResult> = {}): MonteCarloResult => ({
  currency: "USD", population_count: 3, invariant_final_pnl: "0", configuration: { path_count: 400 },
  drawdown_summary: { minimum: "10", p05: "10", p50: "20", p95: "30", maximum: "30" },
  historical: { maximum_drawdown: "30", rank_percent: "62.5", vs_median: "DEEPER" },
  fan_bands: { p05: ["0", "-20", "0"], p50: ["0", "-5", "0"], p95: ["0", "10", "0"], event_indices: [0, 1, 2], widest_band: "30", widest_at_event: 1 },
  account: { opening_balance: "1000", p50_percent_of_opening: "2", p95_percent_of_opening: "3" },
  path_fan: { historical: ["0", "10", "0"] },
  ...overrides,
} as unknown as MonteCarloResult);

test("Monte Carlo text uses only Core values and Core comparisons", () => {
  const guidance = monteCarloGuidance(mc(), null);
  assert.match(guidance.read[1]!, /20\.00 USD or less, 95% had 30\.00 USD/);
  assert.match(guidance.read[2]!, /deeper than 62\.50% of the reorderings/);
  assert.match(guidance.read[3]!, /widest after trade 1, where it spans 30\.00 USD/);
  assert.match(guidance.tips[0]!, /3\.00% of the starting balance \(1000\.00 USD\)/);
  assert.match(guidance.tips[1]!, /less fortunate than a typical ordering/);
  assert.ok(guidance.flags.some((flag) => flag.startsWith("Prop-firm limit comparison: use the Prop-firm check page")));
  assert.ok(guidance.flags.some((flag) => flag.startsWith("Open-position (equity) risk")));
});

test("missing data is flagged, not invented; equity ratio only when the Core says deeper", () => {
  const noOpening = monteCarloGuidance(mc({ account: { opening_balance: null, p50_percent_of_opening: null, p95_percent_of_opening: null } } as Partial<MonteCarloResult>), null);
  assert.ok(noOpening.flags.some((flag) => flag.includes("no opening-balance row")));
  assert.ok(!noOpening.tips.some((tip) => tip.includes("starting balance")));
  const equity = { equity_to_balance_drawdown_ratio: "12.45", equity_deeper_than_balance: true } as EquityMetrics;
  assert.ok(monteCarloGuidance(mc(), equity).tips.some((tip) => tip.includes("12.45× its closed-trade drawdown")));
  const shallowEquity = { equity_to_balance_drawdown_ratio: "0.90", equity_deeper_than_balance: false } as EquityMetrics;
  assert.ok(!monteCarloGuidance(mc(), shallowEquity).tips.some((tip) => tip.includes("×")));
  const best = monteCarloGuidance(mc({ historical: { maximum_drawdown: "10", rank_percent: "0.00000000", vs_median: "SHALLOWER" } } as Partial<MonteCarloResult>), null);
  assert.match(best.tips[1]!, /would have drawn down more/);
  assert.match(best.read[2]!, /none of the reorderings had a smaller one/);
});

test("strip markers and band geometry are display scaling of Core values", () => {
  const markers = stripMarkers(mc());
  assert.deepEqual(markers.map((marker) => [marker.key, marker.position]), [["min", 0], ["p05", 0], ["p50", 50], ["p95", 100], ["max", 100], ["historical", 100]]);
  assert.equal(axisPosition("5", "5", "5"), 50);
  const band = fanBandGeometry(mc());
  assert.ok(band);
  assert.equal(band.low, -20);
  assert.equal(band.high, 10);
  assert.equal(band.band.split(" ").length, 6);
  assert.deepEqual(band.paths, []);
});

test("Pareto guidance words Core frontier steps for the selected point", () => {
  const points = [
    { id: "a", label: "A", gain: "100", cost: "10", status: "PARETO", dominatedBy: null },
    { id: "b", label: "A + B", gain: "300", cost: "20", status: "PARETO", dominatedBy: null },
    { id: "c", label: "A + B + C", gain: "350", cost: "30", status: "PARETO", dominatedBy: null },
    { id: "d", label: "C", gain: "90", cost: "25", status: "DOMINATED", dominatedBy: "b" },
  ];
  const steps = { gain_metric: "net_pnl", cost_metric: "maximum_drawdown", points: ["a", "b", "c"], steps: [
    { from_id: "a", to_id: "b", step_gain: "200", step_cost: "10", ratio: "20.00000000", diminishing: null },
    { from_id: "b", to_id: "c", step_gain: "50", step_cost: "10", ratio: "5.00000000", diminishing: true },
  ] };
  const args = { points, frontierCount: 3, steps, currency: "USD", gainLabel: "net P/L", costLabel: "max drawdown" };
  const atB = paretoGuidance({ ...args, selectedId: "b" });
  assert.ok(atB.read[0]!.includes("Across: Max drawdown (USD); up: Net P/L (USD)."));
  assert.ok(atB.read[1]!.includes("3 of 4 combinations are on the frontier: for each of them, no other combination has both more net P/L and less max drawdown."));
  assert.match(atB.tips[0]!, /next frontier step \(A \+ B \+ C\) adds 50\.00 USD for 10\.00 USD more drawdown, 5\.00 USD of profit per 1 USD of drawdown; the step into A \+ B gave 20\.00/);
  assert.match(atB.tips[1]!, /buys less profit/);
  assert.match(paretoGuidance({ ...args, selectedId: "c" }).tips[0]!, /highest-profit end of the frontier/);
  assert.match(paretoGuidance({ ...args, selectedId: "d" }).tips[0]!, /Consider A \+ B: .*300\.00 USD.*20\.00 USD/);
});
