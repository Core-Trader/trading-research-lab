import React from "react";
import type { PortfolioCombination } from "../../types";
import { BalanceChart } from "../balance-chart";
import { DrawdownChart } from "../drawdown-chart";
import { formatTimestamp, roundDecimalString } from "../display-format";
import { signTone } from "../dashboard-model";
import { spanTimeline } from "./portfolio-model";
import { money } from "../display-format";

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);
const REASON: Record<string, string> = { INSUFFICIENT_DAYS: "too few days", ZERO_VARIANCE: "no variation", NO_LOSSES: "No losses", NO_DRAWDOWN: "No drawdown" };

/** Presentation of one Core portfolio.combine result. No value is calculated here. */
export function CombinedDashboard({ combination, labels }: { combination: PortfolioCombination; labels: string[] }): React.ReactElement {
  const unit = combination.currency ?? "source currency";
  const balance = combination.metrics.balance_metrics;
  const close = combination.metrics.close_event_metrics;
  const stagnation = combination.metrics.stagnation.longest_by_time;
  const label = (index: number): string => labels[index] ?? `Track ${index + 1}`;
  const timeline = spanTimeline(combination.active_tracks.map((track) => ({ key: track.track_id, label: label(track.index), first: track.start, last: track.end })));
  const points = combination.combined_balance.map((point) => ({ source_sequence: point.index, timestamp: point.timestamp, balance: point.balance }));
  return <section className="trl-dashboard" aria-label="Combined portfolio result">
    <header className="trl-dashboard__header">
      <div><h3>Combined result: {labels.join(" + ")}</h3><p>{combination.configuration.starting_capital} {unit} starting capital (you declared it) · {combination.configuration.window === "UNION" ? "each track while active" : "only while all tracks were active"} · {formatTimestamp(combination.window_start).slice(0, 10)} → {formatTimestamp(combination.window_end).slice(0, 10)} · lots as reported</p></div>
      <span className="trl-dashboard__status">REALISED BALANCE</span>
    </header>
    <section className="trl-kpi-row" aria-label="Combined key results">
      <Tile label="Net P/L" value={`${money(combination.net_pnl)} ${unit}`} detail={`${combination.close_event_count} close events`} tone={signTone(combination.net_pnl)} />
      <Tile label="Max drawdown (balance)" value={signTone(balance.maximum_drawdown) === "neutral" ? "No drawdown" : `${money(balance.maximum_drawdown)} ${unit}`} detail={balance.maximum_drawdown_percent ? `${r2(balance.maximum_drawdown_percent)}% of peak · ${balance.recovery_status === "RECOVERED" ? "recovered" : "not recovered"}` : "—"} tone={signTone(balance.maximum_drawdown) === "neutral" ? "neutral" : "negative"} exact={balance.maximum_drawdown_percent} />
      <Tile label="Return / drawdown" value={balance.return_to_drawdown === null ? REASON[balance.return_to_drawdown_reason ?? ""] ?? "—" : r2(balance.return_to_drawdown)} detail="Net change ÷ max drawdown" exact={balance.return_to_drawdown} />
      <Tile label="Profit factor" value={close.profit_factor === null ? REASON[close.profit_factor_reason ?? ""] ?? "—" : r2(close.profit_factor)} detail={`Gross ${money(close.gross_profit)} ÷ |${money(close.gross_loss)}|`} exact={close.profit_factor} />
      <Tile label="SQN (Van Tharp)" value={r2(close.sqn_capped_100)} detail={`raw ${r2(close.sqn)} · no quality band`} exact={close.sqn} />
      <Tile label="Longest stagnation" value={`${r2(stagnation.duration_days)} days`} detail={`${stagnation.close_events} close events · ${stagnation.status === "ONGOING" ? "ongoing" : "ended"}`} exact={stagnation.duration_days} />
    </section>
    <div className="trl-dashboard__grid">
      <section className="trl-dashboard__card trl-dashboard__card--wide">
        <h4>Combined balance and active tracks</h4>
        {timeline && <div className="trl-batch__timeline">{timeline.rows.map((row) => <div key={row.key} className="trl-batch__lane">
          <span className="trl-batch__lane-label" title={row.label}>{row.label}</span>
          <div className="trl-batch__track"><span className="trl-batch__bar" style={{ left: `${row.left}%`, width: `${row.width}%` }} title={`${row.label}: ${formatTimestamp(row.first)} → ${formatTimestamp(row.last)}`} /></div>
        </div>)}</div>}
        <BalanceChart points={points} currency={combination.currency} band={{ startSequence: stagnation.start.source_sequence, endSequence: stagnation.end.source_sequence, label: `longest stagnation (${r2(stagnation.duration_days)} days)` }} />
        <DrawdownChart series={combination.drawdown_series} currency={combination.currency} maximum={balance.maximum_drawdown} />
        <p className="trl-m0__note">Active-track bars use report time; the curves step by merged close event, so the two axes are aligned by order, not by calendar.</p>
      </section>
      <section className="trl-dashboard__card trl-dashboard__card--wide">
        <h4>Contribution and standalone results (same capital and period)</h4>
        <div className="trl-monthly"><table>
          <thead><tr><th scope="col">Track</th><th scope="col">Active</th><th scope="col">Close events</th><th scope="col">Net P/L</th><th scope="col">Share of net</th><th scope="col">Standalone max DD</th><th scope="col">Max DD %</th><th scope="col">Profit factor</th><th scope="col">SQN</th></tr></thead>
          <tbody>{combination.tracks.map((track) => <tr key={track.track_id}>
            <th scope="row" title={track.filenames.join(" → ")}>{label(track.index)}{track.filenames.length > 1 ? ` (${track.filenames.length} chained)` : ""}</th>
            <td>{formatTimestamp(track.active_start).slice(0, 10)} → {formatTimestamp(track.active_end).slice(0, 10)}</td>
            <td>{track.close_events_in_window}</td>
            <td className={`is-${signTone(track.net_pnl)}`}>{money(track.net_pnl)}</td>
            <td title={track.share_of_combined_net_percent ?? undefined}>{track.share_of_combined_net_percent === null ? "—" : `${r2(track.share_of_combined_net_percent)}%`}</td>
            <td>{money(track.standalone_maximum_drawdown)}</td>
            <td>{track.standalone_metrics.maximum_drawdown_percent === null ? "—" : `${r2(track.standalone_metrics.maximum_drawdown_percent)}%`}</td>
            <td>{track.standalone_metrics.profit_factor === null ? REASON[track.standalone_metrics.profit_factor_reason ?? ""] ?? "—" : r2(track.standalone_metrics.profit_factor)}</td>
            <td>{r2(track.standalone_metrics.sqn_capped_100)}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="trl-portfolio__overlap">Drawdown overlap: the sum of standalone maximum drawdowns is <strong>{money(combination.drawdown_overlap.sum_of_standalone_maximum_drawdowns)}</strong>; together the combined maximum drawdown was <strong>{money(combination.drawdown_overlap.combined_maximum_drawdown)}</strong>, an offset of <strong>{money(combination.drawdown_overlap.offset)} {unit}</strong> because the tracks' drawdowns did not fully coincide.</p>
      </section>
      {combination.correlation.length > 0 && <section className="trl-dashboard__card trl-dashboard__card--wide">
        <h4>Daily P/L correlation</h4>
        <CorrelationMatrix combination={combination} label={label} />
        <p className="trl-m0__note">Pearson correlation of daily close-event P/L on days where either track traded (at least 10 days required). Values near 1 mean the tracks tend to win and lose on the same days.</p>
      </section>}
    </div>
    <ul className="trl-batch__warnings">{combination.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
  </section>;
}

function Tile({ label, value, detail, tone = "neutral", exact }: { label: string; value: string; detail: string; tone?: string; exact?: string | null }): React.ReactElement {
  return <div className={`trl-kpi trl-kpi--${tone}`} title={exact ? `Core value: ${exact}` : undefined}>
    <span className="trl-kpi__label">{label}</span><strong className="trl-kpi__value">{value}</strong><span className="trl-kpi__detail">{detail}</span>
  </div>;
}

function CorrelationMatrix({ combination, label }: { combination: PortfolioCombination; label: (index: number) => string }): React.ReactElement {
  const count = combination.tracks.length;
  const cell = (left: number, right: number): React.ReactElement => {
    if (left === right) return <td className="is-empty">—</td>;
    const pair = combination.correlation.find((item) => item.left_index === Math.min(left, right) && item.right_index === Math.max(left, right));
    if (!pair || pair.pearson === null) return <td className="is-empty" title={pair ? `${pair.days} days` : undefined}>{pair ? REASON[pair.reason ?? ""] ?? "—" : "—"}</td>;
    const strength = Math.min(1, Math.abs(Number(pair.pearson)));
    return <td className="trl-corr" style={{ "--trl-cell-strength": strength } as React.CSSProperties} title={`Core value ${pair.pearson} over ${pair.days} days`}>{r2(pair.pearson)}</td>;
  };
  return <div className="trl-monthly"><table>
    <thead><tr><th scope="col">Track</th>{Array.from({ length: count }, (_, index) => <th key={index} scope="col">{label(index)}</th>)}</tr></thead>
    <tbody>{Array.from({ length: count }, (_, row) => <tr key={row}><th scope="row">{label(row)}</th>{Array.from({ length: count }, (_, column) => <React.Fragment key={column}>{cell(row, column)}</React.Fragment>)}</tr>)}</tbody>
  </table></div>;
}
