import React, { useMemo } from "react";
import type { FixedCostScenarioResult, MonteCarloResult } from "../../types";
import { CollapsibleSection } from "../collapsible-section";
import { multiLineGeometry } from "../chart-geometry";

export function WhatIfAnalysis({ cost, error, result, enabled, onCostChange, onRun }: {
  cost: string;
  error: string | null;
  result: FixedCostScenarioResult | null;
  enabled: boolean;
  onCostChange: (value: string) => void;
  onRun: () => void;
}): React.ReactElement {
  const currency = result?.currency ?? "source currency";
  return <CollapsibleSection title="What-If scenario" defaultOpen>
    <p className="trl-m0__note">M6 applies a declared extra fixed cost to every verified close event. It does not forecast trading results or model spread, slippage, equity, or position sizing.</p>
    <label className="trl-m0__field">
      <span>Additional cost per verified close event</span>
      <input type="text" inputMode="decimal" value={cost} onChange={(event) => onCostChange(event.currentTarget.value)} placeholder="0.00" />
    </label>
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    <p className="trl-m0__note">Use a non-negative decimal in the report currency. Run M2 trade analysis first to establish the verified close-event input.</p>
    <button type="button" disabled={!enabled || !cost.trim()} onClick={onRun}>Run M6 fixed-cost scenario</button>
    {result && <section className="trl-m0__analysis-result">
      <h4>Fixed-cost sensitivity result</h4>
      <dl className="trl-m0__diagnostic-grid">
        <dt>Analysis basis</dt><dd><code>{result.analysis_basis}</code></dd>
        <dt>Policy</dt><dd><code>{result.policy_id}</code></dd>
        <dt>Input artifact</dt><dd><code>{result.configuration.input_artifact}</code></dd>
        <dt>Declared additional cost</dt><dd><code>{result.configuration.additional_cost_per_close_event} {currency}</code> per verified close event</dd>
        <dt>Event count</dt><dd>{result.source_summary.count}</dd>
        <dt>Source net P/L</dt><dd><code>{result.source_summary.net_pnl} {currency}</code></dd>
        <dt>Scenario net P/L</dt><dd><code>{result.scenario_summary.net_pnl} {currency}</code></dd>
        <dt>Scenario difference</dt><dd><code>{result.net_pnl_delta} {currency}</code></dd>
        <dt>Source win / loss / breakeven</dt><dd>{result.source_summary.win_count} / {result.source_summary.loss_count} / {result.source_summary.breakeven_count}</dd>
        <dt>Scenario win / loss / breakeven</dt><dd>{result.scenario_summary.win_count} / {result.scenario_summary.loss_count} / {result.scenario_summary.breakeven_count}</dd>
        <dt>Artifact</dt><dd><code>{result.artifacts.table}</code></dd>
        <dt>Warnings</dt><dd>{result.warnings.join(" ")}</dd>
      </dl>
    </section>}
  </CollapsibleSection>;
}

