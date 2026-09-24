/**
 * Research notes index model (PROPOSAL_WINDOWS_AND_NOTES.md N1–N6). Pure: the
 * plugin feeds it the frontmatter of notes that carry a TRL `trl_type`; notes
 * without one are never read (N6).
 */

export type NoteType = "strategy" | "experiment" | "report";
/** N2: what an Experiment records. Notes from before trl_schema 2 are report-analysis. */
export type ExperimentKind = "report-analysis" | "symbol-scan" | "parameter-study" | "general";
export const EXPERIMENT_KINDS: ExperimentKind[] = ["report-analysis", "symbol-scan", "parameter-study", "general"];
export const KIND_LABEL: Record<ExperimentKind, string> = {
  "report-analysis": "Report analysis",
  "symbol-scan": "Symbol scan",
  "parameter-study": "Parameter study",
  general: "General",
};

export type NoteEntry = {
  type: NoteType;
  id: string;
  title: string;
  path: string;
  status: string | null;
  mtime: number;
  strategyId: string | null;
  experimentId: string | null;
  kind: ExperimentKind | null;
  datasetId: string | null;
  analysisRunId: string | null;
};

const TYPES = new Set<NoteType>(["strategy", "experiment", "report"]);

/** A note entry from frontmatter, or null when the note is not a TRL research note. */
export function entryFromFrontmatter(path: string, title: string, mtime: number, frontmatter: Record<string, unknown> | undefined | null): NoteEntry | null {
  if (!frontmatter) return null;
  const type = String(frontmatter.trl_type ?? "") as NoteType;
  const id = frontmatter.trl_id === undefined || frontmatter.trl_id === null ? "" : String(frontmatter.trl_id);
  if (!TYPES.has(type) || !id) return null;
  const text = (key: string): string | null => frontmatter[key] === undefined || frontmatter[key] === null || String(frontmatter[key]).trim() === "" ? null : String(frontmatter[key]).trim();
  const declared = text("trl_experiment_kind");
  const kind = type !== "experiment" ? null : declared && (EXPERIMENT_KINDS as string[]).includes(declared) ? declared as ExperimentKind : text("trl_dataset_id") ? "report-analysis" : "general";
  return { type, id, title, path, status: text("trl_status"), mtime, strategyId: text("trl_strategy_id"), experimentId: text("trl_experiment_id"), kind, datasetId: text("trl_dataset_id"), analysisRunId: text("trl_analysis_run_id") };
}

export type ExperimentNode = { entry: NoteEntry; reports: NoteEntry[] };
export type StrategyNode = { entry: NoteEntry; experiments: ExperimentNode[] };
export type ResearchTree = { strategies: StrategyNode[]; unlinkedExperiments: ExperimentNode[]; unlinkedReports: NoteEntry[] };

const byTitle = (left: NoteEntry, right: NoteEntry): number => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }) || left.path.localeCompare(right.path);

/** Strategy → Experiments → Reports, by the ids in frontmatter; anything whose parent is missing is listed as unlinked. */
export function buildResearchTree(entries: NoteEntry[]): ResearchTree {
  const strategies = entries.filter((entry) => entry.type === "strategy").sort(byTitle);
  const experiments = entries.filter((entry) => entry.type === "experiment").sort(byTitle);
  const reports = entries.filter((entry) => entry.type === "report").sort(byTitle);
  const strategyIds = new Set(strategies.map((entry) => entry.id));
  const experimentIds = new Set(experiments.map((entry) => entry.id));
  const node = (entry: NoteEntry): ExperimentNode => ({ entry, reports: reports.filter((report) => report.experimentId === entry.id) });
  return {
    strategies: strategies.map((entry) => ({ entry, experiments: experiments.filter((experiment) => experiment.strategyId === entry.id).map(node) })),
    unlinkedExperiments: experiments.filter((entry) => !entry.strategyId || !strategyIds.has(entry.strategyId)).map(node),
    unlinkedReports: reports.filter((entry) => !entry.experimentId || !experimentIds.has(entry.experimentId)),
  };
}

/** Case-insensitive name search plus type and kind filters; parents are kept when a child matches (done by the view). */
export function matchesFilter(entry: NoteEntry, query: string, type: NoteType | "all", kind: ExperimentKind | "all"): boolean {
  if (type !== "all" && entry.type !== type) return false;
  if (kind !== "all" && entry.type === "experiment" && entry.kind !== kind) return false;
  const text = query.trim().toLocaleLowerCase();
  return text === "" || entry.title.toLocaleLowerCase().includes(text);
}

const normalise = (name: string): string => name.toLocaleLowerCase().replace(/[\s_\-.]+/g, " ").trim();

/** N5: an exact clash (same file name) blocks; a near clash (differs only in case, spaces, - _ .) warns. */
export function nameCheck(name: string, existingTitles: string[]): { exact: string | null; near: string[] } {
  const trimmed = name.trim();
  const exact = existingTitles.find((title) => title === trimmed) ?? null;
  const near = trimmed === "" ? [] : existingTitles.filter((title) => title !== trimmed && normalise(title) === normalise(trimmed));
  return { exact, near };
}

/** Existing titles that contain the typed text (shown while typing a new name). */
export function similarTitles(name: string, existingTitles: string[], limit = 6): string[] {
  const text = normalise(name);
  if (text.length < 2) return [];
  return existingTitles.filter((title) => normalise(title).includes(text)).slice(0, limit);
}

/** What a record panel accepts (N1). report-analysis Experiments must match the loaded analysis when one is given. */
export type RecordRequirement = { kinds: ExperimentKind[]; datasetId?: string | null; analysisRunId?: string | null };

export function isCompatible(entry: NoteEntry, requirement: RecordRequirement): boolean {
  if (entry.type !== "experiment" || entry.kind === null || !requirement.kinds.includes(entry.kind)) return false;
  if (entry.kind === "report-analysis") return !!requirement.datasetId && entry.datasetId === requirement.datasetId && (!requirement.analysisRunId || entry.analysisRunId === requirement.analysisRunId);
  return true;
}

export function recentEntries(entries: NoteEntry[], count = 5): NoteEntry[] {
  return [...entries].sort((left, right) => right.mtime - left.mtime || byTitle(left, right)).slice(0, count);
}
