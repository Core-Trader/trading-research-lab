import React from "react";
import type { Guidance } from "./advanced/monte-carlo-model";
import type { WorkflowPoint } from "./help/research-workflow";
import { SourcedList } from "./sourced-points";
import { useThresholds } from "./thresholds-context";

/*
 * Interpretation and tips (GUIDE-1). Every "How to read this" block in TRL
 * renders through GuidanceBlock or Interpretation below, and one setting
 * (showGuidance) hides them all. The wording lives only in the *-model.ts
 * guidance functions, so removing guidance means deleting these two components
 * and those functions; no calculation depends on them.
 */

/** "How to read this · tips" block. The text is built from Core results by the model modules. */
export function GuidanceBlock({ guidance, defaultOpen = true }: { guidance: Guidance; defaultOpen?: boolean }): React.ReactElement | null {
  const [preferences] = useThresholds();
  if (!preferences.showGuidance) return null;
  return <details className="trl-guidance" open={defaultOpen}>
    <summary>How to read this · tips</summary>
    <div className="trl-guidance__body">
      <ul className="trl-guidance__read">{guidance.read.map((line) => <li key={line}>{line}</li>)}</ul>
      {guidance.tips.length > 0 && <>
        <strong className="trl-guidance__heading">Tips from your results</strong>
        <ol className="trl-guidance__tips">{guidance.tips.map((tip) => <li key={tip}>{tip}</li>)}</ol>
      </>}
      {guidance.flags.map((flag) => <p key={flag} className="trl-guidance__flag">{flag}</p>)}
    </div>
  </details>;
}

/** Compact result tile: headline value with its exact Core value on hover. */
export function KpiTile({ label, value, detail, tone = "neutral", exact }: { label: string; value: string; detail?: string; tone?: "positive" | "negative" | "neutral" | "warning"; exact?: string | null }): React.ReactElement {
  return <div className={`trl-kpi trl-kpi--${tone}`} title={exact ? `Exact value: ${exact}` : undefined}>
    <span className="trl-kpi__label">{label}</span><strong className="trl-kpi__value">{value}</strong>{detail && <span className="trl-kpi__detail">{detail}</span>}
  </div>;
}

export type InterpretationSection = { heading: string | null; points: WorkflowPoint[] };

/** Labelled, sourced reading and tips; hidden everywhere when guidance is off. */
export function Interpretation({ sections, defaultOpen = true }: { sections: InterpretationSection[]; defaultOpen?: boolean }): React.ReactElement | null {
  const [preferences, setPreferences] = useThresholds();
  if (!preferences.showGuidance) return null;
  return <details className="trl-guidance" open={defaultOpen}>
    <summary>How to read this · what to do next</summary>
    <div className="trl-guidance__body">
      {sections.filter((section) => section.points.length > 0).map((section, index) => <React.Fragment key={section.heading ?? index}>
        {section.heading && <strong className="trl-guidance__heading">{section.heading}</strong>}
        <SourcedList points={section.points} />
      </React.Fragment>)}
      <p className="trl-m0__note trl-guidance__hide">Labels show where each point comes from. <button type="button" className="trl-link-button" onClick={() => setPreferences({ showGuidance: false })}>Hide interpretation and tips everywhere</button> (turn them back on in TRL settings).</p>
    </div>
  </details>;
}
