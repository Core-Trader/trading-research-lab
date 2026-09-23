/**
 * Chart geometry for the equity evidence panel. Values come from the Core
 * (analysis.equity_metrics display_series); this module only scales them.
 */
export type EquityPoint = { time: string; balance: string; equity_close: string; equity_min: string; equity_max: string };
export type EquityGeometry = { balance: string; equity: string; band: string; low: string; high: string };

/** SVG paths in a 0–100 viewBox: balance and equity lines plus the min–max band. */
export function equityGeometry(points: EquityPoint[]): EquityGeometry | null {
  if (points.length === 0) return null;
  const values = points.flatMap((point) => [Number(point.balance), Number(point.equity_min), Number(point.equity_max)]);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (index: number): number => points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
  const y = (value: string): number => 100 - ((Number(value) - low) / span) * 100;
  const line = (key: keyof EquityPoint): string => points.map((point, index) => `${x(index).toFixed(3)},${y(point[key]).toFixed(3)}`).join(" ");
  const upper = points.map((point, index) => `${x(index).toFixed(3)},${y(point.equity_max).toFixed(3)}`);
  const lower = points.map((point, index) => `${x(index).toFixed(3)},${y(point.equity_min).toFixed(3)}`).reverse();
  return { balance: line("balance"), equity: line("equity_close"), band: [...upper, ...lower].join(" "), low: String(low), high: String(high) };
}
