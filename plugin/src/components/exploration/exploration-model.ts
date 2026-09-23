/**
 * Display mapping for parameter exploration. All statuses and values are Core
 * results (exploration.evaluate); this module only chooses what to show.
 */
import type { Objective, ParameterEvaluation, StudyMetric } from "../../types";
import type { TradeOffPoint } from "../tradeoff/scatter-layout";

type Candidate = ParameterEvaluation["candidates"][number];

/** Initial objectives: MT5 net profit up and equity drawdown down when present. */
export function defaultObjectives(metrics: StudyMetric[]): Objective[] {
  const preferred = ["net_profit", "equity_drawdown_pct"]
    .map((id) => metrics.find((metric) => metric.id === id))
    .filter((metric): metric is StudyMetric => metric !== undefined && metric.default_direction !== null);
  const chosen = preferred.length === 2 ? preferred : metrics.filter((metric) => metric.default_direction !== null).slice(0, 2);
  return chosen.map((metric) => ({ metric: metric.id, direction: metric.default_direction! }));
}

/** The frontier line is only drawn when the plotted axes are exactly the two objectives. */
export function frontierMatchesAxes(objectives: Objective[], x: string, y: string): boolean {
  return objectives.length === 2 && x !== y && objectives.some((objective) => objective.metric === x) && objectives.some((objective) => objective.metric === y);
}

/** Axis ids with this prefix read the candidate's matched forward (out-of-sample) metrics. */
export const FORWARD_PREFIX = "forward:";

export function metricValue(candidate: Candidate, id: string): string | null {
  return id.startsWith(FORWARD_PREFIX) ? candidate.forward?.metrics[id.slice(FORWARD_PREFIX.length)] ?? null : candidate.metrics[id] ?? null;
}

/** Plottable metrics: the study's, then the forward export's when one is attached. */
export function axisOptions(evaluation: ParameterEvaluation | null, metrics: StudyMetric[]): Array<{ id: string; label: string }> {
  const own = metrics.map((metric) => ({ id: metric.id, label: metric.label }));
  const forward = evaluation?.forward?.metrics.map((metric) => ({ id: FORWARD_PREFIX + metric.id, label: `Forward: ${metric.label}` })) ?? [];
  return [...own, ...forward];
}

export function betterHint(axisId: string, objectives: Objective[], metrics: StudyMetric[]): "higher" | "lower" | undefined {
  const metricId = axisId.startsWith(FORWARD_PREFIX) ? axisId.slice(FORWARD_PREFIX.length) : axisId;
  const direction = objectives.find((objective) => objective.metric === metricId)?.direction ?? metrics.find((metric) => metric.id === metricId)?.default_direction ?? null;
  return direction === "MAX" ? "higher" : direction === "MIN" ? "lower" : undefined;
}

export function scatterPoints(evaluation: ParameterEvaluation, x: string, y: string, size: string | null): TradeOffPoint[] {
  return evaluation.candidates.map((candidate) => ({
    id: candidate.id,
    label: candidateLabel(candidate),
    x: metricValue(candidate, x),
    y: metricValue(candidate, y),
    size: size ? metricValue(candidate, size) : undefined,
    status: candidate.pareto.status,
    rank: candidate.pareto.rank,
    isDefault: candidate.is_default,
  }));
}

export type CompareColumn = { key: string; title: string; candidate: Candidate | null };
export type CompareRow = { label: string; kind: "parameter" | "metric" | "forward" | "status"; cells: Array<{ value: string; differs: boolean }> };

/**
 * DEFAULT versus pinned candidates. The default column uses the .set signature
 * for parameters and, when the default was not among the passes, "not tested"
 * for metrics. With a forward export attached, its metrics follow as
 * "Forward: …" rows (only optimisation passes can have a forward match).
 */
export function compareTable(evaluation: ParameterEvaluation, pinnedIds: string[]): { columns: CompareColumn[]; rows: CompareRow[] } {
  const byId = new Map(evaluation.candidates.map((candidate) => [candidate.id, candidate]));
  const signature = evaluation.study.default.signature;
  const defaultCandidate = evaluation.candidates.find((candidate) => candidate.is_default) ?? null;
  const columns: CompareColumn[] = [];
  if (signature || defaultCandidate) columns.push({ key: "default", title: "★ Default", candidate: defaultCandidate });
  for (const id of pinnedIds) {
    const candidate = byId.get(id);
    if (candidate && !candidate.is_default) columns.push({ key: id, title: candidateLabel(candidate), candidate });
  }
  const names = evaluation.study.parameters.map((parameter) => parameter.name);
  const parameterValue = (column: CompareColumn, name: string): string => column.candidate?.parameters[name] ?? (column.key === "default" ? signature?.[name] ?? "—" : "—");
  const same = (a: string, b: string): boolean => a === b || (Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) === Number(b));
  const rows: CompareRow[] = names.map((name) => {
    const reference = columns[0] ? parameterValue(columns[0], name) : "—";
    return { label: name, kind: "parameter", cells: columns.map((column) => { const value = parameterValue(column, name); return { value, differs: column.key !== "default" && columns[0]?.key === "default" && !same(value, reference) }; }) };
  });
  for (const metric of evaluation.study.metrics) {
    rows.push({ label: metric.label, kind: "metric", cells: columns.map((column) => ({ value: column.candidate ? column.candidate.metrics[metric.id] ?? "—" : "not tested", differs: false })) });
  }
  for (const metric of evaluation.forward?.metrics ?? []) {
    rows.push({ label: `Forward: ${metric.label}`, kind: "forward", cells: columns.map((column) => ({ value: !column.candidate ? "not tested" : column.candidate.forward ? column.candidate.forward.metrics[metric.id] ?? "—" : "no forward match", differs: false })) });
  }
  rows.push({ label: "Status", kind: "status", cells: columns.map((column) => ({ value: column.candidate ? statusText(column.candidate) : "not in this optimisation", differs: false })) });
  return { columns, rows };
}

export function candidateLabel(candidate: Candidate): string {
  return candidate.label ?? `Pass ${candidate.pass ?? "?"}`;
}

export function statusText(candidate: Candidate): string {
  const pareto = candidate.pareto;
  if (pareto.status === "PARETO") return "Pareto frontier";
  if (pareto.status === "DOMINATED") return `Dominated by ${pareto.dominated_by_count} (front ${pareto.rank})`;
  if (pareto.status === "CONSTRAINED") return "Fails " + pareto.violations.map((violation) => `${violation.metric} ${violation.operator} ${violation.threshold}`).join(", ");
  return "Missing a value";
}
