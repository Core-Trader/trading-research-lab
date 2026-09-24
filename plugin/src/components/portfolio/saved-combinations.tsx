import React from "react";
import type { ParetoEvaluation, PortfolioCombination } from "../../types";
import { roundDecimalString } from "../display-format";
import { signTone } from "../dashboard-model";
import { TradeOffScatter } from "../tradeoff/trade-off-scatter";
import type { TradeOffPoint } from "../tradeoff/scatter-layout";
import { GuidanceBlock } from "../guidance";
import { paretoGuidance } from "./pareto-guidance";
import { money } from "../display-format";

export type SavedCombination = { key: string; name: string; labels: string[]; combination: PortfolioCombination };

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);

/** Named combinations side by side. Pareto status comes from the Core (analysis.pareto_evaluate). */
export function SavedCombinations({ saved, evaluation, activeKey, onOpen, onRemove, onPropCheck }: {
  onPropCheck?: (key: string) => void;
  saved: SavedCombination[];
  evaluation: ParetoEvaluation | null;
  activeKey: string | null;
  onOpen: (key: string) => void;
  onRemove: (key: string) => void;
}): React.ReactElement | null {
  if (saved.length === 0) return null;
  const status = new Map((evaluation?.candidates ?? []).map((candidate) => [candidate.id, candidate]));
  const settings = new Set(saved.map((item) => `${item.combination.configuration.starting_capital}|${item.combination.configuration.window}`));
  const points: TradeOffPoint[] = saved.map((item) => ({
    id: item.key,
    label: item.name,
    x: item.combination.metrics.balance_metrics.maximum_drawdown,
    y: item.combination.net_pnl,
    status: status.get(item.key)?.status ?? "DOMINATED",
    rank: status.get(item.key)?.rank ?? null,
  }));
  const unit = saved[0]!.combination.currency ?? "";
  return <section className="trl-page__surface">
    <h4>4. Saved combinations</h4>
    {settings.size > 1 && <p className="trl-m0__inline-error" role="note">These combinations use different starting capital or period settings, so drawdown percentages and periods are not directly comparable.</p>}
    <div className="trl-monthly"><table>
      <thead><tr><th scope="col">Name</th><th scope="col">Tracks</th><th scope="col">Net P/L</th><th scope="col">Max DD</th><th scope="col">Max DD %</th><th scope="col">Return / DD</th><th scope="col">Profit factor</th><th scope="col">SQN</th><th scope="col">Stagnation (days)</th><th scope="col">Close events</th><th scope="col">Pareto</th><th scope="col" /></tr></thead>
      <tbody>{saved.map((item) => {
        const balance = item.combination.metrics.balance_metrics;
        const close = item.combination.metrics.close_event_metrics;
        const row = status.get(item.key);
        return <tr key={item.key} className={item.key === activeKey ? "is-active" : undefined}>
          <th scope="row"><button type="button" className="trl-link-button" onClick={() => onOpen(item.key)}>{item.name}</button></th>
          <td>{item.labels.join(" + ")}</td>
          <td className={`is-${signTone(item.combination.net_pnl)}`}>{money(item.combination.net_pnl)}</td>
          <td>{money(balance.maximum_drawdown)}</td>
          <td title={balance.maximum_drawdown_percent ?? undefined}>{balance.maximum_drawdown_percent === null ? "—" : `${r2(balance.maximum_drawdown_percent)}%`}</td>
          <td title={balance.return_to_drawdown ?? undefined}>{r2(balance.return_to_drawdown)}</td>
          <td title={close.profit_factor ?? undefined}>{r2(close.profit_factor)}</td>
          <td>{r2(close.sqn_capped_100)}</td>
          <td>{r2(item.combination.metrics.stagnation.longest_by_time.duration_days)}</td>
          <td>{item.combination.close_event_count}</td>
          <td>{row ? (row.status === "PARETO" ? "Frontier" : row.status === "DOMINATED" ? `Dominated (${row.dominated_by_count})` : row.status) : "—"}</td>
          <td>{onPropCheck && <button type="button" title="Check this combination against a prop-firm profile" onClick={() => onPropCheck(item.key)}>Prop check</button>} <button type="button" onClick={() => onRemove(item.key)}>Remove</button></td>
        </tr>;
      })}</tbody>
    </table></div>
    {saved.length >= 2 && <TradeOffScatter points={points} xLabel={`Max drawdown (${unit})`} yLabel={`Net P/L (${unit})`} xBetter="lower" yBetter="higher" frontierLine highlightFrontier={evaluation !== null} selectedId={activeKey} onSelect={(point) => onOpen(point.id)} />}
    {saved.length >= 2 && evaluation && <GuidanceBlock defaultOpen={false} guidance={paretoGuidance({
      points: points.map((point) => ({ id: point.id, label: point.label, gain: point.y, cost: point.x, status: point.status, dominatedBy: status.get(point.id)?.dominated_by_example ?? null })),
      frontierCount: evaluation.counts.PARETO,
      steps: evaluation.frontier_steps ?? null,
      selectedId: activeKey,
      currency: unit,
      gainLabel: "net P/L",
      costLabel: "max drawdown",
    })} />}
    {saved.length < 2 && <p className="trl-m0__note">Save at least two combinations to compare them on the return-versus-drawdown field.</p>}
  </section>;
}
