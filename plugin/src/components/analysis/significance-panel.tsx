import React, { useMemo, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { CONFIDENCE_OPTIONS, parseMinTrades } from "../../application/research-settings";
import type { SignificanceConfidence, SignificanceResult } from "../../types";
import type { NotesApi } from "../../vault/notes-api";
import type { RecordRequirement } from "../../vault/research-notes-model";
import { AuditTrail } from "../audit-trail";
import { CollapsibleSection } from "../collapsible-section";
import { DismissButton } from "../dismiss-button";
import { money, num } from "../display-format";
import { Interpretation, KpiTile } from "../guidance";
import { plain } from "../plain-language";
import { RecordTo } from "../research/record-to";
import { useThresholds } from "../thresholds-context";
import { intervalGeometry, significanceGuidance } from "./significance-model";

type Props = {
  service: ResearchService;
  datasetRef: string;
  result: SignificanceResult | null;
  error: string | null;
  analysis: { datasetId: string; analysisRunId: string } | null;
  notes: NotesApi;
};

const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);
const percentLabel = (confidence: string): string => `${Math.round(Number(confidence) * 100)} %`;

/**
 * "Is the average trade distinguishable from zero?" (PROPOSAL_SIGNIFICANCE.md
 * G1–G7). Every number is a Core result; the reading and tips are labelled
 * with their sources.
 */
