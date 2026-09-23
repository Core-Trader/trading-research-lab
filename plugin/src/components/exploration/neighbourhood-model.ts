/**
 * Display mapping for the neighbourhood panel. Coverage, statistics, flags,
 * and cell values are Core results (exploration.neighbourhood); this module
 * only chooses defaults, words, and heatmap shading.
 */
import type { NeighbourhoodResult, NeighbourhoodRole, NeighbourhoodSettings, NeighbourhoodSlice, StudyParameter } from "../../types";

/** Steppable .set parameters start ordinal; everything else must be equal (spec N1). */
export function defaultSettings(parameters: StudyParameter[]): NeighbourhoodSettings {
  const roles: Record<string, NeighbourhoodRole> = {};
  for (const parameter of parameters) roles[parameter.name] = canBeOrdinal(parameter) ? "ORDINAL" : "CATEGORICAL";
  return { roles, radius: 1 };
}

export function canBeOrdinal(parameter: StudyParameter): boolean {
  return parameter.ordinal === true && Number(parameter.step ?? 0) > 0;
}

export function ordinalNames(settings: NeighbourhoodSettings): string[] {
  return Object.entries(settings.roles).filter(([, role]) => role === "ORDINAL").map(([name]) => name);
}

export function coverageText(result: NeighbourhoodResult): string {
  const { coverage, radius } = result;
  const held = coverage.held_equal.length ? `; held equal: ${coverage.held_equal.join(", ")}` : "";
  return `${coverage.tested} of ${coverage.possible} neighbouring settings were tested (±${radius} step${radius === 1 ? "" : "s"}${held}).`;
}

export function statisticsNote(result: NeighbourhoodResult): string {
  const { coverage } = result;
  if (coverage.sufficient) return "Statistics describe the tested neighbours only; untested settings are unknown, not bad.";
  return `Too few tested neighbours for statistics (at least ${coverage.minimum_for_statistics} needed). Save a neighbourhood .set below and run it in MT5 to fill the gap.`;
}

export type HeatCell = { value: string | null; tested: boolean; isCandidate: boolean; shade: number | null; title: string };

/**
 * Shading only: 0 = worst tested value, 1 = best (by direction), so darker is
 * better. Untested cells get no shade and are drawn hatched, never as zero.
 */
export function heatmapCells(slice: NeighbourhoodSlice, direction: "MAX" | "MIN" | null, xLabel: string, yLabel: string): HeatCell[][] {
  const numbers = slice.cells.flat().map((cell) => cell.value === null ? NaN : Number(cell.value)).filter((value) => Number.isFinite(value));
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  return slice.cells.map((row, y) => row.map((cell, x) => {
    const number = cell.value === null ? NaN : Number(cell.value);
    let shade: number | null = null;
    if (Number.isFinite(number)) {
      const position = high > low ? (number - low) / (high - low) : 0.5;
      shade = direction === "MIN" ? 1 - position : position;
    }
    const where = `${xLabel} ${slice.x_values[x]}, ${yLabel} ${slice.y_values[y]}`;
    return { value: cell.value, tested: cell.tested, isCandidate: cell.is_candidate, shade, title: cell.tested ? `${where}: ${cell.value ?? "—"}${cell.is_candidate ? " (selected)" : ""}` : `${where}: not tested` };
  }));
}

/** Suggested save location: next to the study's .set file when its path is known. */
export function suggestedSetPath(setPath: string, filename: string): string {
  const trimmed = setPath.trim();
  const cut = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  return cut >= 0 ? `${trimmed.slice(0, cut + 1)}${filename}` : filename;
}
