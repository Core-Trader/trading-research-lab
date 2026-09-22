import React from "react";

export function CollapsibleSection({ id, title, defaultOpen = false, children }: { id?: string; title: string; defaultOpen?: boolean; children: React.ReactNode }): React.ReactElement {
  return <details id={id} className="trl-m0__diagnostics trl-m0__collapsible" open={defaultOpen}>
    <summary>{title}</summary>
    <div className="trl-m0__collapsible-content">{children}</div>
  </details>;
}
