import React from "react";
import type { CombinedBalanceResult, CombinedDailyResult, PortfolioPreflightResult } from "../../types";
import { BalanceChart } from "../balance-chart";
import { CollapsibleSection } from "../collapsible-section";
import { formatPercent, formatTimestamp } from "../display-format";
import { batchTimeline } from "./batch-timeline";
import { MT5_REPORT_ACCEPT } from "../../application/report-files";
import { money } from "../display-format";

const NEXT_STEP: Record<string, string> = {
  COVERAGE_OVERLAP: "Remove one of the overlapping reports. Sequential batches continue one account over consecutive, non-overlapping periods.",
  BALANCE_DISCONTINUITY: "Check that these are consecutive runs of the same account: each report must open with the previous report's final balance.",
  POTENTIAL_DUPLICATE_EVENTS: "The same deals appear in both reports. Remove the duplicate export.",
  DUPLICATE_SOURCE: "The same file was added twice. Remove the duplicate.",
  CURRENCY_MISMATCH: "All reports must use the same account currency.",
  ORDER_AMBIGUOUS: "Two reports start at the same time, so their order is unclear. Remove one.",
};

type Props = {
  paths: string[];
  result: PortfolioPreflightResult | null;
  combined: CombinedBalanceResult | null;
  daily: CombinedDailyResult | null;
  busy: string | null;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (path: string) => void;
  onClear: () => void;
  onRun: () => void;
  onCreate: () => void;
  onDaily: () => void;
};

