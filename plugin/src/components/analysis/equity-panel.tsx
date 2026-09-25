import React, { useEffect, useRef, useState } from "react";
import { plain, plainSentence } from "../plain-language";
import type { ResearchService } from "../../application/research-service";
import { localPathForSelectedFile } from "../../services/local-file-path";
import type { EquityAvailabilityResult, EquityLogAttachment, EquityLogScan, EquityMetrics } from "../../types";
import { CollapsibleSection } from "../collapsible-section";
import { DismissButton } from "../dismiss-button";
import { EquityChart } from "./equity-chart";
import { money } from "../display-format";

const MODES = ["Every tick based on real ticks", "Every tick", "1 minute OHLC", "Open prices only"];

/** Opens a folder in the system file manager (Obsidian desktop runs on Electron). */
async function openFolder(folder: string): Promise<string | null> {
  const electron = (globalThis as { require?: (id: string) => unknown }).require?.("electron") as { shell?: { openPath(path: string): Promise<string> } } | undefined;
  if (!electron?.shell) return "Opening folders is only available in Obsidian desktop.";
  const problem = await electron.shell.openPath(folder);
  return problem || null;
}

/**
 * Attach a TRL tester equity log to a report (PL-006). Used as an optional
 * companion on the Data page and on the Analysis page. The Core refuses a
 * log that does not come from this report's run.
 */
