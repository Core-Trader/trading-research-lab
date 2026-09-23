import React from "react";
import { CollapsibleSection } from "../collapsible-section";

export type RunDiagnostics = {
  workerWasReady: boolean;
  workerReadinessMs: number;
  importMs: number;
  analysisMs: number;
  reportPayloadMs: number;
  noteWriteMs: number;
  viewPresentationMs: number;
  totalMs: number;
};

export function Diagnostics({ diagnostics }: { diagnostics: RunDiagnostics }): React.ReactElement {
  return <CollapsibleSection title="Local run diagnostics">
    <p className="trl-m0__note">Local elapsed-time observations only. They are not trading calculations, are not sent anywhere, and are not written into the research report.</p>
    <dl className="trl-m0__diagnostic-grid">
      <dt>Worker readiness</dt><dd>{formatDuration(diagnostics.workerReadinessMs)} ({diagnostics.workerWasReady ? "already running" : "start and handshake"})</dd>
      <dt>MT5 report import</dt><dd>{formatDuration(diagnostics.importMs)}</dd>
      <dt>Verified statistics</dt><dd>{formatDuration(diagnostics.analysisMs)}</dd>
      <dt>Report payload</dt><dd>{formatDuration(diagnostics.reportPayloadMs)}</dd>
      <dt>Note write</dt><dd>{formatDuration(diagnostics.noteWriteMs)}</dd>
      <dt>View presentation</dt><dd>{formatDuration(diagnostics.viewPresentationMs)} (next-frame observation)</dd>
      <dt>Total local run</dt><dd>{formatDuration(diagnostics.totalMs)}</dd>
      <dt>Peak worker memory</dt><dd>Not captured; TRL does not inspect system processes.</dd>
      <dt>Responsiveness</dt><dd>Manual qualitative observation only; short runs may finish before interaction is possible.</dd>
    </dl>
  </CollapsibleSection>;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds.toFixed(1)} ms`;
  return `${(milliseconds / 1_000).toFixed(3)} s`;
}
