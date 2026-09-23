import assert from "node:assert/strict";
import test from "node:test";
import { drawdownGap, equityGeometry } from "../src/components/analysis/equity-model.ts";

const point = (time: string, balance: string, close: string, min: string, max: string) => ({ time, balance, equity_close: close, equity_min: min, equity_max: max });

test("equity geometry spans balance and the min–max band on one scale", () => {
  const geometry = equityGeometry([point("a", "100", "100", "90", "110"), point("b", "120", "115", "100", "125")]);
  assert.ok(geometry);
  assert.equal(geometry.low, "90");
  assert.equal(geometry.high, "125");
  assert.equal(geometry.balance, "0.000,71.429 100.000,14.286");
  assert.equal(geometry.band.split(" ").length, 4);
  assert.equal(equityGeometry([]), null);
  assert.equal(equityGeometry([point("a", "x", "1", "1", "1")]), null);
});

test("a large equity-vs-balance drawdown gap is called out", () => {
  assert.match(drawdownGap("225", "45")!, /5\.0× the realised-balance drawdown/);
  assert.equal(drawdownGap("50", "45"), null);
  assert.equal(drawdownGap("50", null), null);
});
