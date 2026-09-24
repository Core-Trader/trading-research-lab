import React, { useMemo, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import type { CostBreakdown, CostRow } from "../../types";
import type { NotesApi } from "../../vault/notes-api";
import type { RecordRequirement } from "../../vault/research-notes-model";
import { AuditTrail } from "../audit-trail";
import { CollapsibleSection } from "../collapsible-section";
import { DismissButton } from "../dismiss-button";
import { money } from "../display-format";
import { Interpretation, KpiTile } from "../guidance";
import { plainSentence } from "../plain-language";
import { RecordTo } from "../research/record-to";
import { costGuidance } from "./cost-model";

type Props = {
  service: ResearchService;
  datasetRef: string;
  result: CostBreakdown | null;
  error: string | null;
  analysis: { datasetId: string; analysisRunId: string } | null;
  notes: NotesApi;
};

const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);
const r2 = (value: string | null): string => value === null ? "—" : Number(value).toFixed(2);

/** Costs (PROPOSAL_COST_BREAKDOWN.md C1–C5). Every amount is a Core result. */
export function CostsPanel({ service, datasetRef, result, error, analysis, notes }: Props): React.ReactElement {
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [recorded, setRecorded] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requirement = useMemo<RecordRequirement>(() => ({ kinds: ["report-analysis", "general"], datasetId: analysis?.datasetId ?? null, analysisRunId: analysis?.analysisRunId ?? null }), [analysis?.datasetId, analysis?.analysisRunId]);
  const current = result && result.dataset_ref === datasetRef ? result : null;
  const ccy = current?.currency ?? "";
  const guidance = current ? costGuidance(current) : null;

  const record = async (): Promise<void> => {
    if (!target) return;
    setBusy(true);
    setRecordError(null);
    try {
      const rendered = await service.renderCostNote(datasetRef, reason);
      await notes.record(target, rendered.markdown, rendered.record_id);
      setRecorded(`Recorded in ${target}.`);
    } catch (caught) { setRecordError(fail(caught)); } finally { setBusy(false); }
  };

  return <CollapsibleSection title="Costs: commissions and swaps">
    <p className="trl-m0__note">Where the result went: the trades' result before costs, then commissions (on opening and closing deals) and swaps, down to the net result. Every amount comes from the report's own deals.</p>
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    {!current && !error && <p className="trl-m0__note" role="status">Calculating…</p>}
    {current && <>
      <div className="trl-kpi-row">
        <KpiTile label="Result before costs" value={`${r2(current.summary.trade_result_before_costs)} ${ccy}`} exact={current.summary.trade_result_before_costs} detail={`${current.summary.closed_trades} closed trades`} />
        <KpiTile label="Commissions" value={`${r2(current.summary.commissions)} ${ccy}`} tone="negative" exact={`opening ${current.summary.commission_open}; closing ${current.summary.commission_close}`} detail={`opening ${r2(current.summary.commission_open)} · closing ${r2(current.summary.commission_close)}`} />
        <KpiTile label="Swaps" value={`${r2(current.summary.swaps)} ${ccy}`} exact={`charged ${current.summary.swap_charged}; credited ${current.summary.swap_credited}`} detail={`charged ${r2(current.summary.swap_charged)} · credited ${r2(current.summary.swap_credited)}`} />
        <KpiTile label="Net result" value={`${r2(current.summary.net)} ${ccy}`} tone={Number(current.summary.net) >= 0 ? "positive" : "negative"} exact={current.summary.net} detail={current.intensity.cost_share_percent === null ? "equals the balance change" : `costs took ${r2(current.intensity.cost_share_percent)} %`} />
        <KpiTile label="Cost per closed trade" value={`${r2(current.intensity.cost_per_closed_trade)} ${ccy}`} exact={current.intensity.cost_per_closed_trade} detail={`commission per lot ${r2(current.intensity.commission_per_lot)} ${ccy}`} />
      </div>
      <CostSteps summary={current.summary} currency={ccy} />
      <p className={current.reconciliation.status === "MATCHES" ? "trl-m0__note" : "trl-m0__inline-error"} role="status">
        {current.reconciliation.status === "MATCHES"
          ? `Reconciled: opening balance ${money(current.reconciliation.opening_balance)} + all components = final balance ${money(current.reconciliation.reported_final)} ${ccy}.`
          : `Does not reconcile: the components give ${money(current.reconciliation.computed_final)} but the report's final balance is ${money(current.reconciliation.reported_final)} ${ccy} (difference ${money(current.reconciliation.difference)}).`}
      </p>
      {guidance && <Interpretation sections={[{ heading: null, points: guidance.read }, { heading: "Tips from your results", points: guidance.tips }, { heading: "Keep in mind", points: guidance.flags }]} />}
      <details className="trl-audit"><summary>By symbol ({current.by_symbol.length})</summary><CostTable rows={current.by_symbol.map((row) => ({ label: row.symbol, row }))} currency={ccy} /></details>
      <details className="trl-audit"><summary>By month ({current.by_month.length})</summary><CostTable rows={current.by_month.map((row) => ({ label: row.month, row }))} currency={ccy} /></details>
      <div className="trl-windows__record">
        <strong>Record this check</strong>
        <RecordTo notes={notes} requirement={requirement} createKind={analysis ? "report-analysis" : "general"} bindings={analysis ? { trl_dataset_id: analysis.datasetId, trl_analysis_run_id: analysis.analysisRunId } : undefined} value={target} onChange={setTarget} />
        <label className="trl-m0__field"><span>Your conclusion (recorded verbatim)</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. costs take a quarter of the edge; test a cheaper account type" /></label>
        <div className="trl-m0__actions"><button type="button" disabled={!target || busy} onClick={() => void record()}>Record in experiment note</button></div>
        {recorded && <p className="trl-exploration__notice" role="status">{recorded}<DismissButton onDismiss={() => setRecorded(null)} /></p>}
        {recordError && <p className="trl-m0__inline-error" role="alert">{recordError}<DismissButton onDismiss={() => setRecordError(null)} /></p>}
      </div>
      <AuditTrail items={[["Calculation", <code>{current.calculation_version}</code>], ["Report", current.source_filename ?? current.dataset_ref], ["Notes", plainSentence(current.warnings.join(" "))]]} />
    </>}
  </CollapsibleSection>;
}

