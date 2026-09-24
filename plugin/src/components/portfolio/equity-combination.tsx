import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import type { DatasetEvidence, EquityCombination, EquityCombinationMissing } from "../../types";
import type { NotesApi } from "../../vault/notes-api";
import type { RecordRequirement } from "../../vault/research-notes-model";
import { AuditTrail } from "../audit-trail";
import { ChartFrame } from "../chart-frame";
import { DismissButton } from "../dismiss-button";
import { money } from "../display-format";
import { Interpretation, KpiTile } from "../guidance";
import { plainSentence } from "../plain-language";
import { RecordTo } from "../research/record-to";
import { equityCombinationGuidance, reportsWithoutLog } from "./equity-combination-model";

type Props = {
  service: ResearchService;
  tracks: string[][];
  labels: string[];
  capital: string;
  window: "UNION" | "COMMON";
  byRef: Map<string, DatasetEvidence>;
  notes?: NotesApi;
};

const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);
const r2 = (value: string): string => Number(value).toFixed(2);
const REQUIREMENT: RecordRequirement = { kinds: ["general"] };

/** Combined equity with floating losses (PROPOSAL_EQUITY_PORTFOLIO.md E1–E7). Every number is a Core result. */
export function EquityCombinationSection({ service, tracks, labels, capital, window, byRef, notes }: Props): React.ReactElement {
  const [stopOut, setStopOut] = useState("");
  const [result, setResult] = useState<EquityCombination | EquityCombinationMissing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [recorded, setRecorded] = useState<string | null>(null);
  const runs = useRef(new LatestRun()).current;
  const key = JSON.stringify([tracks, capital, window]);
  useEffect(() => { setResult(null); setError(null); }, [key]);
  const without = useMemo(() => reportsWithoutLog(tracks, byRef), [tracks, byRef]);
  const stopOutValid = stopOut.trim() === "" || /^\d+(\.\d+)?$/.test(stopOut.trim());

  const run = async (): Promise<void> => {
    const token = runs.begin();
    setBusy(true);
    setError(null);
    try {
      const next = await service.portfolioCombineEquity(tracks, capital, window, stopOut.trim() || null);
      if (runs.isCurrent(token)) setResult(next);
    } catch (caught) { if (runs.isCurrent(token)) setError(fail(caught)); } finally { if (runs.isCurrent(token)) setBusy(false); }
  };
  const record = async (): Promise<void> => {
    if (!target || !notes) return;
    setBusy(true);
    try {
      const rendered = await service.renderEquityCombinationNote(tracks, capital, window, stopOut.trim() || null, labels, reason);
      await notes.record(target, rendered.markdown, rendered.record_id);
      setRecorded(`Recorded in ${target}.`);
    } catch (caught) { setError(fail(caught)); } finally { setBusy(false); }
  };

  const combined = result?.status === "COMBINED" ? result : null;
  const ccy = combined?.currency ?? "";
  const guidance = combined ? equityCombinationGuidance(combined, labels) : null;
  return <section className="trl-page__surface trl-equity-combo" aria-label="Combined equity">
    <h4>Combined equity (floating losses included)</h4>
    <p className="trl-m0__note">Adds up the TRL equity logs of these tracks, so floating losses inside open trades count. Lows inside one interval happened at unknown moments, so the drawdown is a range.</p>
    {without.length > 0
      ? <div className="trl-batch__findings" role="note"><strong>These reports have no equity log yet:</strong> {without.map((ref) => byRef.get(ref)?.original_filename ?? ref).join(", ")}. Attach one on <strong>Data &amp; import → Companion files</strong> for each, then combine again. TRL does not mix equity with balance-only tracks.</div>
      : <>
        <div className="trl-m0__scenario-fields">
          <label className="trl-m0__field"><span>Your broker's stop-out level in % (optional)</span><input inputMode="decimal" value={stopOut} placeholder="none" aria-invalid={!stopOutValid} onChange={(event) => setStopOut(event.currentTarget.value)} /></label>
        </div>
        <button type="button" disabled={busy || !stopOutValid} onClick={() => void run()}>{busy ? "Combining equity logs…" : "Combine equity logs"}</button>
      </>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
    {result?.status === "MISSING_LOGS" && <p className="trl-m0__inline-error" role="alert">No equity log for: {result.missing.map((item) => item.filename).join(", ")}.</p>}
    {combined && <>
      <div className="trl-kpi-row">
        <KpiTile label="Combined equity drawdown" value={`${r2(combined.equity_drawdown.observed)} to ${r2(combined.equity_drawdown.conservative)}`} tone="negative" exact={`observed ${combined.equity_drawdown.observed}; conservative ${combined.equity_drawdown.conservative}`} detail={`${ccy} · observed to conservative`} />
        <KpiTile label="Realised drawdown" value={`${r2(combined.realised_drawdown)} ${ccy}`} exact={combined.realised_drawdown} detail="closed trades only" />
        <KpiTile label="Sum of tracks' own" value={`${r2(combined.diversification.sum_of_tracks)} ${ccy}`} exact={combined.diversification.sum_of_tracks} detail={`worst single ${r2(combined.diversification.worst_track)} ${ccy}`} />
        {combined.worst_day && <KpiTile label="Worst day" value={combined.worst_day.loss_observed === combined.worst_day.loss_conservative ? r2(combined.worst_day.loss_observed) : `${r2(combined.worst_day.loss_observed)} to ${r2(combined.worst_day.loss_conservative)}`} exact={`${combined.worst_day.loss_observed} to ${combined.worst_day.loss_conservative}`} detail={`${ccy} · ${combined.worst_day.date}`} />}
        <KpiTile label="Lowest margin level" value={combined.margin.lowest_level_percent === null ? "—" : `${r2(combined.margin.lowest_level_percent)} %`} tone={combined.margin.intervals_below_stop_out ? "warning" : "neutral"} exact={combined.margin.lowest_level_percent} detail={combined.margin.intervals_below_stop_out === null ? "set a stop-out level to check" : `${combined.margin.intervals_below_stop_out} interval(s) below your stop-out`} />
      </div>
      <EquityBandChart result={combined} />
      {guidance && <Interpretation sections={[{ heading: null, points: guidance.read }, { heading: "Tips from your results", points: guidance.tips }, { heading: "Keep in mind", points: guidance.flags }]} />}
      <details className="trl-audit"><summary>Each track's own equity drawdown</summary>
        <table className="trl-m0__table"><thead><tr><th scope="col">Track</th><th scope="col">Observed ({ccy})</th><th scope="col">Conservative ({ccy})</th></tr></thead>
          <tbody>{combined.tracks.map((track) => <tr key={track.track_id}><th scope="row">{labels[track.track - 1] ?? `Track ${track.track}`}</th><td>{money(track.equity_drawdown.observed)}</td><td>{money(track.equity_drawdown.conservative)}</td></tr>)}</tbody></table>
      </details>
      {notes && <div className="trl-windows__record">
        <strong>Record this check</strong>
        <RecordTo notes={notes} requirement={REQUIREMENT} createKind="general" value={target} onChange={setTarget} />
        <label className="trl-m0__field"><span>Your conclusion (recorded verbatim)</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. combined floating drawdown stays inside my limit" /></label>
        <div className="trl-m0__actions"><button type="button" disabled={!target || busy} onClick={() => void record()}>Record in experiment note</button></div>
        {recorded && <p className="trl-exploration__notice" role="status">{recorded}<DismissButton onDismiss={() => setRecorded(null)} /></p>}
      </div>}
      <AuditTrail items={[
        ["Calculation", <code>{combined.calculation_version}</code>],
        ["Grid", `${combined.grid_minutes} minutes; ${combined.window_start.slice(0, 10)} to ${combined.window_end.slice(0, 10)} (${combined.configuration.window === "UNION" ? "any track active" : "all tracks active"})`],
        ["Sizing", "as reported; each track's equity change from its own deposit"],
        ["Notes", plainSentence(combined.warnings.join(" "))],
      ]} />
    </>}
  </section>;
}

function EquityBandChart({ result }: { result: EquityCombination }): React.ReactElement | null {
  const points = result.chart;
  if (points.length < 2) return null;
  const values = points.flatMap((point) => [Number(point.close), Number(point.balance), Number(point.low_conservative)]);
  const low = Math.min(...values), high = Math.max(...values);
  const span = high - low || 1;
  const x = (index: number): number => (index / (points.length - 1)) * 100;
  const y = (value: string): number => 100 - ((Number(value) - low) / span) * 100;
  const line = (key: "close" | "balance" | "low_conservative" | "low_observed"): string => points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(3)},${y(point[key]).toFixed(3)}`).join(" ");
  const band = `${line("close")} ${points.map((_, index) => points.length - 1 - index).map((index) => `L${x(index).toFixed(3)},${y(points[index]!.low_conservative).toFixed(3)}`).join(" ")} Z`;
  return <ChartFrame title="Combined equity, with the conservative low">
    <figure className="trl-equity-combo__chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Combined equity from ${result.window_start.slice(0, 10)} to ${result.window_end.slice(0, 10)}, between ${money(String(low))} and ${money(String(high))} ${result.currency}`}>
        <path d={band} className="trl-equity-combo__band" />
        <path d={line("balance")} className="trl-equity-combo__balance" vectorEffect="non-scaling-stroke" />
        <path d={line("close")} className="trl-equity-combo__close" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="trl-m0__histogram-axis"><span>{result.window_start.slice(0, 10)}</span><span>{money(String(low))} – {money(String(high))} {result.currency}</span><span>{result.window_end.slice(0, 10)}</span></div>
      <figcaption className="trl-m0__note"><span className="trl-equity-combo__key is-close" /> combined equity (interval close) · <span className="trl-equity-combo__key is-balance" /> combined balance · shaded: down to the conservative low.</figcaption>
    </figure>
  </ChartFrame>;
}
