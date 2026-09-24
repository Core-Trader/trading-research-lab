import React, { useMemo, useState } from "react";
import type { PerformanceMetrics } from "../types";
import { lineGeometry, nearestIndex } from "./chart-geometry";
import { formatTimestamp, roundDecimalString } from "./display-format";
import { money } from "./display-format";

type DrawdownPoint = PerformanceMetrics["drawdown_series"][number];

/**
 * Underwater chart: how far the reported balance sits below its running high.
 * Same point order and spacing as the balance curve, so the two align when
 * stacked. Values are Core strings; the line is drawn below a zero baseline.
 */
export function DrawdownChart({ series, currency, maximum }: { series: DrawdownPoint[]; currency?: string | null; maximum: string }): React.ReactElement {
  // Negate for plotting only (drawdown 0 at the top); labels use Core strings.
  const geometry = useMemo(() => lineGeometry(series.map((point) => (point.drawdown.startsWith("-") ? point.drawdown.slice(1) : `-${money(point.drawdown)}`))), [series]);
  const [active, setActive] = useState<number | null>(null);
  if (series.length < 2 || geometry === null) return <p className="trl-m0__note">Not enough balance points to draw the drawdown chart.</p>;
  const unit = currency ?? "source currency";
  const point = active === null ? null : series[active] ?? null;
  const position = active === null ? null : geometry.positions[active] ?? null;
  const zeroY = geometry.positions[geometry.highIndex]!.y;
  return <figure className="trl-drawdown-chart">
    <div className="trl-balance-chart__body">
      <div className="trl-balance-chart__y-axis" aria-hidden="true"><span>0</span><span>-{maximum}</span></div>
      <div
        className="trl-balance-chart__plot trl-drawdown-chart__plot"
        tabIndex={0}
        role="img"
        aria-label={`Drawdown below the running balance high in ${unit}; maximum ${maximum}. Use arrow keys to inspect points.`}
        onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(nearestIndex((event.clientX - bounds.left) / bounds.width, series.length)); }}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          const current = active ?? 0;
          if (event.key === "ArrowRight") setActive(Math.min(series.length - 1, current + 1));
          else if (event.key === "ArrowLeft") setActive(Math.max(0, current - 1));
          else if (event.key === "Escape") setActive(null);
          else return;
          event.preventDefault();
        }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon className="trl-drawdown-chart__area" points={`0,${zeroY} ${geometry.polyline} 100,${zeroY}`} />
          <polyline className="trl-drawdown-chart__line" points={geometry.polyline} vectorEffect="non-scaling-stroke" />
        </svg>
        {point && position && <>
          <span className="trl-balance-chart__guide" style={{ left: `${position.x}%` }} />
          <span className={`trl-balance-chart__tooltip${position.x > 60 ? " is-left" : ""}`} style={{ left: `${position.x}%` }} role="status">
            <strong className={point.drawdown === "0" ? "" : "is-negative"}>-{money(point.drawdown)} {unit}</strong>
            <span>{point.drawdown_percent === null ? "% unavailable" : `${roundDecimalString(point.drawdown_percent, 2)}% below the high`}</span>
            <span>{formatTimestamp(point.timestamp)}</span>
          </span>
        </>}
      </div>
    </div>
    <figcaption className="trl-m0__note">Drawdown: distance of the reported balance below its running high ({unit}), same event order as the balance curve. Realised balance only.</figcaption>
  </figure>;
}
