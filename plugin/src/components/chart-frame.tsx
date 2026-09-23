import React, { useEffect, useState } from "react";

/**
 * Shared wrapper for every chart: the same bar and an "Expand" toggle that
 * shows the chart full screen over the TRL view (Esc or Close returns it).
 * Charts size themselves from the frame, so panels stay coherent.
 */
export function ChartFrame({ title, children }: { title?: string; children: React.ReactNode }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);
  return <div className={`trl-chart-frame${expanded ? " is-expanded" : ""}`} role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={expanded ? `${title ?? "Chart"}, full screen` : undefined}>
    <div className="trl-chart-frame__bar">
      {title && <span className="trl-chart-frame__title">{title}</span>}
      <button type="button" className="trl-chart-frame__toggle" aria-pressed={expanded} title={expanded ? "Close full screen (Esc)" : "Show this chart full screen"} onClick={() => setExpanded(!expanded)}>{expanded ? "✕ Close" : "⤢ Expand"}</button>
    </div>
    {children}
  </div>;
}
