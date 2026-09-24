import assert from "node:assert/strict";
import test from "node:test";
import { thresholdValue, windowBars, windowsGuidance } from "../src/components/analysis/windows-model.ts";
import type { TimeWindow, WindowsResult } from "../src/types.ts";

const window = (index: number, net: string, partial = false): TimeWindow => ({ index, label: `W${index}`, start: "2024-01-01", end: "2024-06-30", partial, source: { dataset_ref: "d" }, trades: 10, net_pnl: net, profit_factor: "1.2", profit_factor_reason: null, win_rate_percent: "50", expectancy: "1", sqn: "1", maximum_drawdown: "5", maximum_drawdown_percent: "1", equity_maximum_drawdown: null, losing: Number(net) < 0, below_min_trades: false });

test("bars scale to the largest absolute result and keep the sign", () => {
  assert.deepEqual(windowBars([window(1, "50"), window(2, "-100"), window(3, "0")]), [{ index: 1, height: 50, negative: false }, { index: 2, height: 100, negative: true }, { index: 3, height: 0, negative: false }]);
});

test("thresholds are optional whole numbers", () => {
  assert.equal(thresholdValue(""), null);
  assert.equal(thresholdValue(" 3 "), 3);
  assert.equal(thresholdValue("2.5"), undefined);
});

test("guidance restates the Core summary and flags partial windows", () => {
  const result = { calculation_version: "windows-1", evaluation_id: "e", currency: "USD", findings: [], notes: ["N"],
    configuration: { mode: "SPLIT", months: 6, min_trades: null, max_losing_windows: 0 }, windows: [window(1, "10327.55"), window(2, "-24607.68", true)],
    summary: { windows: 2, with_trades: 2, profitable: 1, losing: 1, worst: { index: 2, label: "2024-07-01 – 2024-12-31", net_pnl: "-24607.68" }, net_pnl_spread: { minimum: "-24607.68", median: "-24607.68", maximum: "10327.55" }, within_losing_allowance: false, below_min_trades: [] } } as WindowsResult;
  const guidance = windowsGuidance(result);
  assert.ok(guidance.read[1]!.includes("1 of 2 windows made money; the worst was 2024-07-01 – 2024-12-31 (-24607.68 USD)"));
  assert.ok(guidance.tips.some((tip) => tip.startsWith("More windows lost money (1) than you allow (0)")));
  assert.equal(guidance.flags[0], "Partial windows (marked) are not fully covered by the report.");
});
