import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { experimentDocumentText, experimentNoteText, inspectReportForRegeneration, readDocumentReference, regenerateReportText, reportDocumentText, strategyDocumentText, uuidv7 } from "../src/research-documents.ts";

const payload = {
  report_id: "01234567-89ab-7cde-8123-456789abcdef",
  dataset_id: "22222222-2222-7222-8222-222222222222",
  source_import_id: "33333333-3333-7333-8333-333333333333",
  source_sha256: "A".repeat(64),
  analysis_run_id: "11111111-1111-7111-8111-111111111111",
  core_version: "0.0.1",
  calculation_version: "m4-report-payload-1",
  markdown: "## Generated report\n\n- Result: `10`\n",
  generated_block_hash: createHash("sha256").update("## Generated report\n\n- Result: `10`\n", "utf8").digest("hex").toUpperCase(),
  configuration_hash: "B".repeat(64),
};
const experimentId = "44444444-4444-7444-8444-444444444444";

test("document shells carry explicit identity and relationship fields", () => {
  assert.match(uuidv7(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(strategyDocumentText("55555555-5555-7555-8555-555555555555", "My strategy"), /trl_type: strategy/);
  assert.match(experimentDocumentText(experimentId, "My experiment", "55555555-5555-7555-8555-555555555555", payload.dataset_id, payload.analysis_run_id), /trl_strategy_id:/);
});

test("explicit document selection validates only the expected document type and required links", () => {
  const experiment = experimentDocumentText(experimentId, "My experiment", "55555555-5555-7555-8555-555555555555", payload.dataset_id, payload.analysis_run_id);
  assert.equal(readDocumentReference(experiment, "experiment", ["trl_strategy_id", "trl_dataset_id", "trl_analysis_run_id"]).id, experimentId);
  assert.throws(() => readDocumentReference(experiment, "strategy"), /not a TRL strategy/);
});

test("unchanged report candidate performs no-write no-revision detection", () => {
  const report = reportDocumentText(payload, "My report", experimentId);
  const inspection = inspectReportForRegeneration(report, payload, experimentId);
  assert.equal(inspection.changed, false);
  assert.equal(inspection.revision, 1);
});

test("changed generated content updates only managed content and revision", () => {
  const report = `${reportDocumentText(payload, "My report", experimentId)}\nUser prose after.\n`;
  const changed = { ...payload, markdown: "## Changed report\n", generated_block_hash: "C".repeat(64), configuration_hash: "D".repeat(64) };
  const updated = regenerateReportText(report, changed, experimentId, 2);
  assert.match(updated, /trl_report_revision: 2/);
  assert.match(updated, /## Changed report/);
  assert.match(updated, /User prose after\./);
});

test("malformed markers block regeneration", () => {
  const malformed = `${reportDocumentText(payload, "My report", experimentId)}<!-- TRL:GENERATED:END -->`;
  assert.throws(() => inspectReportForRegeneration(malformed, payload, experimentId), /markers are missing, duplicated, malformed/);
});

test("schema 2 experiments declare their kind; report-analysis ones must carry the analysis binding", () => {
  const scan = experimentNoteText("11111111-1111-7111-8111-111111111111", "DCA scan", "22222222-2222-7222-8222-222222222222", "symbol-scan");
  assert.match(scan, /trl_schema: 2\ntrl_id: 11111111-1111-7111-8111-111111111111\ntrl_status: draft\ntrl_strategy_id: 22222222-2222-7222-8222-222222222222\ntrl_experiment_kind: symbol-scan\n---/);
  assert.equal(readDocumentReference(scan, "experiment").values.trl_experiment_kind, "symbol-scan");
  const analysis = experimentNoteText("1", "A", "2", "report-analysis", { trl_dataset_id: "d", trl_analysis_run_id: "r", "not a key": "x" });
  assert.match(analysis, /trl_dataset_id: d\ntrl_analysis_run_id: r\n---/);
  assert.doesNotMatch(analysis, /not a key/);
  assert.throws(() => experimentNoteText("1", "A", "2", "report-analysis"), /needs the loaded report/);
});
