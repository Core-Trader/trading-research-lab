import assert from "node:assert/strict";
import test from "node:test";
import { coverageText, defaultSettings, heatmapCells, ordinalNames, statisticsNote, suggestedSetPath } from "../src/components/exploration/neighbourhood-model.ts";
import type { NeighbourhoodResult, NeighbourhoodSlice, ParameterStudy } from "../src/types.ts";

const parameter = (name: string, ordinal: boolean, step: string | null): ParameterStudy["parameters"][number] => ({ name, kind: "NUMERIC", ordinal, in_schema: true, tested_values: [], step, start: "0", stop: "5" });

test("steppable parameters start ordinal; mode switches stay equal", () => {
  const settings = defaultSettings([parameter("InpMode", false, "0"), parameter("InpA", true, "1"), parameter("InpB", true, "0")]);
  assert.deepEqual(settings, { roles: { InpMode: "CATEGORICAL", InpA: "ORDINAL", InpB: "CATEGORICAL" }, radius: 1 });
  assert.deepEqual(ordinalNames({ ...settings, roles: { ...settings.roles, InpA: "HELD_FIXED" } }), []);
});

test("coverage and statistics wording follow the Core coverage", () => {
  const result = { radius: 1, coverage: { possible: 17, tested: 3, minimum_for_statistics: 4, sufficient: false, by_source: {}, held_equal: ["InpMode"] } } as unknown as NeighbourhoodResult;
  assert.equal(coverageText(result), "3 of 17 neighbouring settings were tested (±1 step; held equal: InpMode).");
  assert.match(statisticsNote(result), /at least 4 needed/);
  assert.equal(coverageText({ ...result, radius: 2, coverage: { ...result.coverage, held_equal: [] } }), "3 of 17 neighbouring settings were tested (±2 steps).");
});

test("heatmap shades by direction and never shades untested cells", () => {
  const slice: NeighbourhoodSlice = { axes: ["A", "B"], metric: "m", x_values: ["1", "2"], y_values: ["10", "20"], windowed: false, cells: [
    [{ value: "10", tested: true, id: "a", is_candidate: false }, { value: null, tested: false, id: null, is_candidate: false }],
    [{ value: "30", tested: true, id: "b", is_candidate: true }, { value: "20", tested: true, id: "c", is_candidate: false }],
  ] };
  const up = heatmapCells(slice, "MAX", "A", "B");
  assert.deepEqual(up.map((row) => row.map((cell) => cell.shade)), [[0, null], [1, 0.5]]);
  assert.equal(up[0]![1]!.title, "A 2, B 10: not tested");
  assert.equal(up[1]![0]!.title, "A 1, B 20: 30 (selected)");
  assert.deepEqual(heatmapCells(slice, "MIN", "A", "B").map((row) => row.map((cell) => cell.shade)), [[1, null], [0, 0.5]]);
});

test("the neighbourhood .set is suggested next to the study's .set", () => {
  assert.equal(suggestedSetPath("C:\\MT5\\Presets\\ea.set", "EA_neighbourhood_pass_66_r1.set"), "C:\\MT5\\Presets\\EA_neighbourhood_pass_66_r1.set");
  assert.equal(suggestedSetPath("", "x.set"), "x.set");
});
