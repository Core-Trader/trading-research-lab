import React, { useMemo, useState } from "react";
import { plain, plainSentence } from "../plain-language";
import type { EquityMetrics, FixedCostScenarioResult, MonteCarloResult } from "../../types";
import { AuditTrail } from "../audit-trail";
import { ChartFrame } from "../chart-frame";
import { CollapsibleSection } from "../collapsible-section";
import { signTone } from "../dashboard-model";
import { roundDecimalString } from "../display-format";
import { GuidanceBlock, KpiTile } from "../guidance";
import { axisPosition, fanBandGeometry, monteCarloGuidance, stripMarkers } from "./monte-carlo-model";
import { money } from "../display-format";

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);

export function WhatIfAnalysis({ cost, error, result, enabled, onCostChange, onRun }: {
  cost: string;
  error: string | null;
  result: FixedCostScenarioResult | null;
  enabled: boolean;
  onCostChange: (value: string) => void;
  onRun: () => void;
}): React.ReactElement {
  const currency = result?.currency ?? "";
  return <CollapsibleSection title="What-if: extra cost per trade" defaultOpen>
    <p className="trl-m0__note">Adds a fixed extra cost (for example spread, slippage or commission you expect) to every closed trade and shows how the result changes. It is a sensitivity check, not a forecast.</p>
    <label className="trl-m0__field">
      <span>Extra cost per closed trade (report currency)</span>
      <input type="text" inputMode="decimal" value={cost} onChange={(event) => onCostChange(event.currentTarget.value)} placeholder="0.00" />
    </label>
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    <button type="button" disabled={!enabled || !cost.trim()} onClick={onRun}>{enabled ? "Run what-if" : "Run trade analysis first"}</button>
    {result && <section className="trl-m0__analysis-result">
      <div className="trl-kpi-row">
        <KpiTile label="Net P/L now" value={`${r2(result.source_summary.net_pnl)} ${currency}`} tone={signTone(result.source_summary.net_pnl)} exact={result.source_summary.net_pnl} detail={`${result.source_summary.count} closed trades`} />
        <KpiTile label={`With +${r2(result.configuration.additional_cost_per_close_event)} per trade`} value={`${r2(result.scenario_summary.net_pnl)} ${currency}`} tone={signTone(result.scenario_summary.net_pnl)} exact={result.scenario_summary.net_pnl} detail={`Difference ${r2(result.net_pnl_delta)} ${currency}`} />
      </div>
      <OutcomeBar label="Now" summary={result.source_summary} />
      <OutcomeBar label="With extra cost" summary={result.scenario_summary} />
      <p className="trl-m0__note">Bars show wins, losses and breakeven trades (green, red, grey); hover for counts. The cost is your assumption; spread, slippage and position sizing are not modelled beyond it.</p>
      <AuditTrail items={[["Based on", <span title={`TRL code: ${result.analysis_basis}`}>{plain(result.analysis_basis)}</span>], ["Policy version", <code>{result.policy_id}</code>], ["Input artifact", <code>{result.configuration.input_artifact}</code>], ["Artifact", <code>{result.artifacts.table}</code>], ["Notes", plainSentence(result.warnings.join(" "))]]} />
    </section>}
  </CollapsibleSection>;
}

function OutcomeBar({ label, summary }: { label: string; summary: FixedCostScenarioResult["source_summary"] }): React.ReactElement {
  const total = Math.max(1, summary.win_count + summary.loss_count + summary.breakeven_count);
  const part = (count: number): string => `${(count / total) * 100}%`;
  return <div className="trl-outcome">
    <span className="trl-outcome__label">{label}</span>
    <div className="trl-outcome__bar" role="img" aria-label={`${label}: ${summary.win_count} wins, ${summary.loss_count} losses, ${summary.breakeven_count} breakeven`}>
      <span className="is-win" style={{ width: part(summary.win_count) }} title={`${summary.win_count} wins`} />
      <span className="is-loss" style={{ width: part(summary.loss_count) }} title={`${summary.loss_count} losses`} />
      <span className="is-even" style={{ width: part(summary.breakeven_count) }} title={`${summary.breakeven_count} breakeven`} />
    </div>
    <span className="trl-outcome__counts">{summary.win_count} / {summary.loss_count} / {summary.breakeven_count}</span>
  </div>;
}

