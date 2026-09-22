import React from "react";
import type { CombinedBalanceResult, CombinedDailyResult, PortfolioPreflightResult } from "../../types";
import { BalanceChart } from "../balance-chart";
import { CollapsibleSection } from "../collapsible-section";

export function M5Preflight({ paths, result, combined, daily, inputRef, onSelect, onRemove, onClear, onRun, onCreate, onDaily }: { paths: string[]; result: PortfolioPreflightResult | null; combined: CombinedBalanceResult | null; daily: CombinedDailyResult | null; inputRef: React.RefObject<HTMLInputElement | null>; onSelect: (event: React.ChangeEvent<HTMLInputElement>) => void; onRemove: (path: string) => void; onClear: () => void; onRun: () => void; onCreate: () => void; onDaily: () => void }): React.ReactElement {
  return <CollapsibleSection title="Sequential report batch preflight">
    <p className="trl-m0__note">M5 checks explicitly selected reports from one user-declared account. It creates or reuses each individual verified intake only; it does not create a combined balance artifact or research document. This panel is a preflight result, not a combined report.</p>
    <input ref={inputRef} className="trl-m0__file-input" type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onSelect} />
    <div className="trl-m0__actions"><button type="button" onClick={() => inputRef.current?.click()}>Add report(s)…</button><button type="button" disabled={paths.length === 0} onClick={onClear}>Clear list</button><button type="button" disabled={paths.length < 2} onClick={onRun}>Review selected batch</button></div>
    {paths.length > 0 && <><p className="trl-m0__note">Selected reports ({paths.length}). Add them one at a time or select several in the file picker.</p><ol>{paths.map((path) => <li key={path}><code>{path}</code> <button type="button" onClick={() => onRemove(path)}>Remove</button></li>)}</ol></>}
    {result && <dl className="trl-m0__diagnostic-grid">
      <dt>Preflight status</dt><dd><code>{result.status}</code></dd><dt>Account basis</dt><dd><code>{result.account_declaration}</code></dd><dt>Write boundary</dt><dd><code>{result.writes}</code></dd>
      <dt>Members</dt><dd>{result.members.map((member) => `${member.filename} (${member.first_timestamp} → ${member.last_timestamp}; ${member.opening_balance} → ${member.final_reported_balance} ${member.currency ?? ""})`).join("; ")}</dd>
      <dt>Findings</dt><dd>{result.findings.map((finding) => `${finding.severity}: ${finding.code} — ${finding.message}`).join(" ")}</dd>
    </dl>}
    {result?.status === "ELIGIBLE" && <button type="button" className="mod-cta" onClick={onCreate}>Create combined realised-balance artifact</button>}
    {combined && <section className="trl-m0__analysis-result"><h4>Combined realised-balance result</h4><dl className="trl-m0__diagnostic-grid"><dt>Opening / final</dt><dd><code>{combined.opening_balance} / {combined.final_reported_balance} {combined.currency ?? ""}</code></dd><dt>Reported change</dt><dd><code>{combined.reported_balance_change} {combined.currency ?? ""}</code></dd><dt>Artifact</dt><dd><code>{combined.artifacts.table}</code> ({combined.row_count} source balance rows)</dd><dt>Equity</dt><dd><code>UNAVAILABLE</code> — no intratrade mark-to-market reconstruction.</dd></dl><BalanceChart points={combined.balance_points.map((point, index) => ({ source_sequence: index + 1, timestamp: point.timestamp, balance: point.balance }))} /><p className="trl-m0__note">No research document was created.</p></section>}
    {combined && <button type="button" onClick={onDaily}>Run qualified combined daily drawdown</button>}
    {daily && <p className="trl-m0__note">Worst observed day: <code>{daily.worst_day.date}</code>; drawdown <code>{daily.worst_day.maximum_drawdown} {daily.currency ?? ""}</code>. {daily.warnings.join(" ")}</p>}
  </CollapsibleSection>;
}
