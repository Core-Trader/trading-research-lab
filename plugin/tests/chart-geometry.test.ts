import assert from "node:assert/strict";
import test from "node:test";
import { lineGeometry, nearestIndex } from "../src/components/chart-geometry.ts";

test("line geometry needs at least two numeric points", () => {
  assert.equal(lineGeometry([]), null);
  assert.equal(lineGeometry(["100.00"]), null);
  assert.equal(lineGeometry(["100.00", "not-a-number"]), null);
});

test("high and low indices point at the Core values used as axis labels", () => {
  const geometry = lineGeometry(["100.00", "130.50", "90.25", "110.00"]);
  assert.ok(geometry);
  assert.equal(geometry.highIndex, 1);
  assert.equal(geometry.lowIndex, 2);
});

test("points are evenly spaced left to right and the high sits at the top", () => {
  const geometry = lineGeometry(["100", "200", "150"]);
  assert.ok(geometry);
  assert.deepEqual(geometry.positions.map((point) => point.x), [0, 50, 100]);
  assert.equal(geometry.positions[1]?.y, 5);
  assert.equal(geometry.positions[0]?.y, 95);
  assert.equal(geometry.firstY, 95);
  assert.equal(geometry.polyline, "0,95 50,5 100,50");
});

test("a flat series is drawn mid-height instead of dividing by zero", () => {
  const geometry = lineGeometry(["100.00", "100.00", "100.00"]);
  assert.ok(geometry);
  assert.ok(geometry.positions.every((point) => point.y === 50));
});

test("the first maximum wins when values repeat, so labels are stable", () => {
  const geometry = lineGeometry(["100", "120", "120", "80", "80"]);
  assert.equal(geometry?.highIndex, 1);
  assert.equal(geometry?.lowIndex, 3);
});

test("nearest index clamps to the series and rounds to the closest point", () => {
  assert.equal(nearestIndex(-0.5, 5), 0);
  assert.equal(nearestIndex(1.5, 5), 4);
  assert.equal(nearestIndex(0.49, 5), 2);
  assert.equal(nearestIndex(0.3, 1), 0);
});

test("bars sit on a zero line with signs taken from the values", async () => {
  const { barGeometry } = await import("../src/components/chart-geometry.ts");
  const geometry = barGeometry(["10", "-5", "0"]);
  assert.ok(geometry);
  assert.equal(geometry.zeroY, 5 + (10 / 15) * 90);
  assert.deepEqual(geometry.bars.map((bar) => bar.sign), ["positive", "negative", "zero"]);
  assert.equal(geometry.bars[0]!.y, 5);
  assert.equal(geometry.bars[0]!.y + geometry.bars[0]!.height, geometry.zeroY);
  assert.equal(geometry.bars[1]!.y, geometry.zeroY);
  assert.equal(geometry.highIndex, 0);
  assert.equal(geometry.lowIndex, 1);
});

test("all-positive bars still anchor at zero", async () => {
  const { barGeometry } = await import("../src/components/chart-geometry.ts");
  const geometry = barGeometry(["2", "4"]);
  assert.equal(geometry?.zeroY, 95);
});

test("multi-line geometry shares one scale and rejects ragged series", async () => {
  const { multiLineGeometry } = await import("../src/components/chart-geometry.ts");
  assert.equal(multiLineGeometry([["0", "1"], ["0"]]), null);
  const geometry = multiLineGeometry([["0", "10"], ["0", "-10"]]);
  assert.ok(geometry);
  assert.equal(geometry.lines[0], "0,50 100,5");
  assert.equal(geometry.lines[1], "0,50 100,95");
  assert.deepEqual(geometry.highIndex, { line: 0, point: 1 });
  assert.deepEqual(geometry.lowIndex, { line: 1, point: 1 });
});

test("intensity is a bounded visual scale", async () => {
  const { intensity } = await import("../src/components/chart-geometry.ts");
  assert.equal(intensity("-50", 50), 1);
  assert.equal(intensity("0", 50), 0.15);
  assert.equal(intensity("10", 0), 0.15);
  assert.equal(intensity("999", 50), 1);
});
