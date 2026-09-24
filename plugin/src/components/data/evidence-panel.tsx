import React from "react";
import { plain, plainSentence } from "../plain-language";
import type { DatasetEvidence } from "../../types";
import { CollapsibleSection } from "../collapsible-section";

export type SnapshotVerification = {
  state: "CHECKING" | "VERIFIED";
  message: string;
};

export function Evidence({ evidence, intakeStatus, snapshotVerification, onVerify }: { evidence: DatasetEvidence; intakeStatus: string | null; snapshotVerification: SnapshotVerification | null; onVerify: () => void }): React.ReactElement {
  return <CollapsibleSection title="Technical details · audit trail">
    <p className="trl-m0__note">Provenance of the selected report: how TRL stored it and how to verify it. Not needed day to day.</p>
    <dl className="trl-m0__diagnostic-grid">
      <dt>Dataset</dt><dd><code>{evidence.dataset_ref}</code></dd>
      <dt>Source SHA-256</dt><dd><code>{evidence.source_sha256}</code></dd>
      <dt>Managed snapshot</dt><dd>{plain(evidence.raw_snapshot_status)} — <code>{evidence.raw_snapshot_path}</code></dd>
      {snapshotVerification !== null && <><dt>Snapshot check</dt><dd>{plain(snapshotVerification.state)} — {snapshotVerification.message}</dd></>}
      {intakeStatus !== null && <><dt>Latest intake</dt><dd>{intakeStatus}</dd></>}
      <dt>File reader</dt><dd><code>{evidence.adapter.adapter_id}</code> version {evidence.adapter.adapter_version} · <span title={`TRL code: ${evidence.adapter.intake_mode}`}>{plain(evidence.adapter.intake_mode)}</span></dd>
      <dt>Events / quality</dt><dd>{evidence.event_count} / <span title={`TRL code: ${evidence.source_quality}`}>{plain(evidence.source_quality)}</span></dd>
      <dt>Supplied facts</dt><dd>{evidence.supplied_facts.symbol ?? "Unknown symbol"}; {evidence.supplied_facts.currency ?? "Unknown currency"}; {evidence.supplied_facts.period ?? "Unknown period"}</dd>
      <dt>Observed price scale(s)</dt><dd>{evidence.observed_price_scales.length ? evidence.observed_price_scales.join(", ") : "Not supplied"}</dd>
      <dt>Canonical artifacts</dt><dd><code>{evidence.artifacts.events}</code>; <code>{evidence.artifacts.manifest}</code></dd>
      <dt>Warnings</dt><dd>{evidence.warnings.length ? plainSentence(evidence.warnings.join("; ")) : "None reported."}</dd>
      <dt>Limitations</dt><dd>{evidence.limitations.join("; ")}</dd>
    </dl>
    <button type="button" disabled={snapshotVerification?.state === "CHECKING"} onClick={onVerify}>
      {snapshotVerification?.state === "CHECKING" ? "Checking managed snapshot…" : "Verify managed snapshot"}
    </button>
  </CollapsibleSection>;
}
