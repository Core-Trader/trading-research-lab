/**
 * Interpretation for a return-versus-drawdown Pareto view (Portfolio explorer
 * and saved combinations). Frontier steps, ratios and the diminishing flag
 * come from the Core (shared Pareto frontier_steps); this only words them.
 */
import type { FrontierSteps } from "../../types";
import { roundDecimalString } from "../display-format.ts";
import type { Guidance } from "../advanced/monte-carlo-model.ts";

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export type ParetoPoint = { id: string; label: string; gain: string | null; cost: string | null; status: string; dominatedBy: string | null };

export function paretoGuidance(args: { points: ParetoPoint[]; frontierCount: number; steps: FrontierSteps | null; selectedId: string | null; currency: string; gainLabel: string; costLabel: string }): Guidance {
  const { points, frontierCount, steps, selectedId, currency, gainLabel, costLabel } = args;
  const byId = new Map(points.map((point) => [point.id, point]));
  const read = [
    `Each point is one combination. Across: ${capitalise(costLabel)} (${currency}); up: ${capitalise(gainLabel)} (${currency}). Better is up and to the left.`,
    `${frontierCount} of ${points.length} combinations are on the frontier: for each of them, no other combination has both more ${gainLabel} and less ${costLabel}.`,
    "To choose, start from the drawdown you can accept, find the frontier point at or left of it, and take the highest one. Moving right along the frontier buys profit with drawdown.",
  ];
  const tips: string[] = [];
  const flags = ["These drawdowns are realised balance; open-position drawdown can be deeper. Combined portfolio equity is not available yet."];
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  if (selected && selected.status === "PARETO" && steps) {
    const next = steps.steps.find((step) => step.from_id === selected.id);
    const previous = steps.steps.find((step) => step.to_id === selected.id);
    if (next) {
      const nextLabel = byId.get(next.to_id)?.label ?? next.to_id;
      tips.push(`From ${selected.label}, the next frontier step (${nextLabel}) adds ${r2(next.step_gain)} ${currency} for ${r2(next.step_cost)} ${currency} more drawdown${next.ratio !== null ? `, ${r2(next.ratio)} ${currency} of profit per 1 ${currency} of drawdown` : ""}${previous?.ratio ? `; the step into ${selected.label} gave ${r2(previous.ratio)}` : ""}.`);
      if (next.diminishing === true) tips.push("That step's ratio is lower than the previous one: from here, each extra unit of drawdown buys less profit.");
    } else {
      tips.push(`${selected.label} is the highest-profit end of the frontier: no combination earns more.`);
    }
  } else if (selected && selected.status === "DOMINATED" && selected.dominatedBy) {
    const better = byId.get(selected.dominatedBy);
    if (better) tips.push(`Consider ${better.label}: it has at least as much ${gainLabel} (${r2(better.gain)} ${currency}) with no more ${costLabel} (${r2(better.cost)} ${currency}).`);
  } else if (!selected) {
    tips.push("Select a point to see what moving along the frontier from it gains and costs.");
  }
  return { read, tips, flags };
}
