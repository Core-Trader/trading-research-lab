import React from "react";
import type { RMultipleMetrics } from "../../types";
import { CollapsibleSection } from "../collapsible-section";
import { roundDecimalString } from "../display-format";
import { signTone } from "../dashboard-model";
import { num } from "../display-format";

export type RSource = "AVERAGE_LOSS" | "DECLARED";

type Props = {
  source: RSource;
  amount: string;
  result: RMultipleMetrics | null;
  busy: boolean;
  error: string | null;
  enabled: boolean;
  onSourceChange: (source: RSource) => void;
  onAmountChange: (amount: string) => void;
  onRun: () => void;
};

const r2 = (value: string | null): string => value === null ? "—" : roundDecimalString(value, 2);

/** Van K. Tharp R-multiple view. Every value is from the Core; 1R quality is always shown. */
export function RMultiplePanel({ source, amount, result, busy, error, enabled, onSourceChange, onAmountChange, onRun }: Props): React.ReactElement {
  return <CollapsibleSection title="R-multiples (Van Tharp)">
    <p className="trl-m0__note">Expresses each verified close event as a multiple of one risk unit (1R). MT5 reports do not contain each trade's risk in money, so 1R is either an amount you declare or the average loss (an inferred proxy). SQN does not depend on this choice.</p>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>1R source</span>
        <select value={source} onChange={(event) => onSourceChange(event.currentTarget.value as RSource)}>
          <option value="AVERAGE_LOSS">Average loss (inferred proxy)</option>
          <option value="DECLARED">Fixed amount I declare</option>
        </select>
      </label>
      {source === "DECLARED" && <label className="trl-m0__field"><span>1R amount (report currency)</span><input type="text" inputMode="decimal" value={amount} placeholder="100.00" onChange={(event) => onAmountChange(event.currentTarget.value)} /></label>}
    </div>
    <button type="button" className="mod-cta" disabled={!enabled || busy || (source === "DECLARED" && !amount.trim())} onClick={onRun}>{busy ? "Calculating…" : "Calculate R-multiples"}</button>
    {!enabled && <p className="trl-m0__note">Import a report first.</p>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    {result && <section className="trl-m0__analysis-result">
      <h4>R-multiple distribution <span className={`trl-badge is-${result.r_quality === "INFERRED" ? "inferred" : "user"}`} title={`Core value: 1R = ${result.one_r}`}>1R {r2(result.one_r)} {result.currency ?? ""} · {result.r_quality}</span></h4>
      <div className="trl-kpi-row">
        <Tile label="Expectancy (R)" value={`${r2(result.expectancy_r)} R`} detail="Mean R per close event" exact={result.expectancy_r} tone={result.expectancy_r} />
        <Tile label="SQN (Van Tharp)" value={r2(result.sqn_capped_100)} detail={`raw ${r2(result.sqn)} · N = ${result.close_event_count} · no quality band`} exact={result.sqn} />
        <Tile label="Opportunity" value={result.opportunity_per_30_days === null ? "—" : `${r2(result.opportunity_per_30_days)} / 30 days`} detail="Close events per 30 report-clock days" exact={result.opportunity_per_30_days} />
        <Tile label="Expectunity" value={result.expectunity_r_per_30_days === null ? "—" : `${r2(result.expectunity_r_per_30_days)} R / 30 days`} detail="Expectancy × opportunity" exact={result.expectunity_r_per_30_days} tone={result.expectunity_r_per_30_days} />
        <Tile label="Largest win / loss" value={`${r2(result.largest_win_r)} R / ${r2(result.largest_loss_r)} R`} detail="Single close events" />
        <Tile label={`Top ${result.top_events_share_percent.event_count} winners' share`} value={result.top_events_share_percent.value === null ? "—" : `${r2(result.top_events_share_percent.value)}%`} detail={result.top_events_share_percent.value === null ? "Net P/L is not positive" : "Of total net P/L; can exceed 100% because losses offset gains"} exact={result.top_events_share_percent.value} />
      </div>
      <RHistogram histogram={result.histogram} expectancy={result.expectancy_r} />
      <ul className="trl-batch__warnings">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </section>}
  </CollapsibleSection>;
}

function Tile({ label, value, detail, exact, tone }: { label: string; value: string; detail: string; exact?: string | null; tone?: string | null }): React.ReactElement {
  return <div className={`trl-kpi trl-kpi--${tone ? signTone(tone) : "neutral"}`} title={exact ? `Core value: ${exact}` : undefined}>
    <span className="trl-kpi__label">{label}</span><strong className="trl-kpi__value">{value}</strong><span className="trl-kpi__detail">{detail}</span>
  </div>;
}

function RHistogram({ histogram, expectancy }: { histogram: RMultipleMetrics["histogram"]; expectancy: string | null }): React.ReactElement {
  const bins = [
    { key: "under", label: "< -3R", count: histogram.underflow_count, tone: "negative" },
    ...histogram.buckets.map((bucket) => ({ key: bucket.lower_r, label: `${num(bucket.lower_r)}R to ${num(bucket.upper_r)}R`, count: bucket.count, tone: bucket.lower_r.startsWith("-") ? "negative" : "positive" })),
    { key: "over", label: "≥ 5R", count: histogram.overflow_count, tone: "positive" },
  ];
  const largest = Math.max(1, ...bins.map((bin) => bin.count));
  const zeroIndex = bins.findIndex((bin) => bin.key === "0");
  return <figure className="trl-r-histogram" aria-label="Distribution of R-multiples">
    <div className="trl-r-histogram__bars">
      {bins.map((bin, index) => <div key={bin.key} className={`trl-r-histogram__bin is-${bin.tone}${index === zeroIndex ? " is-zero" : ""}`} title={`${bin.label}: ${bin.count} close events`}>
        <span className="trl-r-histogram__count">{bin.count > 0 ? bin.count : ""}</span>
        <span className="trl-r-histogram__bar" style={{ height: `${bin.count === 0 ? 0 : Math.max(3, (bin.count / largest) * 100)}%` }} />
      </div>)}
    </div>
    <div className="trl-r-histogram__axis"><span style={{ left: "0%" }}>&lt; -3R</span>{zeroIndex >= 0 && <span style={{ left: `${(zeroIndex / bins.length) * 100}%` }}>0R</span>}<span style={{ right: "0%" }}>≥ 5R</span></div>
    <figcaption className="trl-m0__note">Close events per 0.5R bin (lower edge inclusive); the outer bars collect everything beyond −3R and from +5R. {expectancy === null ? "" : `Expectancy ${r2(expectancy)} R.`} Hover a bar for its range and count.</figcaption>
  </figure>;
}
