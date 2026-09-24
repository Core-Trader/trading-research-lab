import type { CostBreakdown } from "../../types.ts";
import type { WorkflowPoint } from "../help/research-workflow.ts";

/**
 * Reading and tips for the Costs section (PROPOSAL_COST_BREAKDOWN.md C4, C5).
 * Labels: S = sourced (with its source), C = TRL suggestion. Numbers come
 * from the Core; this module only chooses and words them.
 */
export type CostGuidance = { read: WorkflowPoint[]; tips: WorkflowPoint[]; flags: WorkflowPoint[] };

const r = (value: string | null): string => value === null ? "—" : Number(value).toFixed(2);
const nonZero = (value: string): boolean => Number(value) !== 0;

export function costGuidance(result: CostBreakdown): CostGuidance {
  const ccy = result.currency ?? "";
  const summary = result.summary;
  const read: WorkflowPoint[] = [];
  const tips: WorkflowPoint[] = [];
  const flags: WorkflowPoint[] = [];

  read.push({ label: "S", source: "mt5Testing", text: `MT5 can charge commission per deal or per lot, when a position opens and/or when it closes. In this report: ${r(summary.commission_open)} ${ccy} on opening deals and ${r(summary.commission_close)} ${ccy} on closing deals.` });
  read.push({ label: "C", text: `Trade result before costs ${r(summary.trade_result_before_costs)} ${ccy}; costs ${r(summary.costs)} ${ccy} (commissions and net swap); net ${r(summary.net)} ${ccy}.` });
  if (result.reconciliation.status === "MATCHES") read.push({ label: "C", text: `Opening balance plus every component equals the report's final balance (${r(result.reconciliation.reported_final)} ${ccy}) to the cent.` });
  if (nonZero(result.per_trade_exclusion.amount)) read.push({ label: "C", text: `Per-trade figures (win rate, expectancy, SQN, the significance test) use the closing deal only, so ${r(result.per_trade_exclusion.amount)} ${ccy} on opening deals is left out of them: about ${r(result.per_trade_exclusion.per_closed_trade)} ${ccy} per closed trade. The balance change includes it.` });

  if (result.intensity.cost_share_percent !== null) tips.push({ label: "C", text: `Costs take ${r(result.intensity.cost_share_percent)} % of the result before costs. On Advanced → What-If, adding an extra cost per trade equal to today's average (${r(result.intensity.cost_per_closed_trade)} ${ccy}) shows the result if costs doubled, for example with a costlier broker or account type.` });
  else if (Number(summary.costs) < 0) tips.push({ label: "C", text: `Swaps credited exceeded commissions and swaps charged, so costs added ${r(String(-Number(summary.costs)))} ${ccy} to the result. Swap rates differ between brokers and change over time; the same EA elsewhere could pay swaps instead.` });
  else if (Number(summary.trade_result_before_costs) <= 0) tips.push({ label: "C", text: "The trades lost money before costs, so costs are not what makes this report unprofitable." });
  if (Number(summary.swap_charged) < Number(summary.commissions)) tips.push({ label: "C", text: `Swaps charged (${r(summary.swap_charged)} ${ccy}) cost more than commissions (${r(summary.commissions)} ${ccy}): holding positions overnight drives the costs here, so shorter holding times or swap-free account types would matter more than a cheaper commission.` });
  const shares = result.by_symbol.filter((row) => row.cost_share_percent !== null);
  if (shares.length > 1) {
    const top = shares.reduce((best, row) => Number(row.cost_share_percent) > Number(best.cost_share_percent) ? row : best);
    tips.push({ label: "C", text: `Costs take the largest share on ${top.symbol} (${r(top.cost_share_percent)} %). Symbols with wide spreads or high commission per lot need a larger edge per trade.` });
  }
  if (nonZero(result.per_trade_exclusion.amount)) tips.push({ label: "C", text: "When you read the significance interval for the average trade, remember it is before opening commissions; the average all-in trade is lower by the amount above." });

  if (result.reconciliation.status === "DIFFERS") flags.unshift({ label: "C", text: `The components do not add up to the final balance: they differ by ${r(result.reconciliation.difference)} ${ccy}. The report may contain amounts TRL did not read; check its Deals list.` });
  flags.push({ label: "C", text: "Spread and slippage are inside the prices and are not listed in MT5 reports, so they are not in these costs." });
  flags.push({ label: "C", text: "Reports whose commissions are charged daily or monthly as separate deals cannot be imported yet (a planned change)." });
  return { read, tips, flags };
}
