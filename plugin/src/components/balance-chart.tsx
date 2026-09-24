import React, { useMemo, useState } from "react";
import type { StatisticsResult } from "../types";
import { lineGeometry, nearestIndex } from "./chart-geometry";
import { formatTimestamp } from "./display-format";
import { ChartFrame } from "./chart-frame";
import { money } from "./display-format";

type BalancePoint = StatisticsResult["balance_curve"]["points"][number];

/**
 * Verified reported-balance curve. Points are evenly spaced in source event
 * order (not scaled by time). All labels are Core-supplied strings.
 */
export type ChartBand = { startSequence: number; endSequence: number; label: string };

export function BalanceChart({ points, currency, band }: { points: BalancePoint[]; currency?: string | null; band?: ChartBand | null }): React.ReactElement {
  const geometry = useMemo(() => lineGeometry(points.map((point) => point.balance)), [points]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (points.length < 2) return <p className="trl-m0__note">At least two balance points are required to draw the verified balance curve.</p>;
  if (geometry === null) return <p className="trl-m0__inline-error" role="alert">The balance curve could not be drawn because a Core balance value was not numeric.</p>;

  const unit = currency ?? "source currency";
  const first = points[0]!;
  const last = points.at(-1)!;
  const high = points[geometry.highIndex]!;
  const low = points[geometry.lowIndex]!;
  const active = activeIndex === null ? null : points[activeIndex] ?? null;
  const activePosition = activeIndex === null ? null : geometry.positions[activeIndex] ?? null;
  const bandStart = band ? points.findIndex((point) => point.source_sequence === band.startSequence) : -1;
  const bandEnd = band ? points.findIndex((point) => point.source_sequence === band.endSequence) : -1;
  const bandBox = bandStart >= 0 && bandEnd >= bandStart ? { x: geometry.positions[bandStart]!.x, width: Math.max(0.3, geometry.positions[bandEnd]!.x - geometry.positions[bandStart]!.x) } : null;

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    setActiveIndex(nearestIndex((event.clientX - bounds.left) / bounds.width, points.length));
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? Math.max(1, Math.round(points.length / 20)) : 1;
    const current = activeIndex ?? 0;
    if (event.key === "ArrowRight") setActiveIndex(Math.min(points.length - 1, current + step));
    else if (event.key === "ArrowLeft") setActiveIndex(Math.max(0, current - step));
    else if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(points.length - 1);
    else if (event.key === "Escape") setActiveIndex(null);
    else return;
    event.preventDefault();
  };

  return <ChartFrame title="Balance">
  <figure className="trl-balance-chart">
    <div className="trl-balance-chart__body">
      <div className="trl-balance-chart__y-axis" aria-hidden="true">
        <span>{money(high.balance)}</span>
        <span>{money(low.balance)}</span>
      </div>
      <div
        className="trl-balance-chart__plot"
        tabIndex={0}
        role="img"
        aria-label={`Verified reported balance in ${unit}: ${points.length} points from ${money(first.balance)} to ${money(last.balance)}, high ${money(high.balance)}, low ${money(low.balance)}. Use arrow keys to inspect points.`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActiveIndex(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActiveIndex(null)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {bandBox && <rect className="trl-balance-chart__band" x={bandBox.x} width={bandBox.width} y="0" height="100" />}
          <line className="trl-balance-chart__reference" x1="0" x2="100" y1={geometry.firstY} y2={geometry.firstY} vectorEffect="non-scaling-stroke" />
          <polyline className="trl-balance-chart__line" points={geometry.polyline} vectorEffect="non-scaling-stroke" />
        </svg>
        {activePosition && active && <>
          <span className="trl-balance-chart__guide" style={{ left: `${activePosition.x}%` }} />
          <span className="trl-balance-chart__dot" style={{ left: `${activePosition.x}%`, top: `${activePosition.y}%` }} />
          <span className={`trl-balance-chart__tooltip${activePosition.x > 60 ? " is-left" : ""}`} style={{ left: `${activePosition.x}%` }} role="status">
            <strong>{money(active.balance)} {unit}</strong>
            <span>{formatTimestamp(active.timestamp)}</span>
            <span>Sequence #{active.source_sequence}</span>
          </span>
        </>}
      </div>
    </div>
    {bandBox && band && <p className="trl-balance-chart__legend"><span className="trl-balance-chart__swatch" aria-hidden="true" /> Shaded: {band.label}, the longest stretch without a new balance high</p>}
    <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{formatTimestamp(first.timestamp)}</span><span>{formatTimestamp(last.timestamp)}</span></div>
    <figcaption className="trl-m0__note">Reported balance ({unit}) in source event order; dashed line = opening balance {money(first.balance)}. Hover or use arrow keys for values. Realised balance only, not intratrade equity.</figcaption>
  </figure>
  </ChartFrame>;
}
