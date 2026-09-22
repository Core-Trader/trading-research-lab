import type { MarkdownResult } from "./types";

const END_MARKER = "<!-- TRL:GENERATED:END -->";
const START_MARKER = /<!-- TRL:GENERATED:START analysis_run_id=[0-9a-f-]{36} -->/g;

export function generatedNoteBlock(rendered: MarkdownResult): string {
  return `<!-- TRL:GENERATED:START analysis_run_id=${rendered.analysis_run_id} -->\n${rendered.markdown}${END_MARKER}`;
}

export function updateGeneratedNoteText(prior: string, rendered: MarkdownResult): string {
  const allStarts = prior.match(START_MARKER) ?? [];
  const allEnds = prior.match(new RegExp(escapeRegex(END_MARKER), "g")) ?? [];
  const priorStart = allStarts[0] ?? "";
  const startAt = prior.indexOf(priorStart);
  const endAt = prior.indexOf(END_MARKER, startAt);
  if (allStarts.length !== 1 || allEnds.length !== 1 || startAt < 0 || endAt < startAt) {
    throw new Error("Generated-content markers are missing, duplicated, malformed, or do not match this analysis run. Review the note before retrying.");
  }

  const withUpdatedFrontmatter = updatePluginFrontmatter(prior, rendered);
  const updatedStartAt = withUpdatedFrontmatter.indexOf(priorStart);
  const updatedEndAt = withUpdatedFrontmatter.indexOf(END_MARKER, updatedStartAt);
  return `${withUpdatedFrontmatter.slice(0, updatedStartAt)}${generatedNoteBlock(rendered)}${withUpdatedFrontmatter.slice(updatedEndAt + END_MARKER.length)}`;
}

function updatePluginFrontmatter(note: string, rendered: MarkdownResult): string {
  if (!note.startsWith("---\n")) throw new Error("Existing generated note has no valid frontmatter. Review it before regeneration.");
  const closeAt = note.indexOf("\n---\n", 4);
  if (closeAt < 0) throw new Error("Existing generated note has malformed frontmatter. Review it before regeneration.");
  let frontmatter = note.slice(4, closeAt);
  const updates: Record<string, string> = {
    trl_engine_version: rendered.core_version,
    trl_dataset_id: rendered.dataset_id,
    trl_source_import_id: rendered.source_import_id,
    trl_analysis_run_id: rendered.analysis_run_id,
  };
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^${key}:.*$`, "m");
    if (!pattern.test(frontmatter)) throw new Error(`Existing generated note is missing ${key}. Review it before regeneration.`);
    frontmatter = frontmatter.replace(pattern, `${key}: ${value}`);
  }
  return `---\n${frontmatter}${note.slice(closeAt)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
