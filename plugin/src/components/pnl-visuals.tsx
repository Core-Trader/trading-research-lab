import React, { useMemo, useState } from "react";
import type { CloseEventDisplaySeries } from "../types";
import { calendarMonths } from "./calendar-model";
import { barGeometry, intensity, nearestIndex } from "./chart-geometry";
import { signTone } from "./dashboard-model";
import { formatTimestamp } from "./display-format";

type Series = CloseEventDisplaySeries;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function unitOf(series: Series): string {
  return series.currency ?? "source currency";
}

function maximumMagnitude(values: string[]): number {
  return values.reduce((largest, value) => Math.max(largest, Math.abs(Number(value)) || 0), 0);
}

/** Per-close-event net P/L bars around zero. Values and labels are Core strings. */
export function CloseEventBars({ series }: { series: Series }): React.ReactElement {
  const events = series.events;
  const geometry = useMemo(() => events ? barGeometry(events.map((event) => event.net_pnl)) : null, [events]);
  const [active, setActive] = useState<number | null>(null);
  if (events === null) return <p className="trl-m0__note">{series.events_omitted_reason}</p>;
  if (events.length === 0) return <p className="trl-m0__note">This report has no verified close events.</p>;
  if (geometry === null) return <p className="trl-m0__inline-error" role="alert">The close-event chart could not be drawn because a Core value was not numeric.</p>;
  const unit = unitOf(series);
  const activeEvent = active === null ? null : events[active] ?? null;
  const activeBar = active === null ? null : geometry.bars[active] ?? null;
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const current = active ?? 0;
    if (event.key === "ArrowRight") setActive(Math.min(events.length - 1, current + 1));
    else if (event.key === "ArrowLeft") setActive(Math.max(0, current - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(events.length - 1);
    else if (event.key === "Escape") setActive(null);
    else return;
    event.preventDefault();
  };
  return <figure className="trl-bars">
    <div className="trl-balance-chart__body">
      <div className="trl-balance-chart__y-axis" aria-hidden="true"><span>{events[geometry.highIndex]!.net_pnl}</span><span>{events[geometry.lowIndex]!.net_pnl}</span></div>
      <div
        className="trl-balance-chart__plot"
        tabIndex={0}
        role="img"
        aria-label={`Net P/L of ${events.length} verified close events in ${unit}; largest ${events[geometry.highIndex]!.net_pnl}, smallest ${events[geometry.lowIndex]!.net_pnl}. Use arrow keys to inspect events.`}
        onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(nearestIndex((event.clientX - bounds.left) / bounds.width - 0.5 / events.length, events.length)); }}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="trl-bars__zero" x1="0" x2="100" y1={geometry.zeroY} y2={geometry.zeroY} vectorEffect="non-scaling-stroke" />
          {geometry.bars.map((bar, index) => <rect key={events[index]!.source_sequence} className={`trl-bars__bar is-${bar.sign}${index === active ? " is-active" : ""}`} x={bar.x} width={bar.width} y={bar.y} height={Math.max(bar.height, 0.4)} />)}
        </svg>
        {activeEvent && activeBar && <span className={`trl-balance-chart__tooltip${activeBar.x > 60 ? " is-left" : ""}`} style={{ left: `${activeBar.x + activeBar.width / 2}%` }} role="status">
          <strong className={`is-${signTone(activeEvent.net_pnl)}`}>{activeEvent.net_pnl} {unit}</strong>
          <span>{formatTimestamp(activeEvent.timestamp)}</span>
          <span>{activeEvent.symbol} · close event #{active! + 1} of {events.length}</span>
        </span>}
      </div>
    </div>
    <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{formatTimestamp(events[0]!.timestamp)}</span><span>{formatTimestamp(events.at(-1)!.timestamp)}</span></div>
    <figcaption className="trl-m0__note">Net P/L per verified close event (profit + commission + swap), in {unit}, in source order.</figcaption>
  </figure>;
}

