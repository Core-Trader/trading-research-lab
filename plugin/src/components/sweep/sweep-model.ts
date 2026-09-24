/**
 * Symbol scan display model. Values and frontier statuses are Core results
 * (MT5-reported metrics kept as exported); this module formats, sorts, and
 * scales them for display only.
 */
import type { SweepComparison, SweepEvaluation, SweepMetric, SweepRow, SymbolSweep } from "../../types";
import { money, num } from "../display-format.ts";

/** Display a reported metric by its unit (2 decimals; whole counts unchanged). */
export function metricText(metric: SweepMetric | undefined, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  if (!metric) return num(text);
  if (metric.unit === "currency" || metric.unit === "currency per trade") return money(text);
  if (metric.unit === "percent") return `${num(text)}%`;
  return num(text);
}

export type SortState = { key: string; direction: "asc" | "desc" };

/** Sort rows by symbol or a metric (numeric); missing values always last. Stable by symbol. */
export function sortRows(rows: SweepRow[], sort: SortState): SweepRow[] {
  const value = (row: SweepRow): number | string | null => {
    if (sort.key === "symbol") return row.symbol;
    const raw = row[sort.key];
    const number = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    return Number.isFinite(number) ? number : null;
  };
  return [...rows].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    if (a === null || b === null) return a === null && b === null ? left.symbol.localeCompare(right.symbol) : a === null ? 1 : -1;
    const order = typeof a === "string" ? a.localeCompare(String(b)) : a - (b as number);
    return (sort.direction === "asc" ? order : -order) || left.symbol.localeCompare(right.symbol);
  });
}

/** 0 (worst) … 1 (best) shading per cell for one metric across the whole grid; null when untested or non-numeric. */
export function shadeMatrix(comparison: SweepComparison, direction: "MAX" | "MIN" | null): Array<Array<number | null>> {
  const numbers = comparison.matrix.flatMap((row) => row.values.map((value) => value === null ? NaN : Number(value))).filter((value) => Number.isFinite(value));
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  return comparison.matrix.map((row) => row.values.map((value) => {
    const number = value === null ? NaN : Number(value);
    if (!Number.isFinite(number) || direction === null) return null;
    const position = high > low ? (number - low) / (high - low) : 0.5;
    return direction === "MIN" ? 1 - position : position;
  }));
}

export function sweepLabel(sweep: SymbolSweep): string {
  const context = sweep.context;
  return `${context.expert ?? sweep.source.filename} · ${context.timeframe ?? "?"} ${context.start ?? "?"}–${context.end ?? "?"}`;
}

export const STATUS_TEXT: Record<SweepRow["pareto"]["status"], string> = {
  PARETO: "On the frontier",
  DOMINATED: "Dominated",
  CONSTRAINED: "Fails a filter",
  INCOMPLETE: "Missing a value",
};

export type Guidance = { read: string[]; tips: string[]; flags: string[] };

/** Reading of one evaluated sweep; wording of Core fields only. */
export function sweepGuidance(evaluation: SweepEvaluation, xLabel: string, yLabel: string): Guidance {
  const counts = evaluation.counts;
  const sweep = evaluation.sweep;
  const read = [
    `Each point is one symbol: the same EA and inputs, run once per symbol by MT5. Across: ${xLabel}; up: ${yLabel}.`,
    `${counts.PARETO ?? 0} of ${evaluation.rows.length} symbols are on the frontier: no other symbol is better on both axes. ${counts.CONSTRAINED ? `${counts.CONSTRAINED} fail your filters and are drawn hollow.` : ""}`.trim(),
  ];
  const tips = [
    "Shortlist a few symbols, then re-test each one with \"Every tick based on real ticks\" and your broker's commissions before trusting it (Research workflow, step 3).",
  ];
  const flags: string[] = [];
  if (sweep.zero_trade_symbols.length > 0) flags.push(`No trades on ${sweep.zero_trade_symbols.join(", ")}: kept in the table, but they tell you nothing about the EA.`);
  if (!sweep.declared_set) flags.push("No .set was attached, so the inputs this sweep used are not recorded.");
  if (/ohlc|open price/i.test(sweep.modelling_mode)) flags.push(`Modelling mode "${sweep.modelling_mode}": stops and pending orders fill at exactly the requested price in this mode, so results are optimistic for stop-based EAs.`);
  flags.push("Scanning many symbols makes it likely that some look good by luck.");
  return { read, tips, flags };
}

export const MODE_SUGGESTIONS = ["Every tick based on real ticks", "Every tick", "1 minute OHLC", "Open prices only"];
