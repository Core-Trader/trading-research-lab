import React from "react";
import type { StatisticsResult } from "../types";

export function BalanceChart({ points }: { points: StatisticsResult["balance_curve"]["points"] }): React.ReactElement {
  if (points.length < 2) return <p className="trl-m0__note">At least two balance points are required to draw the verified balance curve.</p>;
  const values = points.map((point) => Number(point.balance));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  const polyline = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 95 - ((value - low) / range) * 90;
    return `${x},${y}`;
  }).join(" ");
  return <svg className="trl-m0__chart" viewBox="0 0 100 100" role="img" aria-label="Verified reported balance curve">
    <polyline points={polyline} fill="none" stroke="var(--interactive-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
  </svg>;
}
