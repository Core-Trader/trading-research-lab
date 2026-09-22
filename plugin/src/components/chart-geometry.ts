/**
 * Display geometry for line charts. Values are Core-supplied decimal strings;
 * they are converted to numbers only to place points on screen. Labels shown
 * to the user always come from the original strings, never from these numbers.
 */
export type LineGeometry = {
  /** SVG polyline points in a 0–100 by 0–100 box, y pointing down. */
  polyline: string;
  /** Per-point position as percentages of the plot area. */
  positions: Array<{ x: number; y: number }>;
  highIndex: number;
  lowIndex: number;
  /** Vertical position (percent) of the first point, used as a reference line. */
  firstY: number;
};

const TOP_PADDING = 5;
const PLOT_HEIGHT = 90;

export function lineGeometry(values: readonly string[]): LineGeometry | null {
  if (values.length < 2) return null;
  const numbers = values.map((value) => Number(value));
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  let highIndex = 0;
  let lowIndex = 0;
  numbers.forEach((value, index) => {
    if (value > numbers[highIndex]!) highIndex = index;
    if (value < numbers[lowIndex]!) lowIndex = index;
  });
  const high = numbers[highIndex]!;
  const low = numbers[lowIndex]!;
  const range = high - low;
  const yFor = (value: number): number => range === 0 ? 50 : TOP_PADDING + ((high - value) / range) * PLOT_HEIGHT;
  const positions = numbers.map((value, index) => ({ x: (index / (numbers.length - 1)) * 100, y: yFor(value) }));
  return {
    polyline: positions.map((point) => `${round(point.x)},${round(point.y)}`).join(" "),
    positions,
    highIndex,
    lowIndex,
    firstY: positions[0]!.y,
  };
}

/** Index of the point nearest a horizontal fraction (0–1) of evenly spaced points. */
export function nearestIndex(fraction: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * (count - 1));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