/** Monthly calendar of Core daily close-event P/L with Core ISO-week totals. */
export function DailyPnlCalendar({ series }: { series: Series }): React.ReactElement {
  const months = useMemo(() => calendarMonths(series), [series]);
  const [index, setIndex] = useState(months.length - 1);
  const scale = useMemo(() => maximumMagnitude(series.daily.map((row) => row.net_pnl)), [series]);
  const month = months[Math.min(Math.max(index, 0), months.length - 1)];
  if (month === undefined) return <p className="trl-m0__note">No days with verified close events.</p>;
  const unit = unitOf(series);
  return <div className="trl-calendar">
    <div className="trl-calendar__header">
      <button type="button" aria-label="Previous month" disabled={index <= 0} onClick={() => setIndex(index - 1)}>←</button>
      <strong>{month.label}</strong>
      <button type="button" aria-label="Next month" disabled={index >= months.length - 1} onClick={() => setIndex(index + 1)}>→</button>
    </div>
    <p className={`trl-calendar__month-total is-${month.total ? signTone(month.total.net_pnl) : "neutral"}`}>{month.total ? `${month.total.net_pnl} ${unit} · ${month.total.close_event_count} close events` : "No close events this month"}</p>
    <table className="trl-calendar__grid">
      <thead><tr>{WEEKDAYS.map((day) => <th key={day} scope="col">{day}</th>)}<th scope="col">Week</th></tr></thead>
      <tbody>{month.weeks.map((week) => <tr key={`${week.isoYear}-${week.isoWeek}`}>
        {week.days.map((cell, dayIndex) => {
          if (cell === null) return <td key={dayIndex} className="is-outside" />;
          const tone = cell.pnl ? signTone(cell.pnl.net_pnl) : "neutral";
          const style = cell.pnl && tone !== "neutral" ? { "--trl-cell-strength": intensity(cell.pnl.net_pnl, scale) } as React.CSSProperties : undefined;
          return <td key={dayIndex} className={cell.pnl ? `has-pnl is-${tone}` : "is-empty"} style={style} title={cell.pnl ? `${cell.date}: ${cell.pnl.net_pnl} ${unit} · ${cell.pnl.close_event_count} close events (${cell.pnl.win_count} wins, ${cell.pnl.loss_count} losses)` : `${cell.date}: no close events`}>
            <span className="trl-calendar__day">{cell.day}</span>
            {cell.pnl && <><span className="trl-calendar__value">{cell.pnl.net_pnl}</span><span className="trl-calendar__count">{cell.pnl.close_event_count} ev</span></>}
          </td>;
        })}
        <td className={`trl-calendar__week is-${week.total ? signTone(week.total.net_pnl) : "neutral"}`} title={`ISO week ${week.isoYear}-W${String(week.isoWeek).padStart(2, "0")} (whole week, may include days outside this month)`}>
          <span className="trl-calendar__day">W{week.isoWeek}</span>
          {week.total && <span className="trl-calendar__value">{week.total.net_pnl}</span>}
        </td>
      </tr>)}</tbody>
    </table>
    <p className="trl-m0__note">Days use the report clock as supplied (no timezone conversion). Week totals are whole ISO weeks (Monday–Sunday), which can span two months. Values in {unit}.</p>
  </div>;
}

/** Year × month table of Core monthly close-event P/L with Core yearly totals. */
export function MonthlyPnlTable({ series }: { series: Series }): React.ReactElement {
  const byMonth = useMemo(() => new Map(series.monthly.map((row) => [row.month, row])), [series]);
  const scale = useMemo(() => maximumMagnitude(series.monthly.map((row) => row.net_pnl)), [series]);
  if (series.yearly.length === 0) return <p className="trl-m0__note">No verified close events.</p>;
  const unit = unitOf(series);
  return <div className="trl-monthly">
    <table>
      <thead><tr><th scope="col">Year</th>{MONTH_SHORT.map((month) => <th key={month} scope="col">{month}</th>)}<th scope="col">Year total</th></tr></thead>
      <tbody>{series.yearly.map((year) => <tr key={year.year}>
        <th scope="row">{year.year}</th>
        {MONTH_SHORT.map((label, monthIndex) => {
          const row = byMonth.get(`${year.year}-${String(monthIndex + 1).padStart(2, "0")}`);
          if (!row) return <td key={label} className="is-empty">—</td>;
          const tone = signTone(row.net_pnl);
          return <td key={label} className={`is-${tone}`} style={tone === "neutral" ? undefined : { "--trl-cell-strength": intensity(row.net_pnl, scale) } as React.CSSProperties} title={`${row.month}: ${row.close_event_count} close events (${row.win_count} wins, ${row.loss_count} losses)`}>{row.net_pnl}</td>;
        })}
        <td className={`trl-monthly__total is-${signTone(year.net_pnl)}`}>{year.net_pnl}</td>
      </tr>)}</tbody>
    </table>
    <p className="trl-m0__note">Sum of verified close-event net P/L per report-clock month, in {unit}. "—" means no close events that month, not zero.</p>
  </div>;
}
