import React, { useMemo, useState } from "react";
import { nearestIndex } from "../chart-geometry";
import { ChartFrame } from "../chart-frame";
import { formatTimestamp } from "../display-format";
import { equityGeometry, type EquityPoint } from "./equity-model";

/**
 * Balance and equity from a linked TRL tester log, laid out like the balance
 * chart (same axes, size, hover, and Expand). Values are Core display points.
 */
export function EquityChart({ points, currency }: { points: EquityPoint[]; currency: string | null }): React.ReactElement {
  const geometry = useMemo(() => equityGeometry(points), [points]);
  const [active, setActive] = useState<number | null>(null);
  if (geometry === null || points.length < 2) return <p className="trl-m0__note">Not enough equity samples to draw a chart.</p>;
  const unit = currency ?? "";
  const point = active === null ? null : points[active] ?? null;
  const x = active === null ? 0 : points.length === 1 ? 50 : (active / (points.length - 1)) * 100;
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? Math.max(1, Math.round(points.length / 20)) : 1;
    const current = active ?? 0;
    if (event.key === "ArrowRight") setActive(Math.min(points.length - 1, current + step));
    else if (event.key === "ArrowLeft") setActive(Math.max(0, current - step));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(points.length - 1);
    else if (event.key === "Escape") setActive(null);
    else return;
    event.preventDefault();
  };
  return <ChartFrame title="Balance and equity">
    <figure className="trl-balance-chart trl-equity-chart">
      <div className="trl-balance-chart__body">
        <div className="trl-balance-chart__y-axis" aria-hidden="true"><span>{Number(geometry.high).toFixed(2)}</span><span>{Number(geometry.low).toFixed(2)}</span></div>
        <div
          className="trl-balance-chart__plot"
          tabIndex={0}
          role="img"
          aria-label={`Balance and equity in ${unit} from ${formatTimestamp(points[0]!.time)} to ${formatTimestamp(points.at(-1)!.time)}; lowest equity ${Number(geometry.low).toFixed(2)}. Use arrow keys to inspect.`}
          onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(nearestIndex((event.clientX - bounds.left) / bounds.width, points.length)); }}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon className="trl-equity__band" points={geometry.band} />
            <polyline className="trl-equity__equity" points={geometry.equity} vectorEffect="non-scaling-stroke" />
            <polyline className="trl-equity__balance" points={geometry.balance} vectorEffect="non-scaling-stroke" />
          </svg>
          {point && <>
            <span className="trl-balance-chart__guide" style={{ left: `${x}%` }} />
            <span className={`trl-balance-chart__tooltip${x > 60 ? " is-left" : ""}`} style={{ left: `${x}%` }} role="status">
              <strong>{formatTimestamp(point.time)}</strong>
              <span>Balance {point.balance} {unit}</span>
              <span>Equity {point.equity_close} {unit}</span>
              <span>Lowest {point.equity_min} · highest {point.equity_max}</span>
            </span>
          </>}
        </div>
      </div>
      <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{formatTimestamp(points[0]!.time)}</span><span>{formatTimestamp(points.at(-1)!.time)}</span></div>
      <figcaption className="trl-m0__note">
        <span className="trl-equity__key is-balance" /> Balance <span className="trl-equity__key is-equity" /> Equity at each sample <span className="trl-equity__key is-band" /> Lowest–highest equity reached. Hover or use arrow keys for values.
      </figcaption>
    </figure>
  </ChartFrame>;
}
