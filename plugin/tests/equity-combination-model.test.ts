import assert from "node:assert/strict";
import test from "node:test";
import { equityCombinationGuidance, reportsWithoutLog } from "../src/components/portfolio/equity-combination-model.ts";
import { SOURCES } from "../src/components/help/research-workflow.ts";
import type { DatasetEvidence, EquityCombination } from "../src/types.ts";

const base: EquityCombination = {
  calculation_version: "portfolio-equity-1", status: "COMBINED", evaluation_id: "e",
  configuration: { track_ids: ["a", "b"], starting_capital: "20000", window: "UNION", sizing: "AS_REPORTED", stop_out_level: null },
  currency: "USD", grid_minutes: 60, window_start: "2025-01-01T00:00:00", window_end: "2025-12-31T00:00:00", starting_capital: "20000", final_equity: "23000",
  equity_drawdown: { observed: "900", conservative: "1400", observed_at: null, conservative_at: null }, realised_drawdown: "500",
  tracks: [{ track: 1, track_id: "a", equity_drawdown: { observed: "800", conservative: "900" } }, { track: 2, track_id: "b", equity_drawdown: { observed: "600", conservative: "700" } }],
  diversification: { sum_of_tracks: "1600", worst_track: "900", combined_conservative: "1400" },
  daily: [], worst_day: { date: "2025-03-02", start_of_day_reference: "21000", loss_observed: "300", loss_conservative: "450" },
  margin: { lowest_level_percent: "340", lowest_level_at: null, peak_margin: "4000", intervals_below_stop_out: null }, chart: [], findings: [], warnings: [],
};
const all = (g: ReturnType<typeof equityCombinationGuidance>) => [...g.read, ...g.tips, ...g.flags];

test("sourced points cite registered sources; others cite none", () => {
  for (const point of all(equityCombinationGuidance(base, ["A", "B"]))) {
    if (point.label === "S") assert.ok(point.source && point.source in SOURCES, point.text);
    else assert.equal(point.source, undefined, point.text);
  }
});

test("the drawdown is read as a range and floating loss is named", () => {
  const text = all(equityCombinationGuidance(base, ["A", "B"])).map((point) => point.text).join(" ");
  assert.match(text, /between 900\.00 and 1400\.00 USD/);
  assert.match(text, /floating losses inside open trades/);
  assert.match(text, /no margin call or stop-out was simulated/);
});

test("diversification tips follow the comparison; no invented cut-offs", () => {
  const worse = { ...base, diversification: { sum_of_tracks: "1600", worst_track: "900", combined_conservative: "1400" } };
  const tips = equityCombinationGuidance(worse, ["A", "B"]).tips.map((tip) => tip.text);
  assert.ok(tips.some((tip) => /did not fully overlap/.test(tip)));
  assert.ok(tips.some((tip) => /may be larger/.test(tip)));  // observed 900 is not above the worst single track's 900
  assert.ok(tips.some((tip) => /shorter interval/.test(tip)));
  const flat = { ...base, equity_drawdown: { ...base.equity_drawdown, observed: "1400" } };
  assert.ok(!equityCombinationGuidance(flat, ["A", "B"]).tips.some((tip) => /shorter interval/.test(tip.text)));
});

test("the stop-out level is the user's own; intervals below it are counted", () => {
  assert.ok(equityCombinationGuidance(base, []).tips.some((tip) => tip.label === "U" && /stop-out level/.test(tip.text)));
  const set = { ...base, configuration: { ...base.configuration, stop_out_level: "50" }, margin: { ...base.margin, intervals_below_stop_out: 3 } };
  assert.ok(equityCombinationGuidance(set, []).tips.some((tip) => /3 interval\(s\) fell below your stop-out level of 50\.00 %/.test(tip.text)));
});

test("reports without a verified log are listed before running (E1)", () => {
  const byRef = new Map<string, DatasetEvidence>([["x", { equity: { status: "LINKED_VERIFIED" } } as unknown as DatasetEvidence], ["y", {} as DatasetEvidence]]);
  assert.deepEqual(reportsWithoutLog([["x"], ["y", "z"]], byRef), ["y", "z"]);
});

test("proven versus possible: larger than the worst track only on the observed value", () => {
  const proven = { ...base, equity_drawdown: { ...base.equity_drawdown, observed: "1000" } };
  const tips = equityCombinationGuidance(proven, []).tips.map((tip) => tip.text);
  assert.ok(tips.some((tip) => /even on the proven \(observed\) value/.test(tip)));
  assert.ok(!tips.some((tip) => /may be larger/.test(tip)));
});
