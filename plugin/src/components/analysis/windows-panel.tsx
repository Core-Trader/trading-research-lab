import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import type { DatasetEvidence, WindowsRequest, WindowsResult } from "../../types";
import { AuditTrail } from "../audit-trail";
import { ChartFrame } from "../chart-frame";
import { slotIndex } from "../chart-geometry";
import { CollapsibleSection } from "../collapsible-section";
import { DismissButton } from "../dismiss-button";
import { money, num, pct } from "../display-format";
import { GuidanceBlock, KpiTile } from "../guidance";
import { thresholdValue, windowBars, windowsGuidance } from "./windows-model";

type Props = {
  service: ResearchService;
  datasetRef: string;
  experiment: { id: string; path: string } | null;
  onRecord: (markdown: string, recordId: string) => Promise<void>;
};

const MONTH_OPTIONS = [1, 2, 3, 4, 6, 12];
const MAX_SEPARATE = 12;
const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);

/**
 * Same settings over time (W1–W6): the current report split into windows, or
 * separate window reports from the library. Values and flags are Core results.
 */
export function WindowsPanel({ service, datasetRef, experiment, onRecord }: Props): React.ReactElement {
  const [mode, setMode] = useState<"SPLIT" | "SEPARATE">("SPLIT");
  const [months, setMonths] = useState(6);
  const [start, setStart] = useState("");
  const [library, setLibrary] = useState<DatasetEvidence[]>([]);
  const [picked, setPicked] = useState<string[]>([datasetRef]);
  const [minTrades, setMinTrades] = useState("");
  const [maxLosing, setMaxLosing] = useState("");
  const [result, setResult] = useState<WindowsResult | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<string | null>(null);
  const runs = useRef(new LatestRun()).current;

  useEffect(() => { setPicked([datasetRef]); setResult(null); }, [datasetRef]);
  useEffect(() => { if (mode === "SEPARATE" && library.length === 0) service.listRegistry().then((registry) => setLibrary(registry.entries)).catch((caught) => setError(fail(caught))); }, [mode, library.length, service]);

  const minValue = thresholdValue(minTrades);
  const losingValue = thresholdValue(maxLosing);
  const request: WindowsRequest = mode === "SPLIT" ? { mode, dataset_ref: datasetRef, months, ...(start.trim() ? { start: start.trim() } : {}) } : { mode, dataset_refs: picked };
  const ready = minValue !== undefined && losingValue !== undefined && (mode === "SPLIT" || picked.length >= 2);

  const run = async (): Promise<void> => {
    if (!ready) return;
    const token = runs.begin();
    setBusy("Comparing the windows…");
    setError(null);
    setRecorded(null);
    try {
      const computed = await service.compareWindows(request, minValue ?? null, losingValue ?? null);
      if (runs.isCurrent(token)) setResult(computed);
    } catch (caught) {
      if (runs.isCurrent(token)) { setResult(null); setError(fail(caught)); }
    } finally {
      if (runs.isCurrent(token)) setBusy(null);
    }
  };
  const record = async (): Promise<void> => {
    setBusy("Recording…");
    try {
      const rendered = await service.renderWindowsNote(request, minValue ?? null, losingValue ?? null, reason);
      await onRecord(rendered.markdown, rendered.record_id);
      setRecorded(`Recorded in ${experiment?.path}.`);
    } catch (caught) { setError(fail(caught)); } finally { setBusy(null); }
  };

  const bars = useMemo(() => result ? windowBars(result.windows) : [], [result]);
  const ccy = result?.currency ?? "";
  const shown = active === null || !result ? null : result.windows[active] ?? null;
  const hasEquity = result?.windows.some((window) => window.equity_maximum_drawdown !== null) ?? false;

  return <CollapsibleSection title="Same settings over time (windows)">
    <p className="trl-m0__note">Does the result hold in each period, or does one good stretch carry the total? Split this report into windows, or compare separate window reports of the same settings.</p>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>Windows from</span><select value={mode} onChange={(event) => { setMode(event.currentTarget.value as "SPLIT" | "SEPARATE"); setResult(null); }}>
        <option value="SPLIT">this report, split by time</option>
        <option value="SEPARATE">separate window reports</option>
      </select></label>
      {mode === "SPLIT" && <label className="trl-m0__field"><span>Window length</span><select value={months} onChange={(event) => { setMonths(Number(event.currentTarget.value)); setResult(null); }}>{MONTH_OPTIONS.map((value) => <option key={value} value={value}>{value} month{value === 1 ? "" : "s"}</option>)}</select></label>}
      {mode === "SPLIT" && <label className="trl-m0__field"><span>First window starts (optional)</span><input type="date" value={start} onChange={(event) => { setStart(event.currentTarget.value); setResult(null); }} /></label>}
      <label className="trl-m0__field"><span>Minimum trades per window (your threshold, optional)</span><input inputMode="numeric" value={minTrades} placeholder="none" onChange={(event) => setMinTrades(event.currentTarget.value)} /></label>
      <label className="trl-m0__field"><span>Losing windows you accept (optional)</span><input inputMode="numeric" value={maxLosing} placeholder="none" onChange={(event) => setMaxLosing(event.currentTarget.value)} /></label>
    </div>
    {(minValue === undefined || losingValue === undefined) && <p className="trl-m0__note">Thresholds must be whole numbers (or left empty).</p>}
    {mode === "SEPARATE" && <div className="trl-windows__pick">
      <p className="trl-m0__note">Tick 2 to {MAX_SEPARATE} reports of the same EA, symbol, timeframe, deposit and inputs, one per period ({picked.length} ticked). TRL checks they match and do not overlap.</p>
      <ul>{library.map((entry) => <li key={entry.dataset_ref}><label>
        <input type="checkbox" checked={picked.includes(entry.dataset_ref)} disabled={!picked.includes(entry.dataset_ref) && picked.length >= MAX_SEPARATE} onChange={() => { setPicked((current) => current.includes(entry.dataset_ref) ? current.filter((item) => item !== entry.dataset_ref) : [...current, entry.dataset_ref]); setResult(null); }} />
        {" "}{entry.original_filename} · {entry.supplied_facts.symbol ?? "?"} · {entry.supplied_facts.period ?? ""}{entry.dataset_ref === datasetRef ? " (current report)" : ""}
      </label></li>)}</ul>
    </div>}
    <div className="trl-m0__actions">
      <button type="button" className="mod-cta" disabled={!ready || busy !== null} onClick={() => void run()}>Compare windows</button>
      {busy && <span className="trl-m0__note" role="status">{busy}</span>}
    </div>
    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}

    {result && <>
      <div className="trl-kpi-row">
        <KpiTile label="Profitable windows" value={`${result.summary.profitable} of ${result.summary.windows}`} detail={result.summary.within_losing_allowance === null ? `${result.summary.losing} losing` : result.summary.within_losing_allowance ? `${result.summary.losing} losing: within your limit` : `${result.summary.losing} losing: more than you accept`} tone={result.summary.within_losing_allowance === false ? "negative" : result.summary.losing === 0 ? "positive" : "neutral"} />
        <KpiTile label="Worst window" value={`${money(result.summary.worst.net_pnl)} ${ccy}`} detail={result.summary.worst.label} tone={Number(result.summary.worst.net_pnl) < 0 ? "negative" : "neutral"} exact={result.summary.worst.net_pnl} />
        <KpiTile label="Net per window" value={`${money(result.summary.net_pnl_spread.median)} ${ccy}`} detail={`median; ${money(result.summary.net_pnl_spread.minimum)} to ${money(result.summary.net_pnl_spread.maximum)}`} />
        <KpiTile label="Windows" value={String(result.summary.windows)} detail={result.summary.below_min_trades.length ? `${result.summary.below_min_trades.length} below your minimum trades` : result.configuration.mode === "SPLIT" ? `${result.configuration.months}-month windows` : "separate reports"} />
      </div>
      <ChartFrame title="Net result per window">
        <figure className="trl-windows-chart">
          <div className="trl-windows-chart__plot" role="img" aria-label={`Net result for each of ${result.windows.length} windows; bars above the line made money, below it lost.`}
            onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(slotIndex((event.clientX - bounds.left) / bounds.width, result.windows.length)); }}
            onPointerLeave={() => setActive(null)}>
            <span className="trl-windows-chart__zero" />
            {bars.map((bar, index) => <span key={bar.index} className="trl-windows-chart__slot"><span className={`trl-windows-chart__bar${bar.negative ? " is-negative" : ""}${index === active ? " is-active" : ""}${result.windows[index]?.partial ? " is-partial" : ""}`} style={{ height: `${bar.height / 2}%` }} /></span>)}
            {shown && <span className={`trl-balance-chart__tooltip${(active ?? 0) / result.windows.length > 0.6 ? " is-left" : ""}`} style={{ left: `${(((active ?? 0) + 0.5) / result.windows.length) * 100}%` }} role="status">
              <strong>{shown.label}{shown.partial ? " (partial)" : ""}</strong>
              <span>Net {money(shown.net_pnl)} {ccy} · {shown.trades} trades</span>
              <span>Max drawdown {money(shown.maximum_drawdown)} {ccy}</span>
            </span>}
          </div>
          <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{result.windows[0]?.start}</span><span>{result.windows.at(-1)?.end}</span></div>
          <figcaption className="trl-m0__note">One bar per window, scaled to the largest result. Faded bars are partial windows. Hover a bar for its figures.</figcaption>
        </figure>
      </ChartFrame>
      <div className="trl-monthly"><table>
        <thead><tr><th scope="col">Window</th><th scope="col">Trades</th><th scope="col">Net ({ccy})</th><th scope="col">Profit factor</th><th scope="col">Win rate</th><th scope="col">Max drawdown</th>{hasEquity && <th scope="col">Equity drawdown</th>}<th scope="col">SQN</th><th scope="col">Notes</th></tr></thead>
        <tbody>{result.windows.map((window) => <tr key={window.index} className={window.losing ? "is-losing" : undefined}>
          <th scope="row">{window.label}{window.source.filename ? <><br /><span className="trl-m0__note">{window.source.filename}</span></> : null}</th>
          <td>{window.trades}</td>
          <td className={Number(window.net_pnl) < 0 ? "is-negative" : Number(window.net_pnl) > 0 ? "is-positive" : undefined} title={window.net_pnl}>{money(window.net_pnl)}</td>
          <td>{window.profit_factor === null ? (window.profit_factor_reason === "NO_LOSSES" ? "no losses" : "—") : num(window.profit_factor)}</td>
          <td>{window.win_rate_percent === null ? "—" : pct(window.win_rate_percent)}</td>
          <td title={window.maximum_drawdown_percent ? `${num(window.maximum_drawdown_percent)}% of the peak` : undefined}>{money(window.maximum_drawdown)}</td>
          {hasEquity && <td>{window.equity_maximum_drawdown === null ? "—" : money(window.equity_maximum_drawdown)}</td>}
          <td>{window.sqn === null ? "—" : num(window.sqn)}</td>
          <td>{[window.partial ? "partial" : "", window.below_min_trades ? "few trades" : ""].filter(Boolean).join(", ")}</td>
        </tr>)}</tbody>
      </table></div>
      <GuidanceBlock guidance={windowsGuidance(result)} defaultOpen={false} />
      <div className="trl-windows__record">
        <strong>Record this check</strong>
        {experiment ? <p className="trl-m0__note">Written into a marked block of <strong>{experiment.path}</strong>.</p> : <p className="trl-m0__note">Select or create an Experiment under Research notes to record this check.</p>}
        <label className="trl-m0__field"><span>Your conclusion (recorded verbatim)</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. holds in 3 of 4 windows; the losing one was the summer range" /></label>
        <div className="trl-m0__actions"><button type="button" disabled={!experiment || busy !== null} onClick={() => void record()}>Record in experiment note</button></div>
        {recorded && <p className="trl-exploration__notice" role="status">{recorded}<DismissButton onDismiss={() => setRecorded(null)} /></p>}
      </div>
      <AuditTrail items={[["Calculation", <code>{result.calculation_version}</code>], ["Evaluation", <code>{result.evaluation_id}</code>], ["Mode", result.configuration.mode === "SPLIT" ? `split, ${result.configuration.months} months from ${result.configuration.start}` : `${result.windows.length} separate reports`], ["Findings", result.findings.map((item) => item.code).join(", ") || "none"]]} />
    </>}
  </CollapsibleSection>;
}
