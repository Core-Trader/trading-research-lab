import React, { useMemo, useState, type ReactNode } from "react";
import { keyboardOrder, nearestPoint, scatterLayout, type PlacedPoint, type TradeOffPoint, type TradeOffStatus } from "./scatter-layout";
import { ChartFrame } from "../chart-frame";

type Props = {
  points: TradeOffPoint[];
  xLabel: string;
  yLabel: string;
  /** Which direction is preferable on each axis; shown as a hint only. */
  xBetter?: "higher" | "lower";
  yBetter?: "higher" | "lower";
  /** Draw the frontier line; only meaningful when the two axes are the two objectives. */
  frontierLine?: boolean;
  sizeLabel?: string;
  selectedId?: string | null;
  onSelect?: (point: TradeOffPoint) => void;
  /** Extra rows for the hover/focus card (parameters, metrics, constraints...). */
  details?: (point: TradeOffPoint) => ReactNode;
  /** When false, frontier and dominated candidates look the same (overlay off). */
  highlightFrontier?: boolean;
};

const STATUS_LABEL: Record<TradeOffStatus, string> = {
  PARETO: "Pareto frontier (not dominated)",
  DOMINATED: "Dominated",
  CONSTRAINED: "Fails a constraint",
  INCOMPLETE: "Missing a value",
};

/**
 * Shared trade-off field for Portfolio Lab combinations and parameter sets.
 * Presentation only: statuses and ranks are Core results. Nothing is labelled
 * "best"; the frontier marks non-dominated candidates for the owner to choose from.
 */