export function M5Preflight({ paths, result, combined, daily, busy, error, inputRef, onSelect, onRemove, onClear, onRun, onCreate, onDaily }: Props): React.ReactElement {
  const working = busy !== null;
  const timeline = result ? batchTimeline(result) : null;
  const blocking = result?.findings.filter((finding) => finding.severity === "BLOCKED") ?? [];
  const warnings = result?.findings.filter((finding) => finding.severity === "WARNING") ?? [];
  const unit = combined?.currency ?? daily?.currency ?? result?.members[0]?.currency ?? "source currency";
  return <CollapsibleSection title="Sequential report batch (one account over consecutive periods)" defaultOpen={paths.length > 0 || result !== null}>
    <div className="trl-batch__scope">
      <p><strong>What this does:</strong> joins consecutive MT5 reports from the <em>same account</em> into one continuous realised-balance history, for example January–April followed by May–September.</p>
      <p><strong>What it does not do:</strong> combine different EAs that traded <em>at the same time</em> into a portfolio (FXOptimize-style). That is a separate proposal awaiting a scope decision; overlapping reports are blocked here.</p>
    </div>
    <input ref={inputRef} className="trl-m0__file-input" type="file" multiple accept={MT5_REPORT_ACCEPT} onChange={onSelect} />
    <div className="trl-m0__actions">
      <button type="button" disabled={working} onClick={() => inputRef.current?.click()}>Add report(s)…</button>
      <button type="button" disabled={working || paths.length === 0} onClick={onClear}>Clear list</button>
      <button type="button" className="mod-cta" disabled={working || paths.length < 2} onClick={onRun}>Check batch</button>
      {paths.length === 1 && <span className="trl-m0__note">Add at least one more report.</span>}
    </div>
    {paths.length > 0 && <ol className="trl-batch__files">{paths.map((path) => <li key={path}><code>{path.split(/[\\/]/).pop()}</code> <span className="trl-m0__note">{path}</span> <button type="button" disabled={working} onClick={() => onRemove(path)}>Remove</button></li>)}</ol>}
    {busy && <p className="trl-dashboard__progress" role="status">{busy}</p>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}

    {result && <section className={`trl-batch__status is-${result.status === "ELIGIBLE" ? "ok" : "blocked"}`} role="status">
      <strong>{result.status === "ELIGIBLE" ? "Eligible: these reports form one consecutive account history." : `Blocked: ${blocking.length} problem${blocking.length === 1 ? "" : "s"} to resolve before combining.`}</strong>
      <span>{result.members.length} reports, each checked and preserved individually. Nothing has been combined yet.</span>
    </section>}

    {timeline && <figure className="trl-batch__timeline">
      {timeline.rows.map((row) => <div key={row.datasetRef} className="trl-batch__lane">
        <span className="trl-batch__lane-label" title={row.filename}>{row.filename}</span>
        <div className="trl-batch__track"><span className={`trl-batch__bar${row.conflict ? " is-conflict" : ""}`} style={{ left: `${row.left}%`, width: `${row.width}%` }} title={`${row.filename}: ${formatTimestamp(row.first)} → ${formatTimestamp(row.last)}`} /></div>
      </div>)}
      <div className="trl-balance-chart__x-axis"><span>{formatTimestamp(timeline.start).slice(0, 10)}</span><span>{formatTimestamp(timeline.end).slice(0, 10)}</span></div>
      <figcaption className="trl-m0__note">Report coverage by source-reported event dates. Red bars are involved in a blocking problem.</figcaption>
    </figure>}

    {blocking.length > 0 && <ul className="trl-batch__findings">{blocking.map((finding, index) => <li key={`${finding.code}-${index}`}>
      <strong>{finding.message}</strong>
      {NEXT_STEP[finding.code] && <span>What to do: {NEXT_STEP[finding.code]}</span>}
    </li>)}</ul>}
    {warnings.length > 0 && <details className="trl-batch__warnings"><summary>{warnings.length} note{warnings.length === 1 ? "" : "s"} (not blocking)</summary><ul>{warnings.map((finding, index) => <li key={`${finding.code}-${index}`}>{finding.message}</li>)}</ul></details>}

    {result?.status === "ELIGIBLE" && !combined && <button type="button" className="mod-cta" disabled={working} onClick={onCreate}>Create combined balance history</button>}
    {combined && <section className="trl-m0__analysis-result">
      <h4>Combined realised balance</h4>
      <div className="trl-kpi-row">
        <div className="trl-kpi"><span className="trl-kpi__label">Opening</span><strong className="trl-kpi__value">{money(combined.opening_balance)} {unit}</strong></div>
        <div className="trl-kpi"><span className="trl-kpi__label">Final</span><strong className="trl-kpi__value">{money(combined.final_reported_balance)} {unit}</strong></div>
        <div className={`trl-kpi trl-kpi--${combined.reported_balance_change.startsWith("-") ? "negative" : "positive"}`}><span className="trl-kpi__label">Change</span><strong className="trl-kpi__value">{money(combined.reported_balance_change)} {unit}</strong><span className="trl-kpi__detail">{combined.row_count} source balance rows</span></div>
        {daily && <div className="trl-kpi trl-kpi--negative" title={daily.worst_day.maximum_drawdown_percent ? `Core value: ${daily.worst_day.maximum_drawdown_percent}%` : undefined}><span className="trl-kpi__label">Worst daily decline</span><strong className="trl-kpi__value">{money(daily.worst_day.maximum_drawdown)} {unit}</strong><span className="trl-kpi__detail">{daily.worst_day.date} · {formatPercent(daily.worst_day.maximum_drawdown_percent) ?? "% unavailable"} of the day's opening balance</span></div>}
      </div>
      <BalanceChart points={combined.balance_points.map((point, index) => ({ source_sequence: index + 1, timestamp: point.timestamp, balance: point.balance }))} currency={combined.currency} />
      {!daily && <button type="button" disabled={working} onClick={onDaily}>Calculate combined daily drawdown</button>}
      {daily && <details className="trl-batch__warnings"><summary>Daily drawdown notes</summary><ul>{daily.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
      <p className="trl-m0__note">Realised balance only; intratrade equity is unavailable. No research document was created. Artifact <code>{combined.artifacts.table}</code>.</p>
    </section>}
  </CollapsibleSection>;
}
