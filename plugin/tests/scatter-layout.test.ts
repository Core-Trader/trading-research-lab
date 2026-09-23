import assert from "node:assert/strict";
import test from "node:test";
import { keyboardOrder, nearestPoint, scatterLayout, type TradeOffPoint } from "../src/components/tradeoff/scatter-layout.ts";

const point = (id: string, x: string | null, y: string | null, status: TradeOffPoint["status"] = "DOMINATED", size?: string): TradeOffPoint => ({ id, label: id, x, y, status, size });

test("points span the padded plot with y increasing upwards", () => {
  const layout = scatterLayout([point("a", "0", "0"), point("b", "10", "100"), point("c", "5", "50")]);
  assert.ok(layout);
  const byId = Object.fromEntries(layout.placed.map((placed) => [placed.id, placed]));
  assert.equal(byId.a!.left, 4);
  assert.equal(byId.b!.left, 96);
  assert.equal(byId.b!.top, 4);
  assert.equal(byId.a!.top, 96);
  assert.equal(byId.c!.left, 50);
  assert.deepEqual([layout.xMin, layout.xMax, layout.yMin, layout.yMax], ["0", "10", "0", "100"]);
});

test("missing values are omitted, never plotted at zero", () => {
  const layout = scatterLayout([point("a", "1", "1"), point("gap", null, "5", "INCOMPLETE"), point("text", "abc", "1")]);
  assert.deepEqual(layout?.placed.map((placed) => placed.id), ["a"]);
  assert.deepEqual(layout?.omitted.map((omitted) => omitted.id), ["gap", "text"]);
  assert.equal(scatterLayout([point("gap", null, null)]), null);
});

test("a single distinct value is centred rather than dividing by zero", () => {
  const layout = scatterLayout([point("a", "5", "1"), point("b", "5", "2")]);
  assert.ok(layout?.placed.every((placed) => placed.left === 50));
});

test("frontier line joins only PARETO points ordered by x", () => {
  const layout = scatterLayout([point("p2", "10", "10", "PARETO"), point("d", "5", "5"), point("p1", "0", "0", "PARETO")], { frontierLine: true });
  assert.equal(layout?.frontier, "4,96 96,4");
  assert.equal(scatterLayout([point("p1", "0", "0", "PARETO")], { frontierLine: true })?.frontier, "");
  assert.equal(scatterLayout([point("p1", "0", "0", "PARETO"), point("p2", "1", "1", "PARETO")])?.frontier, "");
});

test("size encodes magnitude on a square-root scale within fixed bounds", () => {
  const layout = scatterLayout([point("small", "0", "0", "DOMINATED", "25"), point("big", "1", "1", "DOMINATED", "100")], { sizeByValue: true });
  const byId = Object.fromEntries((layout?.placed ?? []).map((placed) => [placed.id, placed.radius]));
  assert.equal(byId.big, 9);
  assert.equal(byId.small, 3 + Math.sqrt(0.25) * 6);
});

test("nearest point respects the pixel threshold", () => {
  const layout = scatterLayout([point("a", "0", "0"), point("b", "10", "10")]);
  assert.ok(layout);
  assert.equal(nearestPoint(layout.placed, 20, 385, 500, 400)?.id, "a");
  assert.equal(nearestPoint(layout.placed, 250, 200, 500, 400), null);
});

test("keyboard order is left to right", () => {
  const layout = scatterLayout([point("right", "9", "0"), point("left", "1", "0"), point("mid", "5", "0")]);
  assert.deepEqual(keyboardOrder(layout!.placed).map((placed) => placed.id), ["left", "mid", "right"]);
});
