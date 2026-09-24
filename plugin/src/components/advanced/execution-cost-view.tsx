import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import type { ClosedTradeMetrics, ExecutionCostInputs, ExecutionCostResult } from "../../types";
import type { NotesApi } from "../../vault/notes-api";
import type { RecordRequirement } from "../../vault/research-notes-model";
import { AuditTrail } from "../audit-trail";
import { DismissButton } from "../dismiss-button";
import { money } from "../display-format";
import { Interpretation, KpiTile } from "../guidance";
import { plainSentence } from "../plain-language";
import { RecordTo } from "../research/record-to";
import { executionCostGuidance } from "./execution-cost-model";

type Props = {
  service: ResearchService;
  datasetRef: string;
  enabled: boolean;
  analysis: { datasetId: string; analysisRunId: string } | null;
  notes: NotesApi;
};

const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);
const r2 = (value: string | null): string => value === null ? "—" : Number(value).toFixed(2);
const amountOk = (text: string): boolean => text.trim() === "" || /^\d+(\.\d+)?$/.test(text.trim());
const EMPTY: ExecutionCostInputs = { extraSpread: null, slippage: null, perSymbol: {} };

/** Extra spread and slippage per lot (PROPOSAL_EXECUTION_COSTS.md X1–X7). Every parameter is optional; every number is a Core result. */
export function ExecutionCostView({ service, datasetRef, enabled, analysis, notes }: Props): React.ReactElement {
  const [spread, setSpread] = useState("");
  const [slippage, setSlippage] = useState("");
  const [perSymbol, setPerSymbol] = useState<Record<string, { spread?: string; slippage?: string }>>({});
  const [result, setResult] = useState<ExecutionCostResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helper, setHelper] = useState({ points: "", pointSize: "", tickSize: "", tickValue: "" });
  const [helperResult, setHelperResult] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [recorded, setRecorded] = useState<string | null>(null);
  const runs = useRef(new LatestRun()).current;
  const requirement = useMemo<RecordRequirement>(() => ({ kinds: ["report-analysis", "general"], datasetId: analysis?.datasetId ?? null, analysisRunId: analysis?.analysisRunId ?? null }), [analysis?.datasetId, analysis?.analysisRunId]);
  const inputs: ExecutionCostInputs = { extraSpread: spread.trim() || null, slippage: slippage.trim() || null, perSymbol };
  const valid = amountOk(spread) && amountOk(slippage) && Object.values(perSymbol).every((value) => amountOk(value.spread ?? "") && amountOk(value.slippage ?? ""));

  const run = async (with_: ExecutionCostInputs): Promise<void> => {
    const token = runs.begin();
    setBusy(true);
    setError(null);
    try {
      const next = await service.executionCosts(datasetRef, with_);
      if (runs.isCurrent(token)) setResult(next);
    } catch (caught) { if (runs.isCurrent(token)) setError(fail(caught)); } finally { if (runs.isCurrent(token)) setBusy(false); }
  };
  // The break-even needs no parameters, so it is shown as soon as the report is analysed.
  useEffect(() => { if (enabled) void run(EMPTY); }, [datasetRef, enabled]);

  const convert = async (): Promise<void> => {
    setError(null);
    try {
      const converted = await service.pointsToMoney(helper.points.trim(), helper.pointSize.trim(), helper.tickSize.trim(), helper.tickValue.trim());
      setHelperResult(converted.money_per_lot);
    } catch (caught) { setError(fail(caught)); }
  };
  const record = async (): Promise<void> => {
    if (!target) return;
    setBusy(true);
    try {
      const rendered = await service.renderExecutionCostNote(datasetRef, inputs, reason);
      await notes.record(target, rendered.markdown, rendered.record_id);
      setRecorded(`Recorded in ${target}.`);
    } catch (caught) { setError(fail(caught)); } finally { setBusy(false); }
  };

  const ccy = result?.currency ?? "";
  const guidance = result ? executionCostGuidance(result) : null;
  const symbols = result?.by_symbol.map((row) => row.symbol) ?? [];
  return <>
    {result && <div className="trl-kpi-row">
      <KpiTile label="Break-even extra cost" value={result.break_even_per_lot === null ? "none" : `${r2(result.break_even_per_lot)} ${ccy}`} tone={result.break_even_per_lot === null ? "negative" : "neutral"} exact={result.break_even_per_lot} detail={result.break_even_per_lot === null ? "not profitable before extra costs" : `per lot, per deal · ${r2(result.lots_dealt)} lots dealt`} />
      {result.after && <KpiTile label="Balance change with your costs" value={`${r2(result.after.balance_change)} ${ccy}`} tone={Number(result.after.balance_change) > 0 ? "positive" : "negative"} exact={result.after.balance_change} detail={`from ${r2(result.before.balance_change)} · extra costs ${r2(result.after.extra_cost_total)}`} />}
      {result.after && <KpiTile label="Max drawdown with your costs" value={`${r2(result.after.max_drawdown)} ${ccy}`} tone="negative" exact={result.after.max_drawdown} detail={`from ${r2(result.before.max_drawdown)} ${ccy}`} />}
    </div>}
    <p className="trl-m0__note">Every parameter below is optional and your own assumption, in {ccy || "account currency"} per 1.0 lot, charged on every opening and closing deal. Leave them empty to see only the break-even.</p>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>Extra spread per lot (optional)</span><input inputMode="decimal" value={spread} placeholder="none" aria-invalid={!amountOk(spread)} onChange={(event) => setSpread(event.currentTarget.value)} /></label>
      <label className="trl-m0__field"><span>Slippage per lot (optional)</span><input inputMode="decimal" value={slippage} placeholder="none" aria-invalid={!amountOk(slippage)} onChange={(event) => setSlippage(event.currentTarget.value)} /></label>
    </div>
    {symbols.length > 1 && <details className="trl-audit"><summary>Different costs per symbol (optional)</summary>
      <table className="trl-m0__table"><thead><tr><th scope="col">Symbol</th><th scope="col">Extra spread per lot</th><th scope="col">Slippage per lot</th></tr></thead>
        <tbody>{symbols.map((symbol) => <tr key={symbol}><th scope="row">{symbol}</th>
          <td><input inputMode="decimal" aria-label={`${symbol} extra spread per lot`} placeholder="as above" value={perSymbol[symbol]?.spread ?? ""} onChange={(event) => { const value = event.currentTarget.value; setPerSymbol((current) => ({ ...current, [symbol]: { ...current[symbol], spread: value } })); }} /></td>
          <td><input inputMode="decimal" aria-label={`${symbol} slippage per lot`} placeholder="as above" value={perSymbol[symbol]?.slippage ?? ""} onChange={(event) => { const value = event.currentTarget.value; setPerSymbol((current) => ({ ...current, [symbol]: { ...current[symbol], slippage: value } })); }} /></td>
        </tr>)}</tbody></table>
    </details>}
    <details className="trl-audit"><summary>Convert points to money per lot (optional helper)</summary>
      <p className="trl-m0__note">From your broker's symbol specification (Market Watch → Specification). TRL computes points × point size ÷ tick size × tick value; the tick value must be in your account currency.</p>
      <div className="trl-m0__scenario-fields">
        {(["points", "pointSize", "tickSize", "tickValue"] as const).map((key) => <label key={key} className="trl-m0__field"><span>{{ points: "Extra points", pointSize: "Point size", tickSize: "Tick size", tickValue: "Tick value" }[key]}</span><input inputMode="decimal" value={helper[key]} onChange={(event) => { const value = event.currentTarget.value; setHelper((current) => ({ ...current, [key]: value })); }} /></label>)}
      </div>
      <div className="trl-m0__actions"><button type="button" onClick={() => void convert()}>Convert</button>
        {helperResult && <><span className="trl-m0__note">= {r2(helperResult)} per lot</span><button type="button" onClick={() => setSpread(helperResult)}>Use as extra spread</button></>}</div>
    </details>
    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
    <button type="button" disabled={!enabled || busy || !valid} onClick={() => void run(inputs)}>{!enabled ? "Run trade analysis first" : busy ? "Calculating…" : "Apply these costs"}</button>
    {result?.after && <MetricsCompare before={result.before.closed_trades} after={result.after.closed_trades} currency={ccy} />}
    {guidance && <Interpretation sections={[{ heading: null, points: guidance.read }, { heading: "Tips from your results", points: guidance.tips }, { heading: "Keep in mind", points: guidance.flags }]} />}
    {result && <div className="trl-windows__record">
      <strong>Record this check</strong>
      <RecordTo notes={notes} requirement={requirement} createKind={analysis ? "report-analysis" : "general"} bindings={analysis ? { trl_dataset_id: analysis.datasetId, trl_analysis_run_id: analysis.analysisRunId } : undefined} value={target} onChange={setTarget} />
      <label className="trl-m0__field"><span>Your conclusion (recorded verbatim)</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. the edge survives up to 12 per lot; my broker adds about 3" /></label>
      <div className="trl-m0__actions"><button type="button" disabled={!target || busy} onClick={() => void record()}>Record in experiment note</button></div>
      {recorded && <p className="trl-exploration__notice" role="status">{recorded}<DismissButton onDismiss={() => setRecorded(null)} /></p>}
    </div>}
    {result && <AuditTrail items={[["Calculation", <code>{result.calculation_version}</code>], ["Charged", result.applied ? `${r2(result.round_turn_check.per_deal_total)} ${ccy} on the balance; ${r2(result.round_turn_check.round_turn_total)} ${ccy} in per-trade figures` : "nothing (no parameters)"], ["Notes", plainSentence(result.warnings.join(" "))]]} />}
  </>;
}

function MetricsCompare({ before, after, currency }: { before: ClosedTradeMetrics; after: ClosedTradeMetrics; currency: string }): React.ReactElement {
  const rows: Array<[string, string | null, string | null, string]> = [
    ["Net of closed trades", before.net, after.net, currency],
    ["Profit factor", before.profit_factor, after.profit_factor, ""],
    ["Win rate", before.win_rate_percent, after.win_rate_percent, "%"],
    ["Expectancy per trade", before.expectancy, after.expectancy, currency],
  ];
  return <div className="trl-monthly"><table>
    <thead><tr><th scope="col">Closed trades</th><th scope="col">As reported</th><th scope="col">With your costs</th></tr></thead>
    <tbody>{rows.map(([label, from, to, unit]) => <tr key={label}><th scope="row">{label}</th><td>{from === null ? "—" : `${money(from)} ${unit}`}</td><td>{to === null ? "—" : `${money(to)} ${unit}`}</td></tr>)}</tbody>
  </table></div>;
}