export function TradeOffScatter({ points, xLabel, yLabel, xBetter, yBetter, frontierLine, sizeLabel, selectedId, onSelect, details, highlightFrontier = true }: Props): React.ReactElement {
  const layout = useMemo(() => scatterLayout(points, { sizeByValue: sizeLabel !== undefined, frontierLine: frontierLine && highlightFrontier }), [points, sizeLabel, frontierLine, highlightFrontier]);
  const shown = (status: TradeOffStatus): string => (!highlightFrontier && status === "PARETO" ? "dominated" : status.toLowerCase());
  const order = useMemo(() => layout ? keyboardOrder(layout.placed) : [], [layout]);
  const [hovered, setHovered] = useState<PlacedPoint | null>(null);
  const counts = useMemo(() => {
    const result: Record<TradeOffStatus, number> = { PARETO: 0, DOMINATED: 0, CONSTRAINED: 0, INCOMPLETE: 0 };
    points.forEach((point) => { result[point.status] += 1; });
    return result;
  }, [points]);
  if (layout === null) return <p className="trl-m0__note">No candidate has values for both {xLabel} and {yLabel}.</p>;

  const selected = layout.placed.find((point) => point.id === selectedId) ?? null;
  const card = hovered ?? selected;
  // Draw dimmer states first so frontier, default, and selection sit on top.
  const drawOrder = [...layout.placed].sort((a, b) => layer(a, selectedId) - layer(b, selectedId));

  const onPointer = (event: React.MouseEvent<HTMLDivElement>, click: boolean): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const found = nearestPoint(layout.placed, event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, bounds.height);
    if (click) { if (found && onSelect) onSelect(found); } else setHovered(found);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const current = hovered ?? selected;
    const position = current ? order.findIndex((point) => point.id === current.id) : -1;
    if (event.key === "ArrowRight") setHovered(order[Math.min(order.length - 1, position + 1)] ?? null);
    else if (event.key === "ArrowLeft") setHovered(order[Math.max(0, position - 1)] ?? null);
    else if (event.key === "Home") setHovered(order[0] ?? null);
    else if (event.key === "End") setHovered(order.at(-1) ?? null);
    else if ((event.key === "Enter" || event.key === " ") && hovered && onSelect) onSelect(hovered);
    else if (event.key === "Escape") setHovered(null);
    else return;
    event.preventDefault();
  };

  return <ChartFrame title={`${yLabel} vs ${xLabel}`}>
  <figure className="trl-tradeoff">
    <div className="trl-tradeoff__frame">
      <div className="trl-tradeoff__y-axis" aria-hidden="true"><span>{layout.yMax}</span><span className="trl-tradeoff__axis-title">{yLabel}{yBetter ? ` (${yBetter} is better)` : ""}</span><span>{layout.yMin}</span></div>
      <div
        className="trl-tradeoff__plot"
        tabIndex={0}
        role="img"
        aria-label={`Trade-off field: ${points.length} candidates, ${counts.PARETO} on the Pareto frontier. X: ${xLabel}. Y: ${yLabel}. Use arrow keys to inspect and Enter to select.`}
        onPointerMove={(event) => onPointer(event, false)}
        onPointerLeave={() => setHovered(null)}
        onClick={(event) => onPointer(event, true)}
        onKeyDown={onKeyDown}
      >
        {layout.frontier && <svg className="trl-tradeoff__frontier" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={layout.frontier} vectorEffect="non-scaling-stroke" /></svg>}
        {drawOrder.map((point) => point.isDefault
          ? <span key={point.id} className={`trl-tradeoff__default is-${shown(point.status)}${point.id === selectedId ? " is-selected" : ""}`} style={{ left: `${point.left}%`, top: `${point.top}%` }} aria-hidden="true">★</span>
          : <span key={point.id} className={`trl-tradeoff__point is-${shown(point.status)}${point.id === selectedId ? " is-selected" : ""}${point.id === hovered?.id ? " is-hovered" : ""}`} style={{ left: `${point.left}%`, top: `${point.top}%`, width: `${point.radius * 2}px`, height: `${point.radius * 2}px` }} aria-hidden="true" />)}
        {card && <div className={`trl-tradeoff__card${card.left > 60 ? " is-left" : ""}${card.top > 60 ? " is-up" : ""}`} style={{ left: `${card.left}%`, top: `${card.top}%` }} role="status">
          <strong>{card.isDefault ? "★ Default · " : ""}{card.label}</strong>
          {(highlightFrontier || card.status === "CONSTRAINED" || card.status === "INCOMPLETE") && <span>{STATUS_LABEL[card.status]}{card.rank && card.status !== "PARETO" ? ` · front ${card.rank}` : ""}</span>}
          <span>{xLabel}: {card.x}</span>
          <span>{yLabel}: {card.y}</span>
          {sizeLabel && card.size !== undefined && <span>{sizeLabel}: {card.size ?? "—"}</span>}
          {details?.(card)}
          {onSelect && hovered && <em>Click or press Enter to select</em>}
        </div>}
      </div>
    </div>
    <div className="trl-tradeoff__x-axis" aria-hidden="true"><span>{layout.xMin}</span><span className="trl-tradeoff__axis-title">{xLabel}{xBetter ? ` (${xBetter} is better)` : ""}</span><span>{layout.xMax}</span></div>
    <ul className="trl-tradeoff__legend">
      {highlightFrontier
        ? <><li><span className="trl-tradeoff__swatch is-pareto" /> Pareto frontier {counts.PARETO}</li><li><span className="trl-tradeoff__swatch is-dominated" /> Dominated {counts.DOMINATED}</li></>
        : <li><span className="trl-tradeoff__swatch is-dominated" /> Candidate {counts.PARETO + counts.DOMINATED}</li>}
      {counts.CONSTRAINED > 0 && <li><span className="trl-tradeoff__swatch is-constrained" /> Fails a constraint {counts.CONSTRAINED}</li>}
      {counts.INCOMPLETE > 0 && <li>Missing a value {counts.INCOMPLETE} (not plotted)</li>}
      {points.some((point) => point.isDefault) && <li><span className="trl-tradeoff__star">★</span> Default</li>}
      {layout.omitted.length > 0 && <li>{layout.omitted.length} without both axis values (not plotted)</li>}
      {sizeLabel && <li>Point size: {sizeLabel}</li>}
    </ul>
    <figcaption className="trl-m0__note">Each point is one candidate. A candidate is on the Pareto frontier when no other candidate is at least as good on every chosen objective and better on at least one. The frontier is a set of trade-offs to choose from, not a recommendation.</figcaption>
  </figure>
  </ChartFrame>;
}

function layer(point: PlacedPoint, selectedId: string | null | undefined): number {
  if (point.id === selectedId) return 5;
  if (point.isDefault) return 4;
  return { CONSTRAINED: 0, INCOMPLETE: 0, DOMINATED: 1, PARETO: 2 }[point.status];
}
