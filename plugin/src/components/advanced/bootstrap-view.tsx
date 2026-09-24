import React, { useMemo, useRef, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import type { BootstrapMethod, BootstrapResult } from "../../types";
import type { NotesApi } from "../../vault/notes-api";
import type { RecordRequirement } from "../../vault/research-notes-model";
import { AuditTrail } from "../audit-trail";
import { ChartFrame } from "../chart-frame";
import { DismissButton } from "../dismiss-button";
import { money } from "../display-format";
import { Interpretation, KpiTile } from "../guidance";
import { plain, plainSentence } from "../plain-language";
import { RecordTo } from "../research/record-to";
import { blockLengthProblem, bootstrapGuidance } from "./bootstrap-model";

type Props = {
  service: ResearchService;
  datasetRef: string;
  method: BootstrapMethod;
  seed: string;
  pathCount: string;
  trades: number | null;
  streaky: boolean;
  enabled: boolean;
  analysis: { datasetId: string; analysisRunId: string } | null;
  notes: NotesApi;
};

const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);
const r2 = (value: string): string => Number(value).toFixed(2);

/** Resample / resample in blocks (PROPOSAL_BOOTSTRAP.md B1–B7). Every number is a Core result. */
export function BootstrapView({ service, datasetRef, method, seed, pathCount, trades, streaky, enabled, analysis, notes }: Props): React.ReactElement {
  const [blockText, setBlockText] = useState("");
  const [limitText, setLimitText] = useState("");
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [recorded, setRecorded] = useState<string | null>(null);
  const runs = useRef(new LatestRun()).current;
  const requirement = useMemo<RecordRequirement>(() => ({ kinds: ["report-analysis", "general"], datasetId: analysis?.datasetId ?? null, analysisRunId: analysis?.analysisRunId ?? null }), [analysis?.datasetId, analysis?.analysisRunId]);
  const blockProblem = method === "BLOCK_RESAMPLE" ? blockLengthProblem(blockText, trades) : null;
  const limitProblem = limitText.trim() !== "" && !/^\d+(\.\d+)?$/.test(limitText.trim()) ? "The drawdown limit must be a positive amount, for example 5000." : null;
  const seedOk = /^\d+$/.test(seed.trim());
  const pathsOk = /^\d+$/.test(pathCount.trim()) && Number(pathCount) >= 1 && Number(pathCount) <= 10_000;
  const shown = result && result.method === method && result.dataset_ref === datasetRef ? result : null;

  const run = async (): Promise<void> => {
    const token = runs.begin();
    setBusy(true);
    setError(null);
    try {
      const next = await service.monteCarloBootstrap(datasetRef, seed.trim(), Number(pathCount), method, method === "BLOCK_RESAMPLE" ? Number(blockText) : null, limitText.trim() || null);
      if (runs.isCurrent(token)) setResult(next);
    } catch (caught) { if (runs.isCurrent(token)) setError(fail(caught)); } finally { if (runs.isCurrent(token)) setBusy(false); }
  };
  const record = async (): Promise<void> => {
    if (!target || !shown) return;
    setBusy(true);
    try {
      const rendered = await service.renderBootstrapNote(datasetRef, shown.analysis_id, reason);
      await notes.record(target, rendered.markdown, rendered.record_id);
      setRecorded(`Recorded in ${target}.`);
    } catch (caught) { setError(fail(caught)); } finally { setBusy(false); }
  };

  const guidance = shown ? bootstrapGuidance(shown, streaky) : null;
  const ccy = shown?.currency ?? "";
  return <>
    <div className="trl-m0__scenario-fields">
      {method === "BLOCK_RESAMPLE" && <label className="trl-m0__field"><span>Block length in trades (your choice; try the typical number of trades in one basket)</span><input inputMode="numeric" value={blockText} placeholder="e.g. your basket size" aria-invalid={blockProblem !== null && blockText !== ""} onChange={(event) => setBlockText(event.currentTarget.value)} /></label>}
      <label className="trl-m0__field"><span>Your drawdown limit in {ccy || "account currency"} (optional)</span><input inputMode="decimal" value={limitText} placeholder="none" onChange={(event) => setLimitText(event.currentTarget.value)} /></label>
    </div>
    {(blockProblem || limitProblem) && <p className="trl-m0__note" role="status">{blockProblem ?? limitProblem}</p>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
    <button type="button" disabled={!enabled || busy || blockProblem !== null || limitProblem !== null || !seedOk || !pathsOk} onClick={() => void run()}>{!enabled ? "Run trade analysis first" : busy ? "Resampling…" : method === "BLOCK_RESAMPLE" ? "Run block resampling" : "Run resampling"}</button>
    {shown && <section className="trl-m0__analysis-result">
      <div className="trl-kpi-row">
        <KpiTile label="Median final result" value={`${r2(shown.final_summary.p50)} ${ccy}`} exact={shown.final_summary.p50} detail={`your report: ${r2(shown.historical.final)} ${ccy}`} />
        <KpiTile label="90 % of paths ended" value={`${r2(shown.final_summary.p05)} to ${r2(shown.final_summary.p95)}`} exact={`${shown.final_summary.p05} to ${shown.final_summary.p95}`} detail="5th to 95th percentile" />
        <KpiTile label="Paths ending below zero" value={`${r2(shown.below_zero.percent)} %`} tone={Number(shown.below_zero.percent) > 0 ? "warning" : "neutral"} exact={`${shown.below_zero.count} of ${shown.configuration.path_count}`} detail={`${shown.below_zero.count} of ${shown.configuration.path_count} paths`} />
        <KpiTile label="Median drawdown" value={`${r2(shown.drawdown_summary.p50)} ${ccy}`} exact={shown.drawdown_summary.p50} detail={`95th percentile ${r2(shown.drawdown_summary.p95)} ${ccy}`} />
        {shown.over_limit && <KpiTile label="Above your drawdown limit" value={`${r2(shown.over_limit.percent)} %`} tone={shown.over_limit.count > 0 ? "warning" : "neutral"} exact={`${shown.over_limit.count} paths`} detail={`limit ${r2(shown.over_limit.limit)} ${ccy}`} />}
      </div>
      <FinalHistogram result={shown} />
      {guidance && <Interpretation sections={[{ heading: null, points: guidance.read }, { heading: "Tips from your results", points: guidance.tips }, { heading: "Keep in mind", points: guidance.flags }]} />}
      <details className="trl-audit"><summary>Exact values</summary>
        <table className="trl-m0__table"><thead><tr><th scope="col">Drawdown percentile</th><th scope="col">Value ({ccy})</th></tr></thead>
          <tbody>{shown.drawdown_percentiles.map((row) => <tr key={row.percentile}><th scope="row">{row.percentile}th{row.percentile === "99" ? " (tail: less reliable)" : ""}</th><td>{money(row.maximum_drawdown)}</td></tr>)}
            <tr><th scope="row">Worst path (tail: less reliable)</th><td>{money(shown.drawdown_summary.maximum)}</td></tr></tbody></table>
      </details>
      <div className="trl-windows__record">
        <strong>Record this check</strong>
        <RecordTo notes={notes} requirement={requirement} createKind={analysis ? "report-analysis" : "general"} bindings={analysis ? { trl_dataset_id: analysis.datasetId, trl_analysis_run_id: analysis.analysisRunId } : undefined} value={target} onChange={setTarget} />
        <label className="trl-m0__field"><span>Your conclusion (recorded verbatim)</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. 7 % of paths end below zero; extend the test first" /></label>
        <div className="trl-m0__actions"><button type="button" disabled={!target || busy} onClick={() => void record()}>Record in experiment note</button></div>
        {recorded && <p className="trl-exploration__notice" role="status">{recorded}<DismissButton onDismiss={() => setRecorded(null)} /></p>}
      </div>
      <AuditTrail items={[
        ["Calculation", <code>{shown.calculation_version}</code>],
        ["Based on", <span title={`TRL code: ${shown.analysis_basis}`}>{plain(shown.analysis_basis)}</span>],
        ["Method", <><span title={`TRL code: ${shown.configuration.sampling_method}`}>{plain(shown.configuration.sampling_method)}</span>{shown.configuration.block_length ? `; blocks of ${shown.configuration.block_length}` : ""}; seed {shown.configuration.seed}; random generator <code>{shown.configuration.prng}</code></>],
        ["Input artifact", <code>{shown.configuration.input_artifact}</code>],
        ["Notes", plainSentence(shown.warnings.join(" "))],
      ]} />
    </section>}
  </>;
}

function FinalHistogram({ result }: { result: BootstrapResult }): React.ReactElement {
  const buckets = result.final_histogram.buckets;
  const most = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const low = Number(buckets[0]?.lower_bound ?? 0), high = Number(buckets.at(-1)?.upper_bound ?? 0);
  const at = (value: number): number => high === low ? 50 : ((value - low) / (high - low)) * 100;
  return <ChartFrame title="Final result across paths">
    <section className="trl-m0__histogram" aria-label={`Final results of ${result.configuration.path_count} paths from ${r2(String(low))} to ${r2(String(high))} ${result.currency}`}>
      <div className="trl-m0__histogram-bars trl-mc-hist" role="img">
        {buckets.map((bucket, index) => <div className="trl-m0__histogram-bin" key={index} title={`${money(bucket.lower_bound)} to ${money(bucket.upper_bound)} ${result.currency}: ${bucket.count} paths`}>
          <span className={`trl-m0__histogram-bar${Number(bucket.upper_bound) <= 0 ? " is-loss" : ""}`} style={{ height: `${Math.max(4, (bucket.count / most) * 100)}%` }} />
        </div>)}
        {low < 0 && high > 0 && <span className="trl-mc-hist__line is-zero" style={{ left: `${at(0)}%` }} title="Zero"><span>0</span></span>}
        <span className="trl-mc-hist__line is-historical" style={{ left: `${at(Number(result.historical.final))}%` }} title={`Your report: ${money(result.historical.final)} ${result.currency}`}><span>Your report</span></span>
      </div>
      <div className="trl-m0__histogram-axis"><span>{r2(String(low))} {result.currency}</span><span>Final result per path</span><span>{r2(String(high))} {result.currency}</span></div>
    </section>
  </ChartFrame>;
}
