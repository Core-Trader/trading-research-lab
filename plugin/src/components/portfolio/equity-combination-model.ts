import type { DatasetEvidence, EquityCombination } from "../../types.ts";
import type { WorkflowPoint } from "../help/research-workflow.ts";

/**
 * Reading and tips for the combined equity (PROPOSAL_EQUITY_PORTFOLIO.md E3,
 * E5, E7). Labels: S = sourced (with its source), C = TRL suggestion or TRL
 * method, U = your own threshold. Numbers come from the Core.
 */
export type EquityCombinationGuidance = { read: WorkflowPoint[]; tips: WorkflowPoint[]; flags: WorkflowPoint[] };

const r = (value: string | null): string => value === null ? "—" : Number(value).toFixed(2);

/** Reports in the chosen tracks without a verified equity log (E1), from the library evidence the plugin already has. */
export function reportsWithoutLog(tracks: string[][], byRef: Map<string, DatasetEvidence>): string[] {
  return tracks.flat().filter((ref) => byRef.get(ref)?.equity?.status !== "LINKED_VERIFIED");
}

export function equityCombinationGuidance(result: EquityCombination, labels: string[]): EquityCombinationGuidance {
  const ccy = result.currency;
  const dd = result.equity_drawdown;
  const diversification = result.diversification;
  const read: WorkflowPoint[] = [];
  const tips: WorkflowPoint[] = [];
  const flags: WorkflowPoint[] = [];

  read.push({ label: "C", text: `Combined equity drawdown: between ${r(dd.observed)} and ${r(dd.conservative)} ${ccy}. Each track's low happened at its own moment inside a ${result.grid_minutes}-minute interval, so TRL gives a range: the lower value is what the logs prove happened; the higher value assumes every low coincided.` });
  read.push({ label: "C", text: `Closed-trade (realised) drawdown of the same combination: ${r(result.realised_drawdown)} ${ccy}. Equity drawdown also counts floating losses inside open trades, which the realised figure leaves out.` });
  read.push({ label: "S", source: "playbook", text: `Diversification: the combined conservative drawdown (${r(diversification.combined_conservative)} ${ccy}) against the sum of the tracks' own (${r(diversification.sum_of_tracks)} ${ccy}) and the worst single track (${r(diversification.worst_track)} ${ccy}). A low correlation is not enough; this measures the combined curve itself.` });
  if (result.margin.lowest_level_percent !== null) read.push({ label: "S", source: "mt5TradingReport", text: `Lowest combined margin level: ${r(result.margin.lowest_level_percent)} % (equity ÷ margin × 100, using the conservative low and the summed peak margins).` });
  if (result.worst_day) read.push({ label: "C", text: `Worst day ${result.worst_day.date}: combined equity fell between ${r(result.worst_day.loss_observed)} and ${r(result.worst_day.loss_conservative)} ${ccy} below the start of the day (the higher of balance and equity).` });

  const conservative = Number(diversification.combined_conservative), observed = Number(dd.observed), worst = Number(diversification.worst_track);
  if (conservative < Number(diversification.sum_of_tracks)) tips.push({ label: "C", text: "Even if every low coincided, the combined drawdown stays below the tracks' drawdowns added up: their bad stretches did not fully overlap in this period." });
  else tips.push({ label: "C", text: `The combined drawdown could reach the tracks' drawdowns added up (if their lows coincided); the logs prove at least ${r(dd.observed)} ${ccy}. Check whether the tracks trade the same or related symbols.` });
  if (observed > worst) tips.push({ label: "C", text: "Combining made the drawdown larger than any single track's, even on the proven (observed) value. Compare subsets in \"Explore combinations\" to see which track adds the most risk." });
  else if (conservative > worst) tips.push({ label: "C", text: "The combined drawdown may be larger than the worst single track's: only the conservative bound says so. A shorter log interval would settle it." });
  if (Number(dd.conservative) > Number(dd.observed)) tips.push({ label: "C", text: "To narrow the range, log with a shorter interval (for example M1): the lows are then pinned to smaller windows." });
  if (result.configuration.stop_out_level === null) tips.push({ label: "U", text: "Enter your broker's stop-out level to see whether any interval's combined margin level fell below it." });
  else if (result.margin.intervals_below_stop_out) tips.push({ label: "U", text: `${result.margin.intervals_below_stop_out} interval(s) fell below your stop-out level of ${r(result.configuration.stop_out_level)} %: on one real account those positions could have been closed.` });

  flags.push({ label: "C", text: "Separate backtests never shared one account: no margin call or stop-out was simulated, and trades that one account could not have opened are still included." });
  flags.push({ label: "C", text: `Tracks: ${labels.join(", ")}. Lots are as reported; each track adds its equity change from its own deposit to your starting capital.` });
  for (const finding of result.findings) flags.push({ label: "C", text: finding.message });
  return { read, tips, flags };
}
