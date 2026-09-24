import assert from "node:assert/strict";
import test from "node:test";
import { belowMinimum, DEFAULT_THRESHOLDS, parseMinTrades, readThresholds, ThresholdStore } from "../src/application/research-settings.ts";

test("no minimum by default; 95 % is the preselected confidence", () => {
  assert.deepEqual(readThresholds(undefined), DEFAULT_THRESHOLDS);
  assert.equal(DEFAULT_THRESHOLDS.minTrades, null);
  assert.deepEqual(readThresholds({ minTrades: -3, confidence: "0.5" }), DEFAULT_THRESHOLDS);
  assert.deepEqual(readThresholds({ minTrades: 50, confidence: "0.99" }), { minTrades: 50, confidence: "0.99", showGuidance: true });
  assert.equal(readThresholds({ showGuidance: false }).showGuidance, false);
});

test("typed minimums: empty clears, positive whole numbers only", () => {
  assert.equal(parseMinTrades(""), null);
  assert.equal(parseMinTrades(" 40 "), 40);
  assert.equal(parseMinTrades("0"), undefined);
  assert.equal(parseMinTrades("2.5"), undefined);
});

test("the warning applies only when a minimum is set and the count is below it", () => {
  assert.equal(belowMinimum(10, null), false);
  assert.equal(belowMinimum(10, 30), true);
  assert.equal(belowMinimum(30, 30), false);
  assert.equal(belowMinimum(null, 30), false);
});

test("the store saves and notifies", async () => {
  const saved: unknown[] = [];
  const store = new ThresholdStore(undefined, async (value) => { saved.push(value); });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  store.set({ minTrades: 25 });
  assert.equal(store.snapshot.minTrades, 25);
  assert.equal(calls, 1);
  assert.deepEqual(saved, [{ minTrades: 25, confidence: "0.95", showGuidance: true }]);
});
