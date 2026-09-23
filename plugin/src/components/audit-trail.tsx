import React from "react";

/**
 * Collapsed provenance block (UI/UX pass §2). Hashes, ids, policies and
 * artifacts stay available for audit but out of the day-to-day view.
 */
export function AuditTrail({ items, children }: { items: Array<[string, React.ReactNode]>; children?: React.ReactNode }): React.ReactElement {
  return <details className="trl-audit">
    <summary>Technical details · audit trail</summary>
    <dl className="trl-m0__diagnostic-grid">
      {items.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}
    </dl>
    {children}
  </details>;
}
