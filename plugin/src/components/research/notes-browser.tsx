import React, { useMemo, useState } from "react";
import type { NotesApi } from "../../vault/notes-api";
import { buildResearchTree, EXPERIMENT_KINDS, KIND_LABEL, matchesFilter, type ExperimentKind, type ExperimentNode, type NoteEntry, type NoteType } from "../../vault/research-notes-model";
import { DismissButton } from "../dismiss-button";

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

type Props = {
  notes: NotesApi;
  strategyPath: string | null;
  experimentPath: string | null;
  analysis: { datasetId: string; analysisRunId: string } | null;
  onUseStrategy: (entry: NoteEntry) => void;
  onUseExperiment: (entry: NoteEntry) => void;
};

/**
 * Research notes browser (N3): every TRL Strategy, Experiment and Report (notes
 * with TRL frontmatter only, N6), as a tree with search, filters, open, use and
 * rename. Renaming goes through Obsidian, so links to the note are updated.
 */
export function ResearchNotesBrowser({ notes, strategyPath, experimentPath, analysis, onUseStrategy, onUseExperiment }: Props): React.ReactElement {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<NoteType | "all">("all");
  const [kind, setKind] = useState<ExperimentKind | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const tree = useMemo(() => buildResearchTree(notes.entries), [notes.entries]);
  const match = (entry: NoteEntry): boolean => matchesFilter(entry, query, type, kind);
  const experimentVisible = (node: ExperimentNode): boolean => match(node.entry) || node.reports.some(match);
  const counts = { strategy: 0, experiment: 0, report: 0 };
  for (const entry of notes.entries) counts[entry.type] += 1;

  const rename = async (entry: NoteEntry): Promise<void> => {
    setError(null);
    const titles = notes.entries.filter((item) => item.type === entry.type && item.path !== entry.path).map((item) => item.title);
    const title = await notes.promptName(`Rename ${entry.type}`, "New name", entry.title, titles, "Rename");
    if (!title || title === entry.title) return;
    try { await notes.rename(entry.path, title); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const usable = (entry: NoteEntry): boolean => entry.kind === "report-analysis" && analysis !== null && entry.datasetId === analysis.datasetId && entry.analysisRunId === analysis.analysisRunId;

  const row = (entry: NoteEntry, depth: number): React.ReactElement => <div className={`trl-notes__row is-${entry.type}${entry.path === strategyPath || entry.path === experimentPath ? " is-current" : ""}`} style={{ paddingLeft: `${depth * 1.1}rem` }}>
    <span className="trl-notes__title"><button type="button" className="trl-link-button" title={entry.path} onClick={() => notes.open(entry.path)}>{entry.title}</button></span>
    <span className="trl-notes__meta">{entry.type === "experiment" && entry.kind ? KIND_LABEL[entry.kind] : entry.type === "strategy" ? "Strategy" : "Report"}{entry.status ? ` · ${entry.status}` : ""} · {new Date(entry.mtime).toISOString().slice(0, 10)}</span>
    <span className="trl-notes__actions">
      {entry.type === "strategy" && <button type="button" disabled={entry.path === strategyPath} title="New experiments created on this page go under this strategy" onClick={() => onUseStrategy(entry)}>{entry.path === strategyPath ? "In use" : "Use"}</button>}
      {entry.type === "experiment" && usable(entry) && <button type="button" disabled={entry.path === experimentPath} title="Use for this report's analysis and report" onClick={() => onUseExperiment(entry)}>{entry.path === experimentPath ? "In use" : "Use"}</button>}
      <button type="button" className="trl-link-button" onClick={() => void rename(entry)}>Rename…</button>
    </span>
  </div>;
  const experimentBlock = (node: ExperimentNode, depth: number): React.ReactElement => <li key={node.entry.path}>
    {row(node.entry, depth)}
    {node.reports.filter((report) => match(report) || match(node.entry)).length > 0 && <ul>{node.reports.filter((report) => match(report) || match(node.entry)).map((report) => <li key={report.path}>{row(report, depth + 1)}</li>)}</ul>}
  </li>;

  const strategies = tree.strategies.filter((node) => match(node.entry) || node.experiments.some(experimentVisible));
  const unlinkedExperiments = tree.unlinkedExperiments.filter(experimentVisible);
  const unlinkedReports = tree.unlinkedReports.filter(match);
  const empty = notes.entries.length === 0;

  return <section className="trl-page__surface trl-notes" aria-label="Your research notes">
    <h4>Your research notes</h4>
    <p className="trl-m0__note">{plural(counts.strategy, "strategy", "strategies")} · {plural(counts.experiment, "experiment", "experiments")} · {plural(counts.report, "report", "reports")}. Only notes TRL created (with TRL frontmatter) are listed. Click a name to open it.</p>
    {!empty && <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>Search by name</span><input type="search" value={query} placeholder="e.g. DCA" onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <label className="trl-m0__field"><span>Type</span><select value={type} onChange={(event) => setType(event.currentTarget.value as NoteType | "all")}><option value="all">All</option><option value="strategy">Strategies</option><option value="experiment">Experiments</option><option value="report">Reports</option></select></label>
      <label className="trl-m0__field"><span>Experiment kind</span><select value={kind} onChange={(event) => setKind(event.currentTarget.value as ExperimentKind | "all")}><option value="all">All kinds</option>{EXPERIMENT_KINDS.map((item) => <option key={item} value={item}>{KIND_LABEL[item]}</option>)}</select></label>
    </div>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
    {empty && <p className="trl-m0__note">No research notes yet. Create a strategy below, or create an experiment directly from a record panel (Symbol scan, Parameters, Analysis → windows).</p>}
    {!empty && strategies.length + unlinkedExperiments.length + unlinkedReports.length === 0 && <p className="trl-m0__note">Nothing matches the search or filters.</p>}
    <ul className="trl-notes__tree">
      {strategies.map((node) => <li key={node.entry.path}>
        {row(node.entry, 0)}
        {node.experiments.filter((item) => experimentVisible(item) || match(node.entry)).length > 0 && <ul>{node.experiments.filter((item) => experimentVisible(item) || match(node.entry)).map((item) => experimentBlock(item, 1))}</ul>}
      </li>)}
      {(unlinkedExperiments.length > 0 || unlinkedReports.length > 0) && <li>
        <div className="trl-notes__group">Not linked to a strategy or experiment</div>
        <ul>{unlinkedExperiments.map((item) => experimentBlock(item, 1))}{unlinkedReports.map((entry) => <li key={entry.path}>{row(entry, 1)}</li>)}</ul>
      </li>}
    </ul>
  </section>;
}
