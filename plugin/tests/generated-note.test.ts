import assert from "node:assert/strict";
import test from "node:test";
import { updateGeneratedNoteText } from "../src/generated-note.ts";

const firstRun = {
  analysis_run_id: "11111111-1111-7111-8111-111111111111",
  core_version: "0.0.1",
  dataset_id: "22222222-2222-7222-8222-222222222222",
  source_import_id: "33333333-3333-7333-8333-333333333333",
  markdown: "## Generated first run\n\n- Analysis run: `first`\n",
};

const secondRun = {
  analysis_run_id: "44444444-4444-7444-8444-444444444444",
  core_version: "0.0.1",
  dataset_id: "55555555-5555-7555-8555-555555555555",
  source_import_id: "66666666-6666-7666-8666-666666666666",
  markdown: "## Generated second run\n\n- Analysis run: `second`\n",
};

function noteForFirstRun(): string {
  return `---\ntrl_type: report\ntrl_engine_version: ${firstRun.core_version}\ntrl_dataset_id: ${firstRun.dataset_id}\ntrl_source_import_id: ${firstRun.source_import_id}\ntrl_analysis_run_id: ${firstRun.analysis_run_id}\n---\n\n# User title\n\nUser prose before.\n\n<!-- TRL:GENERATED:START analysis_run_id=${firstRun.analysis_run_id} -->\n${firstRun.markdown}<!-- TRL:GENERATED:END -->\n\nUser prose after.\n`;
}

test("replaces only the bounded generated section and updates plugin frontmatter", () => {
  const updated = updateGeneratedNoteText(noteForFirstRun(), secondRun);
  assert.match(updated, /User prose before\./);
  assert.match(updated, /User prose after\./);
  assert.match(updated, /trl_dataset_id: 55555555-5555-7555-8555-555555555555/);
  assert.match(updated, /## Generated second run/);
  assert.equal((updated.match(/TRL:GENERATED:START/g) ?? []).length, 1);
  assert.equal((updated.match(/TRL:GENERATED:END/g) ?? []).length, 1);
  assert.doesNotMatch(updated, /Generated first run/);
});

test("rejects duplicate generated markers rather than risking user text", () => {
  const malformed = `${noteForFirstRun()}\n<!-- TRL:GENERATED:END -->\n`;
  assert.throws(() => updateGeneratedNoteText(malformed, secondRun), /markers are missing, duplicated, malformed/);
});
