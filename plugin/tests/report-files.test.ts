import assert from "node:assert/strict";
import test from "node:test";
import { isMt5ReportPath, reportBaseName } from "../src/application/report-files.ts";

test("MT5 reports are accepted as .xlsx or HTML, case-insensitively", () => {
  assert.deepEqual(["a.xlsx", "B.HTM", "c.html ", "d.xml", "e.set", "f.htmlx"].map(isMt5ReportPath), [true, true, true, false, false, false]);
  assert.deepEqual(["EURUSD_2025.xlsx", "baseline.htm", "x.HTML", "keep.xml"].map(reportBaseName), ["EURUSD_2025", "baseline", "x", "keep.xml"]);
});
