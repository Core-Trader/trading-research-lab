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

export type BarGeometry = {
  /** Zero line position (percent from top). */
  zeroY: number;
  bars: Array<{ x: number; width: number; y: number; height: number; sign: "positive" | "negative" | "zero" }>;
  highIndex: number;
  lowIndex: number;
};

/** Bars around a zero line in a 0–100 box. Signs come from the Core strings. */
export function barGeometry(values: readonly string[]): BarGeometry | null {
  if (values.length === 0) return null;
  const numbers = values.map((value) => Number(value));
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  let highIndex = 0;
  let lowIndex = 0;
  numbers.forEach((value, index) => {
    if (value > numbers[highIndex]!) highIndex = index;
    if (value < numbers[lowIndex]!) lowIndex = index;
  });
  const top = Math.max(0, numbers[highIndex]!);
  const bottom = Math.min(0, numbers[lowIndex]!);
  const range = top - bottom || 1;
  const toY = (value: number): number => TOP_PADDING + ((top - value) / range) * PLOT_HEIGHT;
  const zeroY = toY(0);
  const slot = 100 / numbers.length;
  const width = slot * (numbers.length > 60 ? 0.9 : 0.7);
  return {
    zeroY,
    highIndex,
    lowIndex,
    bars: numbers.map((value, index) => {
      const y = toY(value);
      const sign = value > 0 ? "positive" : value < 0 ? "negative" : "zero";
      return { x: index * slot + (slot - width) / 2, width, y: Math.min(y, zeroY), height: Math.abs(zeroY - y), sign };
    }),
  };
}

export type MultiLineGeometry = { lines: string[]; highIndex: { line: number; point: number }; lowIndex: { line: number; point: number }; zeroY: number };

/** Several equally long series drawn on one shared scale (e.g. a path fan). */
export function multiLineGeometry(series: readonly (readonly string[])[]): MultiLineGeometry | null {
  if (series.length === 0 || series.some((values) => values.length < 2 || values.length !== series[0]!.length)) return null;
  const numbers = series.map((values) => values.map((value) => Number(value)));
  if (numbers.some((values) => values.some((value) => !Number.isFinite(value)))) return null;
  let high = { line: 0, point: 0 };
  let low = { line: 0, point: 0 };
  numbers.forEach((values, line) => values.forEach((value, point) => {
    if (value > numbers[high.line]![high.point]!) high = { line, point };
    if (value < numbers[low.line]![low.point]!) low = { line, point };
  }));
  const top = numbers[high.line]![high.point]!;
  const bottom = numbers[low.line]![low.point]!;
  const range = top - bottom;
  const toY = (value: number): number => range === 0 ? 50 : TOP_PADDING + ((top - value) / range) * PLOT_HEIGHT;
  const last = numbers[0]!.length - 1;
  return {
    lines: numbers.map((values) => values.map((value, index) => `${round((index / last) * 100)},${round(toY(value))}`).join(" ")),
    highIndex: high,
    lowIndex: low,
    zeroY: toY(0),
  };
}

/** Display intensity 0.15–1 for a colour scale; purely visual, never shown as a number. */
export function intensity(value: string, maximumMagnitude: number): number {
  const magnitude = Math.abs(Number(value));
  if (!Number.isFinite(magnitude) || maximumMagnitude <= 0) return 0.15;
  return 0.15 + 0.85 * Math.min(1, magnitude / maximumMagnitude);
}
