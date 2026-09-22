import assert from "node:assert/strict";
import test from "node:test";
import { formatPercent, formatTimestamp, roundDecimalString } from "../src/components/display-format.ts";

test("decimal strings round half away from zero without float artefacts", () => {
  assert.equal(roundDecimalString("55.62500", 2), "55.63");
  assert.equal(roundDecimalString("1.7172728619735802723136467", 2), "1.72");
  assert.equal(roundDecimalString("-2.345", 2), "-2.35");
  assert.equal(roundDecimalString("1.005", 2), "1.01");
  assert.equal(roundDecimalString("99.995", 2), "100.00");
  assert.equal(roundDecimalString("-0.004", 2), "0.00");
  assert.equal(roundDecimalString("12", 2), "12.00");
  assert.equal(roundDecimalString("0.5", 0), "1");
  assert.equal(roundDecimalString("not-a-number", 2), "not-a-number");
});

test("percent and timestamp formatting are presentation only", () => {
  assert.equal(formatPercent("57.142857"), "57.14%");
  assert.equal(formatPercent(null), null);
  assert.equal(formatTimestamp("2026-03-02T17:00:00"), "2026-03-02 17:00:00");
});