export function EquityAttach({ service, datasetRef, attached, onAttached }: {
  service: ResearchService;
  datasetRef: string;
  attached: boolean;
  onAttached: () => void;
}): React.ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState(MODES[0]!);
  const [attempt, setAttempt] = useState<EquityLogAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<EquityLogScan | null>(null);
  useEffect(() => { setAttempt(null); setError(null); setScan(null); }, [datasetRef]);

  const attachPath = async (path: string): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      if (!path.toLowerCase().endsWith(".csv")) throw new Error("Select the TRL equity log (.csv) written by TRL_EquityLogger.");
      const result = await service.attachEquityLog(datasetRef, path, mode);
      setAttempt(result);
      if (result.status === "LINKED_VERIFIED") { setScan(null); onAttached(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } finally { setBusy(false); }
  };
  const attach = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await attachPath(localPathForSelectedFile(file));
  };
  // The logger names files by EA, symbol, timeframe and start date (repeats get _2, _3), so the
  // right log is found by content: the Core runs the same check as attaching on every candidate.
  const findLogs = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try { setScan(await service.scanEquityLogs(datasetRef)); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } finally { setBusy(false); }
  };
  const openLoggerFolder = async (): Promise<void> => {
    setError(null);
    try {
      const location = await service.equityLoggerFolder();
      if (!location.folder || !location.exists) throw new Error(`The equity logger folder was not found${location.folder ? ` (${location.folder})` : ""}. It is created by the first logged test.`);
      const problem = await openFolder(location.folder);
      if (problem) throw new Error(problem);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  return <div className="trl-companion">
    {attached
      ? <p className="trl-companion__ok">✓ Equity log attached and verified against this report.</p>
      : <>
        <div className="trl-m0__scenario-fields">
          <label className="trl-m0__field"><span>Modelling mode of that test</span><select value={mode} onChange={(event) => setMode(event.currentTarget.value)}>{MODES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <input ref={input} className="trl-m0__file-input" type="file" accept=".csv" onChange={(event) => void attach(event)} />
        <div className="trl-m0__actions">
          <button type="button" className="mod-cta" disabled={busy} onClick={() => void findLogs()}>{busy ? "Checking…" : "Find this report's log"}</button>
          <button type="button" disabled={busy} onClick={() => input.current?.click()}>Browse for the log (.csv)…</button>
          <button type="button" onClick={() => void openLoggerFolder()}>Open logger folder</button>
        </div>
        {scan && <LogScanResult scan={scan} busy={busy} onAttach={(path) => void attachPath(path)} />}
      </>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
    {attempt && attempt.status !== "LINKED_VERIFIED" && <ul className="trl-batch__findings"><li>
      <DismissButton onDismiss={() => setAttempt(null)} />
      <strong className="is-blocked">Equity log not attached</strong>
      {attempt.findings.map((finding) => <span key={finding.code}>{finding.message}</span>)}
    </li></ul>}
    {attempt?.status === "LINKED_VERIFIED" && attempt.findings.length > 0 && <ul className="trl-batch__findings"><li>
      <DismissButton onDismiss={() => setAttempt(null)} />
      <strong className="is-note">Equity log attached, with notes</strong>
      {attempt.findings.map((finding) => <span key={finding.code}>{finding.message}</span>)}
    </li></ul>}
  </div>;
}

/** How to obtain an equity log; shown wherever one can be attached. */
export function EquityHowTo(): React.ReactElement {
  return <p className="trl-m0__note">MT5 reports show closed trades only. To record how deep open positions went, add the TRL equity logger to your EA (three lines; see the help page "Recording equity in MT5 backtests"), run the same single test, and pick the CSV from <code>%APPDATA%\MetaQuotes\Terminal\Common\Files\TRL\</code>.</p>;
}

/**
 * Equity evidence on the Analysis page. Every number is Core output; without
 * a verified log, equity stays unavailable.
 */
export function EquityPanel({ service, datasetRef, availability, metrics, error, currency, onChanged }: {
  service: ResearchService;
  datasetRef: string;
  availability: EquityAvailabilityResult | null;
  /** Loaded once by the workspace (also used by Monte Carlo guidance). */
  metrics: EquityMetrics | null;
  error: string | null;
  currency: string | null;
  onChanged: () => void;
}): React.ReactElement {
  const available = availability?.status === "AVAILABLE";
  const unit = currency ?? "";

  return <CollapsibleSection title="Equity (floating drawdown)" defaultOpen>
    {!available && <>
      <EquityHowTo />
      <EquityAttach service={service} datasetRef={datasetRef} attached={false} onAttached={onChanged} />
    </>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    {metrics && <>
      <dl className="trl-m0__diagnostic-grid">
        <dt>Max equity drawdown</dt><dd><strong>{money(metrics.maximum_equity_drawdown)} {unit}</strong>{metrics.maximum_equity_drawdown_percent !== null ? ` (${Number(metrics.maximum_equity_drawdown_percent).toFixed(2)}% of the prior peak)` : ""}</dd>
        {availability?.status === "AVAILABLE" && <><dt>MT5 reported</dt><dd>{availability.equity.mt5_reported_equity_drawdown ?? "—"} {unit}{availability.equity.findings.includes("EQUITY_DRAWDOWN_DIFFERS") ? " — the log is shallower (see the attach notes)" : availability.equity.findings.includes("LOG_DEEPER_THAN_MT5") ? " — the log found a deeper tick low" : " — agrees with the log"}</dd></>}
        <dt>Realised-balance drawdown</dt><dd>{money(metrics.balance_maximum_drawdown)} {unit}</dd>
        <dt>Worst day (equity)</dt><dd>{metrics.worst_day.date}: −{money(metrics.worst_day.loss)} {unit}{metrics.worst_day.loss_percent_of_initial !== null ? ` (${Number(metrics.worst_day.loss_percent_of_initial).toFixed(2)}% of the initial balance)` : ""}, low at {metrics.worst_day.lowest_at.replace("T", " ")}</dd>
        <dt>Evidence</dt><dd>TRL tester log, {metrics.row_count} rows; modelling {availability?.status === "AVAILABLE" ? availability.equity.modelling_mode : "—"}</dd>
      </dl>
      {metrics.equity_deeper_than_balance && metrics.equity_to_balance_drawdown_ratio !== null && <p className="trl-equity__gap" role="note">Equity drawdown is {Number(metrics.equity_to_balance_drawdown_ratio).toFixed(1)}× the realised-balance drawdown: open positions went deeper than closed trades show.</p>}
      <EquityChart points={metrics.display_series} currency={currency} />
      <ul className="trl-batch__warnings">{metrics.warnings.map((warning) => <li key={warning}>{plainSentence(warning)}</li>)}</ul>
    </>}
  </CollapsibleSection>;
}

/** Candidates from the logger folder, best first; only a log that belongs to this report can be attached. */
function LogScanResult({ scan, busy, onAttach }: { scan: EquityLogScan; busy: boolean; onAttach: (path: string) => void }): React.ReactElement {
  const matches = scan.candidates.filter((item) => item.status === "MATCHES");
  const others = scan.candidates.filter((item) => item.status !== "MATCHES");
  return <div className="trl-log-scan" role="status">
    <p className="trl-m0__note">{scan.matches === 0 ? "No log in the logger folder belongs to this report" : scan.matches === 1 ? "One log belongs to this report" : `${scan.matches} logs belong to this report (newest first)`}: checked {scan.scanned} of {scan.total_csv} file{scan.total_csv === 1 ? "" : "s"} in <code>{scan.folder}</code>.</p>
    {matches.length > 0 && <ul className="trl-log-scan__list">{matches.map((item) => <li key={item.path}>
      <span><strong>{item.name}</strong><br /><span className="trl-m0__note">{item.modified.replace("T", " ")} · {item.rows ?? "—"} rows · interval {item.interval ?? "—"} · logger {item.logger_version ?? "—"}</span></span>
      <button type="button" className="mod-cta" disabled={busy} onClick={() => onAttach(item.path)}>Attach</button>
    </li>)}</ul>}
    {others.length > 0 && <details className="trl-audit"><summary>{others.length} other file{others.length === 1 ? "" : "s"} (not this report's test)</summary>
      <ul className="trl-log-scan__others">{others.map((item) => <li key={item.path}><strong>{item.name}</strong>: {plain(item.status)}{item.reason ? ` — ${plainSentence(item.reason)}` : ""}</li>)}</ul>
    </details>}
    {scan.matches === 0 && <p className="trl-m0__note">Run the test again with the logger attached, or browse for a log saved elsewhere.</p>}
  </div>;
}
