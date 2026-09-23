/**
 * Layout for the shared trade-off scatter. Display geometry only: statuses,
 * ranks, and values come from the Core pareto layer and are never derived here.
 */
export type TradeOffStatus = "PARETO" | "DOMINATED" | "CONSTRAINED" | "INCOMPLETE";

export type TradeOffPoint = {
  id: string;
  label: string;
  x: string | null;
  y: string | null;
  size?: string | null;
  status: TradeOffStatus;
  rank?: number | null;
  isDefault?: boolean;
};

export type PlacedPoint = TradeOffPoint & { left: number; top: number; radius: number };

export type ScatterLayout = {
  placed: PlacedPoint[];
  /** Points without a plottable x or y value (listed, never drawn at 0). */
  omitted: TradeOffPoint[];
  xMin: string; xMax: string; yMin: string; yMax: string;
  /** SVG polyline (0–100 box) through PARETO points ordered by x, or "". */
  frontier: string;
};

const PAD = 4;
const MIN_RADIUS = 3;
const MAX_RADIUS = 9;

export function scatterLayout(points: readonly TradeOffPoint[], options: { sizeByValue?: boolean; frontierLine?: boolean } = {}): ScatterLayout | null {
  const usable = points.filter((point) => finite(point.x) && finite(point.y));
  const omitted = points.filter((point) => !(finite(point.x) && finite(point.y)));
  if (usable.length === 0) return null;
  const xs = usable.map((point) => Number(point.x));
  const ys = usable.map((point) => Number(point.y));
  const xLow = indexOfExtreme(xs, (a, b) => a < b);
  const xHigh = indexOfExtreme(xs, (a, b) => a > b);
  const yLow = indexOfExtreme(ys, (a, b) => a < b);
  const yHigh = indexOfExtreme(ys, (a, b) => a > b);
  const xSpan = xs[xHigh]! - xs[xLow]!;
  const ySpan = ys[yHigh]! - ys[yLow]!;
  const sizes = usable.map((point) => options.sizeByValue && finite(point.size) ? Math.abs(Number(point.size)) : null);
  const largest = Math.max(0, ...sizes.map((size) => size ?? 0));
  const placed = usable.map((point, index) => ({
    ...point,
    left: xSpan === 0 ? 50 : PAD + ((xs[index]! - xs[xLow]!) / xSpan) * (100 - 2 * PAD),
    top: ySpan === 0 ? 50 : PAD + ((ys[yHigh]! - ys[index]!) / ySpan) * (100 - 2 * PAD),
    radius: sizes[index] === null || largest === 0 ? 4.5 : MIN_RADIUS + Math.sqrt(sizes[index]! / largest) * (MAX_RADIUS - MIN_RADIUS),
  }));
  const frontierPoints = options.frontierLine ? placed.filter((point) => point.status === "PARETO").sort((a, b) => a.left - b.left || a.top - b.top) : [];
  return {
    placed,
    omitted,
    xMin: usable[xLow]!.x!, xMax: usable[xHigh]!.x!, yMin: usable[yLow]!.y!, yMax: usable[yHigh]!.y!,
    frontier: frontierPoints.length > 1 ? frontierPoints.map((point) => `${round(point.left)},${round(point.top)}`).join(" ") : "",
  };
}

/** Nearest placed point to a pointer position given in pixels within the plot. */
export function nearestPoint(placed: readonly PlacedPoint[], pixelX: number, pixelY: number, width: number, height: number, maxDistance = 14): PlacedPoint | null {
  let best: PlacedPoint | null = null;
  let bestDistance = maxDistance * maxDistance;
  for (const point of placed) {
    const dx = (point.left / 100) * width - pixelX;
    const dy = (point.top / 100) * height - pixelY;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

/** Keyboard order: left to right, then top to bottom. */
export function keyboardOrder(placed: readonly PlacedPoint[]): PlacedPoint[] {
  return [...placed].sort((a, b) => a.left - b.left || a.top - b.top || a.id.localeCompare(b.id));
}

function finite(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim() !== "" && Number.isFinite(Number(value));
}

function indexOfExtreme(values: number[], better: (a: number, b: number) => boolean): number {
  let chosen = 0;
  values.forEach((value, index) => { if (better(value, values[chosen]!)) chosen = index; });
  return chosen;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
