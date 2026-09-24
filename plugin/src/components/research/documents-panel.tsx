import React from "react";
import { CollapsibleSection } from "../collapsible-section";

export function M4Documents({ hasAnalysis, strategy, experiment, report, documentStatus, onCreateStrategy, onSelectStrategy, onCreateExperiment, onSelectExperiment, onCreateOrRegenerateReport, onSelectReport }: {
  hasAnalysis: boolean;
  strategy: { id: string; path: string } | null;
  experiment: { id: string; path: string } | null;
  report: { id: string; path: string } | null;
  documentStatus: string | null;
  onCreateStrategy: () => void;
  onSelectStrategy: () => void;
  onCreateExperiment: () => void;
  onSelectExperiment: () => void;
  onCreateOrRegenerateReport: () => void;
  onSelectReport: () => void;
}): React.ReactElement {
  return <CollapsibleSection id="trl-documents" title="Experiments and research documents">
    <p className="trl-m0__note">Documents are created only when you press a button. Pick existing ones in <strong>Your research notes</strong> above, or open a note and use the matching current-note button. TRL lists only notes it created (with TRL frontmatter) and never reads or alters other notes.</p>
    {!hasAnalysis && <p className="trl-m0__note">You can create or select a strategy now. Load an MT5 report and run its analysis before creating or selecting an experiment or report.</p>}
    <div className="trl-m0__actions">
      <button type="button" onClick={onCreateStrategy}>Create strategy</button>
      <button type="button" onClick={onSelectStrategy}>Use current note as strategy</button>
      <button type="button" disabled={strategy === null || !hasAnalysis} onClick={onCreateExperiment}>Create experiment</button>
      <button type="button" disabled={!hasAnalysis} onClick={onSelectExperiment}>Use current note as experiment</button>
      <button type="button" disabled={experiment === null || !hasAnalysis} onClick={onCreateOrRegenerateReport}>{report === null ? "Create report" : "Check and regenerate report"}</button>
      <button type="button" disabled={experiment === null || !hasAnalysis} onClick={onSelectReport}>Use current note as report</button>
    </div>
    <dl className="trl-m0__diagnostic-grid">
      <dt>Strategy</dt><dd>{strategy ? <><code>{strategy.id}</code> — {strategy.path}</> : "Create or select a strategy."}</dd>
      <dt>Experiment</dt><dd>{experiment ? <><code>{experiment.id}</code> — {experiment.path}</> : hasAnalysis ? "Create or select an experiment after choosing a strategy." : "Load and analyse an MT5 report first."}</dd>
      <dt>Report</dt><dd>{report ? <><code>{report.id}</code> — {report.path}</> : hasAnalysis ? "Create or select a report after choosing an experiment." : "Load and analyse an MT5 report first."}</dd>
      {documentStatus && <><dt>Document status</dt><dd>{documentStatus}</dd></>}
    </dl>
  </CollapsibleSection>;
}
