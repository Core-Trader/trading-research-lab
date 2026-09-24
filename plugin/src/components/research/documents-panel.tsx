import React from "react";

type Selected = { id: string; path: string } | null;

const nameOf = (path: string): string => path.split("/").pop()?.replace(/\.md$/i, "") ?? path;

/**
 * The working set for report analysis (M4): which Strategy, Experiment and
 * Report the loaded report's analysis and report use. One aligned row each,
 * with that row's own actions. Documents are created only on a button press.
 */
export function M4Documents({ hasAnalysis, strategy, experiment, report, documentStatus, onOpen, onCreateStrategy, onSelectStrategy, onCreateExperiment, onSelectExperiment, onCreateOrRegenerateReport, onSelectReport }: {
  hasAnalysis: boolean;
  strategy: Selected;
  experiment: Selected;
  report: Selected;
  documentStatus: string | null;
  onOpen?: (path: string) => void;
  onCreateStrategy: () => void;
  onSelectStrategy: () => void;
  onCreateExperiment: () => void;
  onSelectExperiment: () => void;
  onCreateOrRegenerateReport: () => void;
  onSelectReport: () => void;
}): React.ReactElement {
  const current = (selected: Selected, empty: string): React.ReactElement => selected
    ? <span className="trl-workset__value">{onOpen && selected.path.endsWith(".md") ? <button type="button" className="trl-link-button" title={`${selected.path} · id ${selected.id}`} onClick={() => onOpen(selected.path)}>{nameOf(selected.path)}</button> : <span title={`id ${selected.id}`}>{nameOf(selected.path)}</span>}</span>
    : <span className="trl-workset__value is-empty">{empty}</span>;
  return <section className="trl-page__surface trl-workset" aria-label="Working set for the loaded report">
    <h4>Working set for the loaded report</h4>
    <p className="trl-m0__note">The Strategy, Experiment and Report that this report's analysis and generated report use. Pick them in <strong>Your research notes</strong> (Use), create them here, or open a note and use "Current note".</p>
    <div className="trl-workset__grid">
      <span className="trl-workset__label">Strategy</span>
      {current(strategy, "None selected")}
      <span className="trl-workset__actions">
        <button type="button" onClick={onCreateStrategy}>Create…</button>
        <button type="button" onClick={onSelectStrategy} title="Use the note open in the editor">Current note</button>
      </span>

      <span className="trl-workset__label">Experiment</span>
      {current(experiment, hasAnalysis ? (strategy ? "None selected" : "Choose a strategy first") : "Analyse a report first")}
      <span className="trl-workset__actions">
        <button type="button" disabled={strategy === null || !hasAnalysis} onClick={onCreateExperiment}>Create…</button>
        <button type="button" disabled={!hasAnalysis} onClick={onSelectExperiment} title="Use the note open in the editor">Current note</button>
      </span>

      <span className="trl-workset__label">Report</span>
      {current(report, hasAnalysis ? (experiment ? "None yet" : "Choose an experiment first") : "Analyse a report first")}
      <span className="trl-workset__actions">
        <button type="button" disabled={experiment === null || !hasAnalysis} onClick={onCreateOrRegenerateReport}>{report === null ? "Create…" : "Check and regenerate"}</button>
        <button type="button" disabled={experiment === null || !hasAnalysis} onClick={onSelectReport} title="Use the note open in the editor">Current note</button>
      </span>
    </div>
    {documentStatus && <p className="trl-m0__note" role="status">{documentStatus}</p>}
  </section>;
}
