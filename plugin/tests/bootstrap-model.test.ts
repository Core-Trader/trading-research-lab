import assert from "node:assert/strict";
import test from "node:test";
import { blockLengthProblem, bootstrapGuidance } from "../src/components/advanced/bootstrap-model.ts";
import { SOURCES } from "../src/components/help/research-workflow.ts";
import type { BootstrapResult } from "../src/types.ts";

const base: BootstrapResult = {
  analysis_id: "a", analysis_basis: "MT5_VERIFIED_CLOSE_EVENTS", policy_id: "p", calculation_version: "m6-monte-carlo-bootstrap-1", dataset_ref: "ds", currency: "USD", method: "RESAMPLE",
  configuration: { sampling_method: "RESAMPLE_WITH_REPLACEMENT", block_length: null, path_count: 1000, seed: "1", prng: "PCG32-v1", drawdown_limit: null, input_artifact: "x" },
  population_count: 80, source_total_close_event_pnl: "400", final_summary: { minimum: "-300", p05: "-50", p50: "390", p95: "820", maximum: "1400" },
  below_zero: { count: 70, percent: "7.00000000" }, historical_final_rank_percent: "51", final_histogram: { bin_count: 1, buckets: [] },
  drawdown_summary: { minimum: "40", p50: "210", p95: "480", maximum: "900" }, drawdown_percentiles: [], drawdown_histogram: { bin_count: 1, buckets: [] },
  over_limit: null, historical: { maximum_drawdown: "260", final: "400" }, account: { opening_balance: null, p50_percent_of_opening: null, p95_percent_of_opening: null }, tail_values: ["p99", "minimum", "maximum"], warnings: [],
};
const all = (g: ReturnType<typeof bootstrapGuidance>) => [...g.read, ...g.tips, ...g.flags];

test("sourced points cite registered sources; others cite none", () => {
  for (const result of [base, { ...base, method: "BLOCK_RESAMPLE" as const, configuration: { ...base.configuration, block_length: 4 }, over_limit: { limit: "300", count: 200, percent: "20" } }]) {
    for (const point of all(bootstrapGuidance(result, true))) {
      if (point.label === "S") assert.ok(point.source && point.source in SOURCES, point.text);
      else assert.equal(point.source, undefined, point.text);
    }
  }
});

test("the share below zero is read as this sample, not a forecast", () => {
  const text = all(bootstrapGuidance(base, false)).map((point) => point.text).join(" ");
  assert.match(text, /7\.00 % of paths ended below zero/);
  assert.match(text, /not future markets/);
});

test("tails are described but never drive a tip", () => {
  const guidance = bootstrapGuidance(base, false);
  assert.ok(guidance.read.some((point) => point.source === "nistBootstrap" && /least reliable/.test(point.text)));
  assert.ok(!guidance.tips.some((tip) => tip.text.includes("900") || tip.text.includes("1400")));
});

test("streaks recommend blocks only when single trades were resampled", () => {
  assert.ok(bootstrapGuidance(base, true).tips.some((tip) => /Resample in blocks/.test(tip.text)));
  const blocks = { ...base, method: "BLOCK_RESAMPLE" as const, configuration: { ...base.configuration, block_length: 4 } };
  assert.ok(!bootstrapGuidance(blocks, true).tips.some((tip) => /Resample in blocks/.test(tip.text)));
  assert.ok(bootstrapGuidance(blocks, true).tips.some((tip) => /different block lengths/.test(tip.text)));
});

test("no losing paths still points to out-of-sample confirmation", () => {
  const clean = { ...base, below_zero: { count: 0, percent: "0.00000000" } };
  assert.ok(bootstrapGuidance(clean, false).tips.some((tip) => /never saw/.test(tip.text)));
});

test("the block length is the user's own and must fit the report", () => {
  assert.match(blockLengthProblem("", 80)!, /your own block length/);
  assert.equal(blockLengthProblem("4", 80), null);
  assert.ok(blockLengthProblem("1", 80));
  assert.ok(blockLengthProblem("80", 80));
  assert.ok(blockLengthProblem("2.5", 80));
});
