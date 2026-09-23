import React, { useMemo, useState } from "react";
import type { PortfolioExploration } from "../../types";
import { formatTimestamp, roundDecimalString } from "../display-format";
import { TradeOffScatter } from "../tradeoff/trade-off-scatter";
import type { TradeOffPoint } from "../tradeoff/scatter-layout";

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);

/** Every subset of the included tracks (PL-003). Descriptive: the frontier overlay is opt-in. */
export function CombinationExplorer({ exploration, labels, selectedId, onPick }: {
  exploration: PortfolioExploration;
  labels: string[];
  selectedId: string | null;
  onPick: (members: number[], id: string) => void;
}): React.ReactElement {
  const [overlay, setOverlay] = useState(false);
  const byId = useMemo(() => new Map(exploration.subsets.map((subset) => [subset.id, subset])), [exploration]);
  const points: TradeOffPoint[] = useMemo(() => exploration.subsets.map((subset) => ({
    id: subset.id,
    label: subset.members.map((index) => labels[index] ?? `Track ${index + 1}`).join(" + "),
    x: subset.maximum_drawdown,
    y: subset.net_pnl,
    size: subset.close_event_count,
    status: subset.pareto.status,
    rank: subset.pareto.rank,
  })), [exploration, labels]);
  const unit = exploration.currency ?? "";
  return <section className="trl-page__surface">
    <h4>5. Combination explorer</h4>
    <p className="trl-m0__note">All {exploration.subset_count} combinations of the included tracks, each computed like a normal combination (same capital and period setting). Click a point to open it.</p>
    <label className="trl-portfolio__include"><input type="checkbox" checked={overlay} onChange={() => setOverlay(!overlay)} /> Show Pareto frontier ({exploration.counts.PARETO} combinations no other beats on both net P/L and max drawdown)</label>
    <TradeOffScatter
      points={points}
      xLabel={`Max drawdown (${unit})`}
      yLabel={`Net P/L (${unit})`}
      xBetter="lower"
      yBetter="higher"
      frontierLine
      highlightFrontier={overlay}
      sizeLabel="Close events"
      selectedId={selectedId}
      onSelect={(point) => { const subset = byId.get(point.id); if (subset) onPick(subset.members, subset.id); }}
      details={(point) => {
        const subset = byId.get(point.id);
        if (!subset) return null;
        return <>
          <span>Max DD %: {subset.maximum_drawdown_percent === null ? "—" : `${r2(subset.maximum_drawdown_percent)}%`}</span>
          <span>Return / DD: {r2(subset.return_to_drawdown)}</span>
          {subset.window_start && subset.window_end && <span>{formatTimestamp(subset.window_start).slice(0, 10)} → {formatTimestamp(subset.window_end).slice(0, 10)}</span>}
          {subset.reason === "NO_COMMON_WINDOW" && <span>No period when all were active</span>}
        </>;
      }}
    />
    <ul className="trl-batch__warnings">{exploration.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
  </section>;
}