/** From the result before costs to the net result, one step per cost component. */
function CostSteps({ summary, currency }: { summary: CostRow; currency: string }): React.ReactElement {
  const steps = [
    { label: "Before costs", value: summary.trade_result_before_costs, total: true },
    { label: "Opening commissions", value: summary.commission_open },
    { label: "Closing commissions", value: summary.commission_close },
    { label: "Swaps charged", value: summary.swap_charged },
    { label: "Swaps credited", value: summary.swap_credited },
    { label: "Net", value: summary.net, total: true },
  ];
  const most = Math.max(...steps.map((step) => Math.abs(Number(step.value))), 1);
  return <figure className="trl-cost-steps" aria-label={`From ${summary.trade_result_before_costs} before costs to ${summary.net} ${currency} net`}>
    {steps.map((step) => <div key={step.label} className={`trl-cost-steps__row${step.total ? " is-total" : ""}`}>
      <span className="trl-cost-steps__label">{step.label}</span>
      <span className="trl-cost-steps__track"><span className={`trl-cost-steps__bar ${Number(step.value) < 0 ? "is-negative" : "is-positive"}`} style={{ width: `${(Math.abs(Number(step.value)) / most) * 100}%` }} /></span>
      <span className="trl-cost-steps__value">{money(step.value)} {currency}</span>
    </div>)}
  </figure>;
}

function CostTable({ rows, currency }: { rows: Array<{ label: string; row: CostRow }>; currency: string }): React.ReactElement {
  return <div className="trl-monthly"><table>
    <thead><tr><th scope="col"></th><th scope="col">Before costs</th><th scope="col">Commissions</th><th scope="col">Swaps</th><th scope="col">Net ({currency})</th><th scope="col">Cost share</th><th scope="col">Trades</th></tr></thead>
    <tbody>{rows.map(({ label, row }) => <tr key={label}>
      <th scope="row">{label}</th>
      <td>{money(row.trade_result_before_costs)}</td>
      <td title={`opening ${row.commission_open}; closing ${row.commission_close}`}>{money(row.commissions)}</td>
      <td title={`charged ${row.swap_charged}; credited ${row.swap_credited}`}>{money(row.swaps)}</td>
      <td className={Number(row.net) < 0 ? "is-negative" : "is-positive"}>{money(row.net)}</td>
      <td>{row.cost_share_percent === null ? "—" : `${r2(row.cost_share_percent)} %`}</td>
      <td>{row.closed_trades}</td>
    </tr>)}</tbody>
  </table></div>;
}
