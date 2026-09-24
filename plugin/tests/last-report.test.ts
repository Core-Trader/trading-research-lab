import assert from "node:assert/strict";
import test from "node:test";
import { readLastReport, sameLastReport } from "../src/application/last-report.ts";

test("a valid saved report is read with its working set", () => {
  const saved = { schema: 1, datasetRef: "ds-1", analysed: true, workingSet: { strategy: { id: "s", path: "S.md" }, experiment: null, report: { id: "", path: "R.md" } } };
  assert.deepEqual(readLastReport(saved), { schema: 1, datasetRef: "ds-1", analysed: true, workingSet: { strategy: { id: "s", path: "S.md" }, experiment: null, report: null } });
});

test("malformed or missing values mean nothing to restore", () => {
  assert.equal(readLastReport(undefined), null);
  assert.equal(readLastReport({ schema: 2, datasetRef: "ds" }), null);
  assert.equal(readLastReport({ schema: 1, datasetRef: "" }), null);
  const minimal = readLastReport({ schema: 1, datasetRef: "ds", analysed: "yes" });
  assert.equal(minimal?.analysed, false);
  assert.deepEqual(minimal?.workingSet, { strategy: null, experiment: null, report: null });
});

test("equality ignores object identity", () => {
  const a = readLastReport({ schema: 1, datasetRef: "ds", analysed: false });
  assert.equal(sameLastReport(a, readLastReport({ schema: 1, datasetRef: "ds", analysed: false })), true);
  assert.equal(sameLastReport(a, null), false);
});
