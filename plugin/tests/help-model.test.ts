import assert from "node:assert/strict";
import test from "node:test";
import { LOGGER_FILES, looksLikeMql5Folder, relativeParts } from "../src/components/help/help-model.ts";

test("each MQL5 file goes where MT5 expects it, or side by side in a plain folder", () => {
  const [include, example] = LOGGER_FILES;
  assert.deepEqual(relativeParts(include!, "mt5"), ["Include", "TRL_EquityLogger.mqh"]);
  assert.deepEqual(relativeParts(example!, "mt5"), ["Experts", "TRL", "TRL_EquityLogger_Example.mq5"]);
  assert.deepEqual(relativeParts(example!, "folder"), ["TRL_EquityLogger_Example.mq5"]);
});

test("an MQL5 folder is recognised by Include and Experts", () => {
  assert.equal(looksLikeMql5Folder(["Experts", "Include", "Indicators", "Files"]), true);
  assert.equal(looksLikeMql5Folder(["include", "EXPERTS"]), true);
  assert.equal(looksLikeMql5Folder(["Downloads", "Include"]), false);
});
