import React from "react";
import type { Guidance } from "./advanced/monte-carlo-model";

/** "How to read this · tips" block. The text is built from Core results by the model modules. */
export function GuidanceBlock({ guidance, defaultOpen = true }: { guidance: Guidance; defaultOpen?: boolean }): React.ReactElement {
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
