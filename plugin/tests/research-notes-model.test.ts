import assert from "node:assert/strict";
import test from "node:test";
import { buildResearchTree, entryFromFrontmatter, isCompatible, matchesFilter, nameCheck, recentEntries, similarTitles } from "../src/vault/research-notes-model.ts";

const note = (path: string, title: string, mtime: number, fm: Record<string, unknown>) => entryFromFrontmatter(path, title, mtime, fm)!;

test("only notes with a TRL type and id are entries; old experiments read as report-analysis", () => {
  assert.equal(entryFromFrontmatter("a.md", "A", 1, { tags: ["x"] }), null);
  assert.equal(entryFromFrontmatter("a.md", "A", 1, null), null);
  assert.equal(entryFromFrontmatter("a.md", "A", 1, { trl_type: "strategy" }), null);
  assert.equal(note("e.md", "E", 1, { trl_type: "experiment", trl_id: "e1", trl_dataset_id: "d1" }).kind, "report-analysis");
  assert.equal(note("e.md", "E", 1, { trl_type: "experiment", trl_id: "e1", trl_experiment_kind: "symbol-scan" }).kind, "symbol-scan");
  assert.equal(note("e.md", "E", 1, { trl_type: "experiment", trl_id: "e1" }).kind, "general");
  assert.equal(note("e.md", "E", 1, { trl_type: "experiment", trl_id: "e1", trl_experiment_kind: "nonsense" }).kind, "general");
});

test("the tree links by ids and lists orphans as unlinked", () => {
  const entries = [
    note("S/b.md", "Beta", 1, { trl_type: "strategy", trl_id: "s2" }),
    note("S/a.md", "alpha", 1, { trl_type: "strategy", trl_id: "s1" }),
    note("E/1.md", "Exp 1", 1, { trl_type: "experiment", trl_id: "e1", trl_strategy_id: "s1", trl_dataset_id: "d" }),
    note("E/2.md", "Exp 2", 1, { trl_type: "experiment", trl_id: "e2", trl_strategy_id: "gone" }),
    note("R/1.md", "Rep 1", 1, { trl_type: "report", trl_id: "r1", trl_experiment_id: "e1" }),
    note("R/2.md", "M0 note", 1, { trl_type: "report", trl_id: "r2" }),
  ];
  const tree = buildResearchTree(entries);
  assert.deepEqual(tree.strategies.map((node) => node.entry.title), ["alpha", "Beta"]);
  assert.deepEqual(tree.strategies[0]!.experiments.map((node) => [node.entry.title, node.reports.map((report) => report.title)]), [["Exp 1", ["Rep 1"]]]);
  assert.deepEqual(tree.unlinkedExperiments.map((node) => node.entry.title), ["Exp 2"]);
  assert.deepEqual(tree.unlinkedReports.map((entry) => entry.title), ["M0 note"]);
});

test("name checks block exact clashes and warn on near ones", () => {
  const titles = ["DCA symbol scan", "EURUSD H1"];
  assert.deepEqual(nameCheck("DCA symbol scan", titles), { exact: "DCA symbol scan", near: [] });
  assert.deepEqual(nameCheck("dca_symbol-scan", titles), { exact: null, near: ["DCA symbol scan"] });
  assert.deepEqual(nameCheck("New idea", titles), { exact: null, near: [] });
  assert.deepEqual(similarTitles("symbol", titles), ["DCA symbol scan"]);
  assert.deepEqual(similarTitles("s", titles), []);
});

test("compatibility follows the experiment kind and, for report analysis, the loaded analysis", () => {
  const analysis = note("E/a.md", "A", 1, { trl_type: "experiment", trl_id: "a", trl_dataset_id: "d1", trl_analysis_run_id: "r1" });
  const scan = note("E/s.md", "S", 1, { trl_type: "experiment", trl_id: "s", trl_experiment_kind: "symbol-scan" });
  const general = note("E/g.md", "G", 1, { trl_type: "experiment", trl_id: "g", trl_experiment_kind: "general" });
  assert.equal(isCompatible(scan, { kinds: ["symbol-scan", "general"] }), true);
  assert.equal(isCompatible(general, { kinds: ["symbol-scan", "general"] }), true);
  assert.equal(isCompatible(analysis, { kinds: ["symbol-scan", "general"] }), false);
  assert.equal(isCompatible(analysis, { kinds: ["report-analysis", "general"], datasetId: "d1", analysisRunId: "r1" }), true);
  assert.equal(isCompatible(analysis, { kinds: ["report-analysis", "general"], datasetId: "d2" }), false);
  assert.equal(isCompatible(analysis, { kinds: ["report-analysis"] }), false);
});

test("filters and recent notes", () => {
  const a = note("a.md", "Alpha scan", 5, { trl_type: "experiment", trl_id: "a", trl_experiment_kind: "symbol-scan" });
  const b = note("b.md", "Beta", 9, { trl_type: "strategy", trl_id: "b" });
  assert.equal(matchesFilter(a, "scan", "all", "all"), true);
  assert.equal(matchesFilter(a, "", "strategy", "all"), false);
  assert.equal(matchesFilter(a, "", "all", "parameter-study"), false);
  assert.deepEqual(recentEntries([a, b], 1).map((entry) => entry.title), ["Beta"]);
});
