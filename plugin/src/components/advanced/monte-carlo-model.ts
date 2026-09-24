/**
 * Monte Carlo display mapping and interpretation text. Every value and every
 * comparison (rank, deeper/shallower, share of balance, equity ratio) comes
 * from the Core result; this module only positions and words them.
 */
import type { EquityMetrics, MonteCarloResult } from "../../types";
import { roundDecimalString } from "../display-format.ts";

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);

export type Guidance = { read: string[]; tips: string[]; flags: string[] };

/** Percent position (0–100) of a value on the [low, high] axis; display scaling only. */
export function axisPosition(value: string, low: string, high: string): number {
  const span = Number(high) - Number(low);
  if (!Number.isFinite(span) || span <= 0) return 50;
  return Math.min(100, Math.max(0, ((Number(value) - Number(low)) / span) * 100));
}

export type StripMarker = { key: string; label: string; value: string; position: number; emphasis: boolean };

/** Markers for the percentile strip: min, p05, p50, p95, max, and the historical order. */
export function stripMarkers(result: MonteCarloResult): StripMarker[] {
  const summary = result.drawdown_summary;
  const low = summary.minimum;
  const high = summary.maximum;
  const marker = (key: string, label: string, value: string, emphasis = false): StripMarker => ({ key, label, value, position: axisPosition(value, low, high), emphasis });
  return [
    marker("min", "Best", summary.minimum),
    marker("p05", "5%", summary.p05),
    marker("p50", "Median", summary.p50),
    marker("p95", "95%", summary.p95),
    marker("max", "Worst", summary.maximum),
    marker("historical", "Your order", result.historical.maximum_drawdown, true),
  ];
}

/** Band geometry (0–100 viewBox) for p05–p95, the median, the historical path and, optionally, sample paths, on one scale. */
export function fanBandGeometry(result: MonteCarloResult, withPaths = false): { band: string; median: string; historical: string; paths: string[]; low: number; high: number } | null {
  const bands = result.fan_bands;
  const historical = result.path_fan.historical;
  if (bands.p05.length < 2 || historical.length !== bands.p05.length) return null;
  const samples = withPaths ? result.path_fan.paths.map((path) => path.values).filter((values) => values.length === bands.p05.length) : [];
  const values = [...bands.p05, ...bands.p95, ...historical, ...samples.flat()].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (index: number): string => ((index / (bands.p05.length - 1)) * 100).toFixed(3);
  const y = (value: string): string => (100 - ((Number(value) - low) / span) * 100).toFixed(3);
  const line = (series: string[]): string => series.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const upper = bands.p95.map((value, index) => `${x(index)},${y(value)}`);
  const lower = bands.p05.map((value, index) => `${x(index)},${y(value)}`).reverse();
  return { band: [...upper, ...lower].join(" "), median: line(bands.p50), historical: line(historical), paths: samples.map(line), low, high };
}

/** "How to read this" and tips; each sentence is filled from Core fields only. */
export function monteCarloGuidance(result: MonteCarloResult, equity: EquityMetrics | null): Guidance {
  const ccy = result.currency;
  const summary = result.drawdown_summary;
  const historical = result.historical;
  const bands = result.fan_bands;
  const read = [
    `Each of the ${result.configuration.path_count} paths replays your same ${result.population_count} closed trades in a different order. Every path ends at the same total (${r2(result.invariant_final_pnl)} ${ccy}); only the drawdown along the way changes.`,
    `Half of the reorderings had a worst drawdown of ${r2(summary.p50)} ${ccy} or less, 95% had ${r2(summary.p95)} ${ccy} or less, and the worst had ${r2(summary.maximum)} ${ccy}.`,
    Number(historical.rank_percent) === 0
      ? `Your actual trade order had a worst drawdown of ${r2(historical.maximum_drawdown)} ${ccy}; none of the reorderings had a smaller one.`
      : `Your actual trade order had a worst drawdown of ${r2(historical.maximum_drawdown)} ${ccy}, deeper than ${r2(historical.rank_percent)}% of the reorderings.`,
    `At each point the middle 90% of all paths covers a range of running totals (tick the shading option to see it). That range is widest after trade ${bands.widest_at_event}, where it spans ${r2(bands.widest_band)} ${ccy}: the order in which trades arrive moves the running total by up to that much.`,
    "These drawdowns are measured on closed-trade P/L from zero, not account equity.",
  ];
  const tips: string[] = [];
  const flags: string[] = [];
  if (result.account.p95_percent_of_opening !== null && result.account.opening_balance !== null) {
    tips.push(`At this report's size, the 95th-percentile drawdown is ${r2(result.account.p95_percent_of_opening)}% of the starting balance (${r2(result.account.opening_balance)} ${ccy}). If that is more than you would accept, reduce position size in proportion: only the order of fixed trade results changes here, so these drawdowns scale with lot size.`);
  } else {
    flags.push("Share of the starting balance: not shown, because the report has no opening-balance row.");
  }
  if (historical.vs_median === "DEEPER") tips.push(`Your real order drew down more than the median reordering (${r2(summary.p50)} ${ccy}): the history was less fortunate than a typical ordering of the same trades.`);
  else if (historical.vs_median === "SHALLOWER") tips.push(`Your real order drew down less than the median reordering (${r2(summary.p50)} ${ccy}): the same trades in a typical order would have drawn down more.`);
  else tips.push(`Your real order's drawdown equals the median reordering (${r2(summary.p50)} ${ccy}).`);
  if (equity !== null && equity.equity_deeper_than_balance && equity.equity_to_balance_drawdown_ratio !== null) {
    tips.push(`This report's equity drawdown was ${r2(equity.equity_to_balance_drawdown_ratio)}× its closed-trade drawdown, so the drawdowns above understate open-position risk.`);
  } else if (equity === null) {
    flags.push("Open-position (equity) risk: attach an equity log to this report to compare it with these closed-trade drawdowns.");
  }
  flags.push("Prop-firm limit comparison: available with the prop-firm module, which needs your firm's limits and equity data.");
  return { read, tips, flags };
}
