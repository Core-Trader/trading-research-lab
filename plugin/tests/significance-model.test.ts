import assert from "node:assert/strict";
import test from "node:test";
import { intervalGeometry, significanceGuidance } from "../src/components/analysis/significance-model.ts";
import { SOURCES } from "../src/components/help/research-workflow.ts";
import type { SignificanceResult } from "../src/types.ts";

const base: SignificanceResult = {
  calculation_version: "significance-1", dataset_ref: "ds", currency: "USD", basis: "MT5_VERIFIED_CLOSE_EVENTS_NET_PNL", confidence: "0.95",
  mean_test: { count: 40, degrees_of_freedom: 39, mean: "5.00000000", standard_deviation: "20.00000000", standard_error: "3.16227766", t_statistic: "1.58113883",
    p_value_one_sided: "0.06095000", interval: { confidence: "0.95", critical_t: "2.02269092", low: "-1.39629290", high: "11.39629290" }, reason: null },
  runs_test: { wins: 22, losses: 18, breakeven_excluded: 0, runs: 21, expected_runs: "20.80000000", z: "0.06500000", critical_z: "1.95996398", p_value_two_sided: "0.94800000", status: "NOT_REJECTED" },
  lag1_autocorrelation: "0.05000000", validity: "VALID", notes: [],
};
const all = (guidance: ReturnType<typeof significanceGuidance>) => [...guidance.read, ...guidance.tips, ...guidance.flags];

test("every sourced point names a registered source; others carry none", () => {
  for (const result of [base, { ...base, validity: "NOT_VALID" as const, runs_test: { ...base.runs_test, status: "RANDOMNESS_REJECTED" as const, z: "-3.1" } }]) {
    for (const point of all(significanceGuidance(result, 50))) {
      if (point.label === "S") assert.ok(point.source && point.source in SOURCES, point.text);
      else assert.equal(point.source, undefined, point.text);
    }
  }
});

test("an interval that includes zero says so and gives the √N consequence and a next step", () => {
  const guidance = significanceGuidance(base, null);
  assert.ok(guidance.tips.some((tip) => /includes zero/.test(tip.text) && tip.source === "nistT"));
  assert.ok(guidance.tips.some((tip) => tip.label === "C" && /lengthen the test period/.test(tip.text)));
});

test("an interval above zero points to the cost that would erase its lower end", () => {
  const above = { ...base, mean_test: { ...base.mean_test, interval: { ...base.mean_test.interval!, low: "1.25000000" } } };
  assert.ok(significanceGuidance(above, null).tips.some((tip) => /1\.25 USD per trade/.test(tip.text) && /What-If/.test(tip.text)));
});

test("the p-value is never described as the chance the EA works", () => {
  const text = all(significanceGuidance(base, null)).map((point) => point.text).join(" ");
  assert.match(text, /not the probability that the EA has an edge/);
  assert.doesNotMatch(text, /\b(significant|proven|guarantee)/i);
});

test("a failed randomness check invalidates the test and explains streaks", () => {
  const streaky = { ...base, validity: "NOT_VALID" as const, runs_test: { ...base.runs_test, status: "RANDOMNESS_REJECTED" as const, z: "-3.10000000" } };
  const guidance = significanceGuidance(streaky, null);
  assert.ok(guidance.read[0]!.source === "nistRandomness" && /do not apply/.test(guidance.read[0]!.text), "the invalidity comes first");
  assert.ok(guidance.tips.some((tip) => /streaks/.test(tip.text)));
  assert.ok(!guidance.tips.some((tip) => /includes zero/.test(tip.text)));
});

test("the minimum-trade warning appears only below the user's own minimum", () => {
  assert.equal(significanceGuidance(base, null).flags.some((flag) => flag.label === "U"), false);
  assert.equal(significanceGuidance(base, 30).flags.some((flag) => flag.label === "U"), false);
  assert.match(significanceGuidance(base, 50).flags[0]!.text, /40 closed trades, fewer than your minimum of 50/);
});

test("the interval strip places zero between the ends when the interval spans it", () => {
  const geometry = intervalGeometry(base)!;
  assert.ok(geometry.low < geometry.zero && geometry.zero < geometry.high);
  assert.ok(geometry.low >= 0 && geometry.high <= 100);
  assert.equal(intervalGeometry({ ...base, mean_test: { ...base.mean_test, interval: null } }), null);
});