export function SignificancePanel({ service, datasetRef, result, error, analysis, notes }: Props): React.ReactElement {
  const [thresholds, setThresholds] = useThresholds();
  const [minText, setMinText] = useState(thresholds.minTrades === null ? "" : String(thresholds.minTrades));
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [recorded, setRecorded] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requirement = useMemo<RecordRequirement>(() => ({ kinds: ["report-analysis", "general"], datasetId: analysis?.datasetId ?? null, analysisRunId: analysis?.analysisRunId ?? null }), [analysis?.datasetId, analysis?.analysisRunId]);
  const minParsed = parseMinTrades(minText);
  const current = result && result.dataset_ref === datasetRef && result.confidence === thresholds.confidence ? result : null;
  const guidance = current ? significanceGuidance(current, thresholds.minTrades) : null;
  const geometry = current ? intervalGeometry(current) : null;
  const ccy = current?.currency ?? "";
  const test = current?.mean_test;

  const record = async (): Promise<void> => {
    if (!target) return;
    setBusy(true);
    setRecordError(null);
    try {
      const rendered = await service.renderSignificanceNote(datasetRef, thresholds.confidence, reason);
      await notes.record(target, rendered.markdown, rendered.record_id);
      setRecorded(`Recorded in ${target}.`);
    } catch (caught) { setRecordError(fail(caught)); } finally { setBusy(false); }
  };

  return <CollapsibleSection title="Is the average trade distinguishable from zero?" defaultOpen>
    <p className="trl-m0__note">A test of whether the average closed trade (net of commission and swap) is above zero, with a check of the test's main assumption. It describes this report only; it is not a forecast.</p>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>Confidence level (your choice)</span>
        <select value={thresholds.confidence} onChange={(event) => setThresholds({ confidence: event.currentTarget.value as SignificanceConfidence })}>
          {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{percentLabel(option)}</option>)}
        </select></label>
      <label className="trl-m0__field"><span>Your minimum trades (applies across TRL; empty = no warning)</span>
        <input inputMode="numeric" value={minText} placeholder="none" aria-invalid={minParsed === undefined}
          onChange={(event) => { setMinText(event.currentTarget.value); const parsed = parseMinTrades(event.currentTarget.value); if (parsed !== undefined) setThresholds({ minTrades: parsed }); }} /></label>
    </div>
    {minParsed === undefined && <p className="trl-m0__inline-error" role="alert">Enter a whole number above zero, or leave it empty.</p>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    {!current && !error && <p className="trl-m0__note" role="status">Calculating…</p>}
    {current && test && <>
      <div className="trl-kpi-row">
        <KpiTile label="Average trade" value={test.mean === null ? "—" : `${money(test.mean)} ${ccy}`} detail={`${test.count} closed trades`} exact={test.mean} />
        <KpiTile label={`${percentLabel(current.confidence)} interval`} value={test.interval ? `${money(test.interval.low)} to ${money(test.interval.high)}` : "—"} detail={test.interval ? (Number(test.interval.low) > 0 ? "entirely above zero" : "includes zero") : plain(test.reason)} tone={test.interval && current.validity !== "NOT_VALID" ? (Number(test.interval.low) > 0 ? "positive" : "warning") : "neutral"} exact={test.interval ? `${test.interval.low} to ${test.interval.high}` : null} />
        <KpiTile label="t (= uncapped SQN)" value={test.t_statistic === null ? "—" : num(test.t_statistic)} detail={`${test.degrees_of_freedom} degrees of freedom`} exact={test.t_statistic} />
        <KpiTile label="p (one-sided)" value={test.p_value_one_sided === null ? "—" : Number(test.p_value_one_sided).toFixed(4)} detail="if the true average were zero" exact={test.p_value_one_sided} />
        <KpiTile label="Randomness check" value={current.validity === "VALID" ? "Passed" : current.validity === "NOT_VALID" ? "Failed" : "Not checked"} detail={current.validity === "VALID" ? "no pattern in wins and losses" : current.validity === "NOT_VALID" ? "the test above does not apply" : "too few wins or losses to check"} tone={current.validity === "VALID" ? "neutral" : "warning"} />
      </div>
      {geometry && test.interval && <figure className="trl-interval" aria-label={`Average trade ${test.mean} with interval ${test.interval.low} to ${test.interval.high} ${ccy}`}>
        <div className="trl-interval__axis">
          <span className="trl-interval__zero" style={{ left: `${geometry.zero}%` }}><span>0</span></span>
          <span className={`trl-interval__bar${Number(test.interval.low) > 0 ? " is-above" : ""}${current.validity === "NOT_VALID" ? " is-invalid" : ""}`} style={{ left: `${geometry.low}%`, width: `${Math.max(geometry.high - geometry.low, 0.5)}%` }} />
          <span className="trl-interval__mean" style={{ left: `${geometry.mean}%` }} title={`Average ${test.mean}`} />
        </div>
        <figcaption className="trl-m0__note">{money(test.interval.low)} · average {money(test.mean ?? "0")} · {money(test.interval.high)} {ccy} — the bar is the {percentLabel(current.confidence)} interval; the line is zero.</figcaption>
      </figure>}
      {guidance && <Interpretation sections={[{ heading: null, points: guidance.read }, { heading: "Tips from your results", points: guidance.tips }, { heading: "Keep in mind", points: guidance.flags }]} />}
      <div className="trl-windows__record">
        <strong>Record this check</strong>
        <RecordTo notes={notes} requirement={requirement} createKind={analysis ? "report-analysis" : "general"} bindings={analysis ? { trl_dataset_id: analysis.datasetId, trl_analysis_run_id: analysis.analysisRunId } : undefined} value={target} onChange={setTarget} />
        <label className="trl-m0__field"><span>Your conclusion (recorded verbatim)</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. interval includes zero; extend the test before deciding" /></label>
        <div className="trl-m0__actions"><button type="button" disabled={!target || busy} onClick={() => void record()}>Record in experiment note</button></div>
        {recorded && <p className="trl-exploration__notice" role="status">{recorded}<DismissButton onDismiss={() => setRecorded(null)} /></p>}
        {recordError && <p className="trl-m0__inline-error" role="alert">{recordError}<DismissButton onDismiss={() => setRecordError(null)} /></p>}
      </div>
      <AuditTrail items={[
        ["Calculation", <code>{current.calculation_version}</code>],
        ["Based on", <span title={`TRL code: ${current.basis}`}>{plain(current.basis)}</span>],
        ["Test", `one-sample t, ${test.degrees_of_freedom} degrees of freedom${test.interval ? `; critical t ${num(test.interval.critical_t)}` : ""}`],
        ["Runs check", `${current.runs_test.runs} runs; ${current.runs_test.wins} wins, ${current.runs_test.losses} losses, ${current.runs_test.breakeven_excluded} breakeven left out${current.runs_test.z ? `; Z ${num(current.runs_test.z)}` : ""}`],
        ["Lag-1 autocorrelation", current.lag1_autocorrelation === null ? "not available" : num(current.lag1_autocorrelation)],
      ]} />
    </>}
  </CollapsibleSection>;
}
