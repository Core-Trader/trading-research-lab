import React from "react";
import type { DatasetEvidence } from "../../types";
import { CollapsibleSection } from "../collapsible-section";

export type SnapshotVerification = {
  state: "CHECKING" | "VERIFIED";
  message: string;
};

export function Evidence({ evidence, intakeStatus, snapshotVerification, onVerify }: { evidence: DatasetEvidence; intakeStatus: string | null; snapshotVerification: SnapshotVerification | null; onVerify: () => void }): React.ReactElement {
  return <CollapsibleSection title="Technical source evidence">
    <dl className="trl-m0__diagnostic-grid">
      <dt>Dataset</dt><dd><code>{evidence.dataset_ref}</code></dd>
      <dt>Source SHA-256</dt><dd><code>{evidence.source_sha256}</code></dd>
      <dt>Managed snapshot</dt><dd>{evidence.raw_snapshot_status} — <code>{evidence.raw_snapshot_path}</code></dd>
      {snapshotVerification !== null && <><dt>Snapshot check</dt><dd>{snapshotVerification.state} — {snapshotVerification.message}</dd></>}
      {intakeStatus !== null && <><dt>Latest intake</dt><dd>{intakeStatus}</dd></>}
      <dt>Adapter</dt><dd>{evidence.adapter.adapter_id} v{evidence.adapter.adapter_version} ({evidence.adapter.intake_mode})</dd>
      <dt>Events / quality</dt><dd>{evidence.event_count} / {evidence.source_quality}</dd>
      <dt>Supplied facts</dt><dd>{evidence.supplied_facts.symbol ?? "Unknown symbol"}; {evidence.supplied_facts.currency ?? "Unknown currency"}; {evidence.supplied_facts.period ?? "Unknown period"}</dd>
      <dt>Observed price scale(s)</dt><dd>{evidence.observed_price_scales.length ? evidence.observed_price_scales.join(", ") : "Not supplied"}</dd>
      <dt>Canonical artifacts</dt><dd><code>{evidence.artifacts.events}</code>; <code>{evidence.artifacts.manifest}</code></dd>
      <dt>Warnings</dt><dd>{evidence.warnings.length ? evidence.warnings.join("; ") : "None reported."}</dd>
      <dt>Limitations</dt><dd>{evidence.limitations.join("; ")}</dd>
    </dl>
    <button type="button" disabled={snapshotVerification?.state === "CHECKING"} onClick={onVerify}>
      {snapshotVerification?.state === "CHECKING" ? "Checking managed snapshot…" : "Verify managed snapshot"}
    </button>
  </CollapsibleSection>;
}