export function MonteCarloAnalysis({ seed, pathCount, error, result, enabled, onSeedChange, onPathCountChange, onRun }: {
  seed: string;
  pathCount: string;
  error: string | null;
  result: MonteCarloResult | null;
  enabled: boolean;
  onSeedChange: (value: string) => void;
  onPathCountChange: (value: string) => void;
  onRun: () => void;
}): React.ReactElement {
  const currency = result?.currency ?? "source currency";
  return <CollapsibleSection title="Monte Carlo order-permutation" defaultOpen>
    <p className="trl-m0__note">This shuffles the order of the same verified historical close-event P/L values. Each path contains every event once; it is not a future-performance forecast.</p>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>Seed</span><input type="text" inputMode="numeric" value={seed} onChange={(event) => onSeedChange(event.currentTarget.value)} /></label>
      <label className="trl-m0__field"><span>Paths (1–10,000)</span><input type="text" inputMode="numeric" value={pathCount} onChange={(event) => onPathCountChange(event.currentTarget.value)} /></label>
    </div>
    {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    <p className="trl-m0__note">The visible default is seed 20260921 and 1,000 paths. The seed is recorded in the result so the exact shuffle can be reproduced.</p>
    <button type="button" disabled={!enabled || !seed.trim() || !pathCount.trim()} onClick={onRun}>Run M6 Monte Carlo shuffle</button>
    {result && <section className="trl-m0__analysis-result">
      <h4>Order-permutation result</h4>
      <dl className="trl-m0__diagnostic-grid">
        <dt>Analysis basis</dt><dd><code>{result.analysis_basis}</code></dd>
        <dt>Method</dt><dd><code>{result.configuration.sampling_method}</code>; <code>{result.configuration.prng}</code></dd>
        <dt>Input artifact</dt><dd><code>{result.configuration.input_artifact}</code></dd>
        <dt>Population / paths</dt><dd>{result.population_count} verified close events / {result.configuration.path_count} paths</dd>
        <dt>Seed</dt><dd><code>{result.configuration.seed}</code></dd>
        <dt>Source total / every path final</dt><dd><code>{result.source_total_close_event_pnl} / {result.invariant_final_pnl} {currency}</code></dd>
        <dt>Observed drawdown: min / p05 / p50</dt><dd><code>{result.drawdown_summary.minimum} / {result.drawdown_summary.p05} / {result.drawdown_summary.p50} {currency}</code></dd>
        <dt>Observed drawdown: p95 / max</dt><dd><code>{result.drawdown_summary.p95} / {result.drawdown_summary.maximum} {currency}</code></dd>
        <dt>Least / worst drawdown path</dt><dd>#{result.least_drawdown_path.path_index} / #{result.worst_drawdown_path.path_index}</dd>
        <dt>Warnings</dt><dd>{result.warnings.join(" ")}</dd>
      </dl>
      <DrawdownHistogram histogram={result.drawdown_histogram} currency={currency} />
      <DrawdownPercentileTable percentiles={result.drawdown_percentiles} currency={currency} />
      <PathFan fan={result.path_fan} currency={currency} />
    </section>}
  </CollapsibleSection>;
}

export function DrawdownHistogram({ histogram, currency }: { histogram: MonteCarloResult["drawdown_histogram"]; currency: string }): React.ReactElement {
  const maximumCount = Math.max(...histogram.buckets.map((bucket) => bucket.count), 1);
  return <section className="trl-m0__histogram" aria-label="Distribution of generated maximum drawdowns">
    <div><h5>Generated drawdown distribution</h5><p>Each bar counts generated paths by maximum cumulative close-event P/L drawdown. This is a descriptive view of this seeded run, not a forecast.</p></div>
    <div className="trl-m0__histogram-bars" role="img" aria-label={`${histogram.bin_count} drawdown distribution bins`}>
      {histogram.buckets.map((bucket, index) => <div className="trl-m0__histogram-bin" key={`${bucket.lower_bound}-${bucket.upper_bound}-${index}`} title={`${bucket.lower_bound} to ${bucket.upper_bound} ${currency}: ${bucket.count} paths`}>
        <span className="trl-m0__histogram-bar" style={{ height: `${Math.max(4, (bucket.count / maximumCount) * 100)}%` }} />
      </div>)}
    </div>
    <div className="trl-m0__histogram-axis"><span>{histogram.buckets[0]?.lower_bound} {currency}</span><span>{histogram.buckets.at(-1)?.upper_bound} {currency}</span></div>
    <p className="trl-m0__note">{histogram.binning.replaceAll("_", " ")} · {histogram.bin_count} bins · hover a bar for its range and path count.</p>
  </section>;
}

export function DrawdownPercentileTable({ percentiles, currency }: { percentiles: MonteCarloResult["drawdown_percentiles"]; currency: string }): React.ReactElement {
  return <section className="trl-mc-percentiles" aria-label="Generated maximum drawdown by percentile">
    <h5>Drawdown percentile table</h5>
    <table>
      <thead><tr><th scope="col">Percentile of generated paths</th><th scope="col">Maximum drawdown ({currency})</th></tr></thead>
      <tbody>{percentiles.map((row) => <tr key={row.percentile}><th scope="row">p{row.percentile}</th><td>{row.maximum_drawdown}</td></tr>)}</tbody>
    </table>
    <p className="trl-m0__note">p95 means 95% of this seeded run's generated paths had a maximum drawdown at or below this value (nearest-rank). It describes these paths only and is not a probability of future losses. Net P/L is identical on every path, so it has no percentile column.</p>
  </section>;
}

export function PathFan({ fan, currency }: { fan: MonteCarloResult["path_fan"]; currency: string }): React.ReactElement {
  const geometry = useMemo(() => multiLineGeometry([fan.historical, ...fan.paths.map((path) => path.values)]), [fan]);
  if (geometry === null) return <p className="trl-m0__inline-error" role="alert">The path fan could not be drawn because a Core value was not numeric.</p>;
  const all = [fan.historical, ...fan.paths.map((path) => path.values)];
  const high = all[geometry.highIndex.line]![geometry.highIndex.point]!;
  const low = all[geometry.lowIndex.line]![geometry.lowIndex.point]!;
  const lastEvent = fan.event_indices.at(-1) ?? 0;
  return <figure className="trl-mc-fan">
    <h5>Generated path fan</h5>
    <div className="trl-balance-chart__body">
      <div className="trl-balance-chart__y-axis" aria-hidden="true"><span>{high}</span><span>{low}</span></div>
      <div className="trl-balance-chart__plot trl-mc-fan__plot" role="img" aria-label={`${fan.paths.length} generated cumulative close-event P/L paths and the historical order, ranging from ${low} to ${high} ${currency}.`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="trl-bars__zero" x1="0" x2="100" y1={geometry.zeroY} y2={geometry.zeroY} vectorEffect="non-scaling-stroke" />
          {geometry.lines.slice(1).map((points, index) => <polyline key={fan.paths[index]!.path_index} className="trl-mc-fan__path" points={points} vectorEffect="non-scaling-stroke" />)}
          <polyline className="trl-mc-fan__historical" points={geometry.lines[0]} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
    <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>0 events</span><span>{lastEvent} events</span></div>
    <figcaption className="trl-m0__note"><span className="trl-mc-fan__key is-historical" /> historical order · <span className="trl-mc-fan__key" /> first {fan.paths.length} generated paths. Cumulative close-event P/L in {currency} from 0; every path ends at the same total. {fan.sampling === "EVEN_INDEX_SAMPLE_V1" && fan.point_count <= lastEvent ? `Drawn from ${fan.point_count} evenly spaced points per path, so brief extremes can be hidden; drawdown figures use the full paths.` : ""} Illustrative only, not a forecast.</figcaption>
  </figure>;
}
