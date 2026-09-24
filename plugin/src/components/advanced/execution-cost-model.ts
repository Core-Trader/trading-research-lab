import type { ExecutionCostResult } from "../../types.ts";
import type { WorkflowPoint } from "../help/research-workflow.ts";

/**
 * Reading and tips for extra execution costs (PROPOSAL_EXECUTION_COSTS.md X5–X7).
 * Labels: S = sourced (with its source), C = TRL suggestion, U = your own
 * assumption. Numbers come from the Core; this module only chooses and words them.
 */
export type ExecutionCostGuidance = { read: WorkflowPoint[]; tips: WorkflowPoint[]; flags: WorkflowPoint[] };

const r = (value: string | null): string => value === null ? "—" : Number(value).toFixed(2);

export function executionCostGuidance(result: ExecutionCostResult): ExecutionCostGuidance {
  const ccy = result.currency ?? "";
  const read: WorkflowPoint[] = [];
  const tips: WorkflowPoint[] = [];
  const flags: WorkflowPoint[] = [];

  if (result.break_even_per_lot !== null) read.push({ label: "C", text: `Break-even: the result reaches zero if every deal costs an extra ${r(result.break_even_per_lot)} ${ccy} per lot (${r(result.lots_dealt)} lots dealt in total). Below that, the report stays profitable.` });
  else read.push({ label: "C", text: "The report is not profitable before any extra cost, so there is no break-even margin to spend on execution." });
  if (result.after) {
    read.push({ label: "U", text: `With your assumptions the extra costs total ${r(result.after.extra_cost_total)} ${ccy}: the balance change goes from ${r(result.before.balance_change)} to ${r(result.after.balance_change)} ${ccy}, and the maximum drawdown from ${r(result.before.max_drawdown)} to ${r(result.after.max_drawdown)} ${ccy}.` });
    read.push({ label: "C", text: "Per-trade figures charge each closed volume a round turn (its opening and its closing deal), because positions close the volume they opened." });
  }
  read.push({ label: "S", source: "mt5Ticks", text: "A test on \"Every tick based on real ticks\" already paid the recorded, varying spread; these extra costs come on top of it (a wider broker spread, news, slippage). Generated ticks use one fixed spread per minute bar." });

  if (result.break_even_per_lot !== null) tips.push({ label: "S", source: "mt5MarketWatch", text: `Compare the break-even (${r(result.break_even_per_lot)} ${ccy} per lot per deal) with your broker's spread in the symbol specification (Market Watch → Specification). The helper converts extra points to money per lot from its tick size and tick value.` });
  if (result.after && Number(result.after.balance_change) <= 0 && Number(result.before.balance_change) > 0) tips.push({ label: "C", text: "Your assumed costs remove the whole edge. A per-lot cost grows with volume, so only a tighter spread or better fills help: compare account types or brokers for this symbol." });
  if (!result.applied) tips.push({ label: "U", text: "All cost parameters are optional. Enter an extra spread and/or slippage per lot (for all symbols or per symbol) to see their effect." });
  tips.push({ label: "S", source: "mt5Testing", text: "To test execution delay, run the same test in MT5 with a random delay (0 to 18 seconds; 90 % of delays are 8 seconds or less) and import it; compare it with the zero-delay report. For pending orders MT5 delays only the placing, not the fill." });

  if (!result.round_turn_check.consistent) flags.push({ label: "C", text: `Opened and closed volumes differ, so the per-trade figures charge ${r(result.round_turn_check.round_turn_total)} ${ccy} against ${r(result.round_turn_check.per_deal_total)} ${ccy} charged on the balance.` });
  flags.push({ label: "C", text: "Every cost here is your own assumption; TRL does not know your broker's live spreads or fills." });
  return { read, tips, flags };
}
