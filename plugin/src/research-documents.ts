import { createHash, randomBytes } from "node:crypto";

export type ReportPayload = {
  report_id: string;
  dataset_id: string;
  source_import_id: string;
  source_sha256: string;
  analysis_run_id: string;
  core_version: string;
  calculation_version: string;
  markdown: string;
  generated_block_hash: string;
  configuration_hash: string;
};

export type ReportInspection = {
  changed: boolean;
  priorConfigurationHash: string;
  revision: number;
};

export type DocumentReference = {
  id: string;
  values: Record<string, string>;
};

const END_MARKER = "<!-- TRL:GENERATED:END -->";
const START_MARKER = /<!-- TRL:GENERATED:START analysis_run_id=[0-9a-f-]{36} -->/g;

export function uuidv7(): string {
  const hex = `${Date.now().toString(16).padStart(12, "0")}${randomBytes(10).toString("hex")}`;
  const variant = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function strategyDocumentText(id: string, title: string): string {
  return `---\ntrl_type: strategy\ntrl_schema: 1\ntrl_id: ${id}\ntrl_status: draft\n---\n\n# ${title}\n\n`;
}

export function experimentDocumentText(id: string, title: string, strategyId: string, datasetId: string, analysisRunId: string): string {
  return `---\ntrl_type: experiment\ntrl_schema: 1\ntrl_id: ${id}\ntrl_status: draft\ntrl_strategy_id: ${strategyId}\ntrl_dataset_id: ${datasetId}\ntrl_analysis_run_id: ${analysisRunId}\n---\n\n# ${title}\n\n`;
}

/** trl_schema 2 (N2): an Experiment declares its kind; report-analysis ones keep their dataset and analysis binding. */
export function experimentNoteText(id: string, title: string, strategyId: string, kind: "report-analysis" | "symbol-scan" | "parameter-study" | "general", bindings: Record<string, string> = {}): string {
  if (kind === "report-analysis" && (!bindings.trl_dataset_id || !bindings.trl_analysis_run_id)) throw new Error("A report-analysis experiment needs the loaded report's dataset and analysis.");
  const extra = Object.entries(bindings).filter(([key, value]) => /^trl_[a-z0-9_]+$/.test(key) && value.trim() !== "").map(([key, value]) => `${key}: ${value.trim()}
`).join("");
  return `---
trl_type: experiment
trl_schema: 2
trl_id: ${id}
trl_status: draft
trl_strategy_id: ${strategyId}
trl_experiment_kind: ${kind}
${extra}---

# ${title}

`;
}

export function reportDocumentText(payload: ReportPayload, title: string, experimentId: string): string {
  return `---\ntrl_type: report\ntrl_schema: 1\ntrl_id: ${payload.report_id}\ntrl_status: draft\ntrl_experiment_id: ${experimentId}\ntrl_dataset_id: ${payload.dataset_id}\ntrl_source_import_id: ${payload.source_import_id}\ntrl_analysis_run_id: ${payload.analysis_run_id}\ntrl_engine_version: ${payload.core_version}\ntrl_calculation_version: ${payload.calculation_version}\ntrl_configuration_hash: ${payload.configuration_hash}\ntrl_generated_block_hash: ${payload.generated_block_hash}\ntrl_report_revision: 1\n---\n\n# ${title}\n\nAdd your research commentary outside the generated section.\n\n${generatedBlock(payload)}`;
}

export function readDocumentReference(note: string, expectedType: "strategy" | "experiment" | "report", requiredKeys: string[] = []): DocumentReference {
  const { values } = parseFrontmatter(note);
  if (values.trl_type !== expectedType) throw new Error(`Selected document is not a TRL ${expectedType}.`);
  if (!values.trl_id) throw new Error("Selected document is missing trl_id.");
  for (const key of requiredKeys) {
    if (!values[key]) throw new Error(`Selected document is missing ${key}.`);
  }
  return { id: values.trl_id, values };
}

export function inspectReportForRegeneration(prior: string, payload: ReportPayload, experimentId: string): ReportInspection {
  const parsed = parseReport(prior);
  const expected: Record<string, string> = {
    trl_id: payload.report_id,
    trl_experiment_id: experimentId,
    trl_dataset_id: payload.dataset_id,
    trl_analysis_run_id: payload.analysis_run_id,
    trl_engine_version: payload.core_version,
    trl_calculation_version: payload.calculation_version,
    trl_configuration_hash: payload.configuration_hash,
    trl_generated_block_hash: payload.generated_block_hash,
  };
  const metadataMatches = Object.entries(expected).every(([key, value]) => parsed.values[key] === value);
  const currentBlockHash = sha256(parsed.generatedMarkdown);
  return {
    changed: !metadataMatches || currentBlockHash !== payload.generated_block_hash,
    priorConfigurationHash: parsed.values.trl_configuration_hash!,
    revision: Number.parseInt(parsed.values.trl_report_revision!, 10),
  };
}

export function regenerateReportText(prior: string, payload: ReportPayload, experimentId: string, nextRevision: number): string {
  const parsed = parseReport(prior);
  if (!Number.isInteger(nextRevision) || nextRevision < 2) throw new Error("A changed report regeneration requires the next positive revision.");
  const updates: Record<string, string> = {
    trl_id: payload.report_id,
    trl_experiment_id: experimentId,
    trl_dataset_id: payload.dataset_id,
    trl_source_import_id: payload.source_import_id,
    trl_analysis_run_id: payload.analysis_run_id,
    trl_engine_version: payload.core_version,
    trl_calculation_version: payload.calculation_version,
    trl_configuration_hash: payload.configuration_hash,
    trl_generated_block_hash: payload.generated_block_hash,
    trl_report_revision: String(nextRevision),
  };
  let frontmatter = parsed.frontmatter;
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^${key}:.*$`, "m");
    if (!pattern.test(frontmatter)) throw new Error(`Existing report is missing ${key}. Review it before regeneration.`);
    frontmatter = frontmatter.replace(pattern, `${key}: ${value}`);
  }
  const rebuilt = `---\n${frontmatter}\n---${parsed.afterFrontmatter}`;
  const refreshed = parseReport(rebuilt);
  return `${rebuilt.slice(0, refreshed.startAt)}${generatedBlock(payload)}${rebuilt.slice(refreshed.endAt + END_MARKER.length)}`;
}

function generatedBlock(payload: ReportPayload): string {
  return `<!-- TRL:GENERATED:START analysis_run_id=${payload.analysis_run_id} -->\n${payload.markdown}${END_MARKER}\n`;
}

function parseReport(note: string): { frontmatter: string; afterFrontmatter: string; values: Record<string, string>; generatedMarkdown: string; startAt: number; endAt: number } {
  const { frontmatter, frontmatterEnd, values } = parseFrontmatter(note);
  for (const key of ["trl_type", "trl_id", "trl_experiment_id", "trl_dataset_id", "trl_analysis_run_id", "trl_engine_version", "trl_calculation_version", "trl_configuration_hash", "trl_generated_block_hash", "trl_report_revision"]) {
    if (!values[key]) throw new Error(`Existing report is missing ${key}. Review it before regeneration.`);
  }
  if (values.trl_type !== "report") throw new Error("Existing document is not a TRL report. Review it before regeneration.");
  const starts = note.match(START_MARKER) ?? [];
  const ends = note.match(new RegExp(escapeRegex(END_MARKER), "g")) ?? [];
  const startMarker = starts[0] ?? "";
  const startAt = note.indexOf(startMarker);
  const endAt = note.indexOf(END_MARKER, startAt);
  if (starts.length !== 1 || ends.length !== 1 || startAt < 0 || endAt < startAt) throw new Error("Generated-content markers are missing, duplicated, malformed, or do not match this report. Review the note before regeneration.");
  const contentStart = startAt + startMarker.length + 1;
  return { frontmatter, afterFrontmatter: note.slice(frontmatterEnd + 4), values, generatedMarkdown: note.slice(contentStart, endAt), startAt, endAt };
}

function parseFrontmatter(note: string): { frontmatter: string; frontmatterEnd: number; values: Record<string, string> } {
  if (!note.startsWith("---\n")) throw new Error("Existing document has no valid frontmatter. Review it before continuing.");
  const frontmatterEnd = note.indexOf("\n---\n", 4);
  if (frontmatterEnd < 0) throw new Error("Existing document has malformed frontmatter. Review it before continuing.");
  const frontmatter = note.slice(4, frontmatterEnd);
  const values: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const match = /^(trl_[a-z0-9_]+):\s*(.*)$/.exec(line);
    if (match) values[match[1]!] = match[2]!;
  }
  return { frontmatter, frontmatterEnd, values };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