export function MonteCarloAnalysis({ seed, pathCount, error, result, enabled, equity, onSeedChange, onPathCountChange, onRun }: {
  seed: string;
  pathCount: string;
  error: string | null;
  result: MonteCarloResult | null;
  enabled: boolean;
  equity: EquityMetrics | null;
  onSeedChange: (value: string) => void;
  onPathCountChange: (value: string) => void;
  onRun: () => void;
}): React.ReactElement {
  const currency = result?.currency ?? "";
  return <CollapsibleSection title="Monte Carlo: trade-order reshuffle" defaultOpen>
    <p className="trl-m0__note">Replays your closed trades in many random orders to show how much the drawdown depends on the order trades happened to arrive in. It is not a forecast.</p>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>Seed (makes the reshuffle repeatable)</span><input type="text" inputMode="numeric" value={seed} onChange={(event) => onSeedChange(event.currentTarget.value)} /></label>
      <label className="trl-m0__field"><span>Paths (1–10,000)</span><input type="text" inputMode="numeric" value={pathCount} onChange={(event) => onPathCountChange(event.currentTarget.value)} /></label>
    </div>
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    <button type="button" disabled={!enabled || !seed.trim() || !pathCount.trim()} onClick={onRun}>{enabled ? "Run reshuffle" : "Run trade analysis first"}</button>
    {result && <section className="trl-m0__analysis-result">
      <div className="trl-kpi-row">
        <KpiTile label="Median worst drawdown" value={`${r2(result.drawdown_summary.p50)} ${currency}`} exact={result.drawdown_summary.p50} detail={result.account.p50_percent_of_opening !== null ? `${r2(result.account.p50_percent_of_opening)}% of starting balance` : "Half of the paths at or below"} />
        <KpiTile label="95% of paths within" value={`${r2(result.drawdown_summary.p95)} ${currency}`} tone="warning" exact={result.drawdown_summary.p95} detail={result.account.p95_percent_of_opening !== null ? `${r2(result.account.p95_percent_of_opening)}% of starting balance` : "95th percentile"} />
        <KpiTile label="Worst reshuffle" value={`${r2(result.drawdown_summary.maximum)} ${currency}`} tone="negative" exact={result.drawdown_summary.maximum} detail={`of ${result.configuration.path_count} paths`} />
        <KpiTile label="Your actual order" value={`${r2(result.historical.maximum_drawdown)} ${currency}`} exact={result.historical.maximum_drawdown} detail={Number(result.historical.rank_percent) === 0 ? "Shallowest of all paths" : `Deeper than ${r2(result.historical.rank_percent)}% of paths`} />
      </div>
      <p className="trl-m0__note">Seed {result.configuration.seed} · {result.configuration.path_count} paths · {result.population_count} closed trades · every path ends at {r2(result.invariant_final_pnl)} {currency}.</p>
      <PercentileStrip result={result} />
      <DrawdownHistogram result={result} />
      <PathFan result={result} />
      <GuidanceBlock guidance={monteCarloGuidance(result, equity)} />
      <details className="trl-audit"><summary>Exact values</summary><DrawdownPercentileTable percentiles={result.drawdown_percentiles} currency={currency} /></details>
      <AuditTrail items={[["Based on", <span title={`TRL code: ${result.analysis_basis}`}>{plain(result.analysis_basis)}</span>], ["Method", <><span title={`TRL code: ${result.configuration.sampling_method}`}>{plain(result.configuration.sampling_method)}</span>; random generator <code>{result.configuration.prng}</code></>], ["Input artifact", <code>{result.configuration.input_artifact}</code>], ["Least / worst drawdown path", <>#{result.least_drawdown_path.path_index} / #{result.worst_drawdown_path.path_index}</>], ["Notes", plainSentence(result.warnings.join(" "))]]} />
    </section>}
  </CollapsibleSection>;
}

function PercentileStrip({ result }: { result: MonteCarloResult }): React.ReactElement {
  const markers = stripMarkers(result);
  return <figure className="trl-mc-strip" aria-label="Worst drawdown across reshuffled paths, from best to worst">
    <h5>Where the drawdowns fall</h5>
    <div className="trl-mc-strip__track">
      <span className="trl-mc-strip__middle" style={{ left: `${markers[1]!.position}%`, width: `${Math.max(0, markers[3]!.position - markers[1]!.position)}%` }} />
      {markers.map((marker) => <span key={marker.key} className={`trl-mc-strip__marker${marker.emphasis ? " is-emphasis" : ""}`} style={{ left: `${marker.position}%` }} title={`${marker.label}: ${money(marker.value)} ${result.currency}`}><span className="trl-mc-strip__label">{marker.label}</span></span>)}
    </div>
    <figcaption className="trl-m0__note">Left = smallest worst drawdown, right = largest. The band covers the middle 90% of paths; the accent marker is your actual trade order. Hover a marker for its exact value.</figcaption>
  </figure>;
}

export function DrawdownHistogram({ result }: { result: MonteCarloResult }): React.ReactElement {
  const histogram = result.drawdown_histogram;
  const currency = result.currency;
  const maximumCount = Math.max(...histogram.buckets.map((bucket) => bucket.count), 1);
  const low = histogram.buckets[0]?.lower_bound ?? "0";
  const high = histogram.buckets.at(-1)?.upper_bound ?? "0";
  const lines = [
    { key: "p50", label: "Median", value: result.drawdown_summary.p50 },
    { key: "p95", label: "95%", value: result.drawdown_summary.p95 },
    { key: "historical", label: "Your order", value: result.historical.maximum_drawdown },
  ];
  return <ChartFrame title="Distribution of worst drawdowns">
    <section className="trl-m0__histogram" aria-label="Distribution of worst drawdowns across reshuffled paths">
      <div className="trl-m0__histogram-bars trl-mc-hist" role="img" aria-label={`${histogram.bin_count} bins from ${money(low)} to ${money(high)} ${currency}`}>
        {histogram.buckets.map((bucket, index) => <div className="trl-m0__histogram-bin" key={`${money(bucket.lower_bound)}-${index}`} title={`${money(bucket.lower_bound)} to ${money(bucket.upper_bound)} ${currency}: ${bucket.count} paths`}>
          <span className="trl-m0__histogram-bar" style={{ height: `${Math.max(4, (bucket.count / maximumCount) * 100)}%` }} />
        </div>)}
        {lines.map((line) => <span key={line.key} className={`trl-mc-hist__line is-${line.key}`} style={{ left: `${axisPosition(line.value, low, high)}%` }} title={`${line.label}: ${money(line.value)} ${currency}`}><span>{line.label}</span></span>)}
      </div>
      <div className="trl-m0__histogram-axis"><span>{r2(low)} {currency}</span><span>Worst drawdown per path</span><span>{r2(high)} {currency}</span></div>
    </section>
  </ChartFrame>;
}

export function DrawdownPercentileTable({ percentiles, currency }: { percentiles: MonteCarloResult["drawdown_percentiles"]; currency: string }): React.ReactElement {
  return <section className="trl-mc-percentiles" aria-label="Worst drawdown by percentile">
    <table>
      <thead><tr><th scope="col">Percentile of paths</th><th scope="col">Worst drawdown ({currency})</th></tr></thead>
      <tbody>{percentiles.map((row) => <tr key={row.percentile}><th scope="row">p{row.percentile}</th><td>{money(row.maximum_drawdown)}</td></tr>)}</tbody>
    </table>
    <p className="trl-m0__note">p95: 95% of this run's paths had a worst drawdown at or below this value (nearest rank). It describes these paths only.</p>
  </section>;
}

export function PathFan({ result }: { result: MonteCarloResult }): React.ReactElement {
  const [showBand, setShowBand] = useState(false);
  const fan = result.path_fan;
  const band = useMemo(() => fanBandGeometry(result, true), [result]);
  if (band === null) return <p className="trl-m0__note">The path band could not be drawn from these results.</p>;
  const lastEvent = fan.event_indices.at(-1) ?? 0;
  return <ChartFrame title="Running total across reshuffles">
    <figure className="trl-mc-fan">
      <div className="trl-balance-chart__body">
        <div className="trl-balance-chart__y-axis" aria-hidden="true"><span>{band.high.toFixed(2)}</span><span>{band.low.toFixed(2)}</span></div>
        <div className="trl-balance-chart__plot trl-mc-fan__plot" role="img" aria-label={`Cumulative closed-trade P/L for ${fan.paths.length} reshuffled paths, the median path, and your actual order, from 0 to ${lastEvent} trades.`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {showBand && <polygon className="trl-mc-fan__band" points={band.band} />}
            {band.paths.map((points, index) => <polyline key={fan.paths[index]?.path_index ?? index} className="trl-mc-fan__path" points={points} vectorEffect="non-scaling-stroke" />)}
            <polyline className="trl-mc-fan__median" points={band.median} vectorEffect="non-scaling-stroke" />
            <polyline className="trl-mc-fan__historical" points={band.historical} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>Trade 0</span><span>Trade {lastEvent}</span></div>
      <figcaption className="trl-m0__note">
        <span className="trl-mc-fan__key" /> {fan.paths.length} reshuffled paths <span className="trl-mc-fan__key is-median" /> median path <span className="trl-mc-fan__key is-historical" /> your actual order ({result.currency}).{showBand && <> <span className="trl-mc-fan__key is-band" /> middle 90% of all paths.</>}
        <label className="trl-mc-fan__toggle"><input type="checkbox" checked={showBand} onChange={() => setShowBand(!showBand)} /> also shade the middle 90% of all paths</label>
      </figcaption>
    </figure>
  </ChartFrame>;
}
