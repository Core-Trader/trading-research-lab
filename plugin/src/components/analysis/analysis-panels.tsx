import React from "react";
import type { DailyDrawdownResult, EquityAvailabilityResult, StatisticsResult, TradeAnalysisResult } from "../../types";
import { BalanceChart } from "../balance-chart";
import { AuditTrail } from "../audit-trail";
import { CollapsibleSection } from "../collapsible-section";
import { money, pct } from "../display-format";

export function Results({ statistics }: { statistics: StatisticsResult }): React.ReactElement {
  return <CollapsibleSection title="Verified results" defaultOpen>
    <dl className="trl-m0__diagnostic-grid">
      <dt>Opening balance</dt><dd>{money(statistics.opening_balance)} {statistics.currency ?? ""}</dd>
      <dt>Final balance</dt><dd>{money(statistics.final_reported_balance)} {statistics.currency ?? ""}</dd>
      <dt>Change</dt><dd>{money(statistics.reported_balance_change)} {statistics.currency ?? ""}</dd>
    </dl>
    <BalanceChart points={statistics.balance_curve.points} currency={statistics.currency} />
    <AuditTrail items={[["Dataset", <code>{statistics.dataset_ref}</code>], ["Equity curve in the report", <>{statistics.equity_curve.status}: {statistics.equity_curve.reason}</>]]} />
  </CollapsibleSection>;
}

export function M2Analysis({ accountMode, closeEvents, lifecycles, onAccountModeChange, onRun }: {
  accountMode: string;
  closeEvents: TradeAnalysisResult | null;
  lifecycles: TradeAnalysisResult | null;
  onAccountModeChange: (value: string) => void;
  onRun: () => void;
}): React.ReactElement {
  return <CollapsibleSection title="Trade and event analysis" defaultOpen>
    <p className="trl-m0__note">Close-event results are source-verified. Lifecycle results are optional and never shown as verified from a regular MT5 Excel export.</p>
    <label className="trl-m0__field">
      <span>Account mode declaration</span>
      <select value={accountMode} onChange={(event) => onAccountModeChange(event.currentTarget.value)}>
        <option value="UNDECLARED">Not declared — event analysis only</option>
        <option value="HEDGING">Hedging — allow inferred FIFO lifecycles</option>
        <option value="NETTING">Netting — event analysis only</option>
      </select>
    </label>
    <p className="trl-m0__note">This is your declaration; MT5 reports do not state the account mode.</p>
    <button type="button" onClick={onRun}>Run trade analysis</button>
    {closeEvents && <AnalysisResult title="Verified close events" result={closeEvents} />}
    {lifecycles && <AnalysisResult title="Inferred lifecycles" result={lifecycles} />}
  </CollapsibleSection>;
}

export function AnalysisResult({ title, result }: { title: string; result: TradeAnalysisResult }): React.ReactElement {
  const currency = result.currency ?? "source currency";
  const metrics = result.summary;
  return <section className="trl-m0__analysis-result">
    <h4>{title}</h4>
    <dl className="trl-m0__diagnostic-grid">
      {result.eligible === false && <><dt>Lifecycles</dt><dd>Not created for this account-mode declaration.</dd></>}
      <dt>Count</dt><dd>{metrics.count}</dd>
      <dt>Net P/L</dt><dd>{money(metrics.net_pnl)} {currency}</dd>
      <dt>Gross profit / loss</dt><dd>{money(metrics.gross_profit)} / {money(metrics.gross_loss)} {currency}</dd>
      <dt>Wins / losses / breakeven</dt><dd>{metrics.win_count} / {metrics.loss_count} / {metrics.breakeven_count}</dd>
      <dt>Evidence</dt><dd>{result.quality_counts.MT5_VERIFIED} verified by MT5 · {result.quality_counts.INFERRED} inferred{result.quality_counts.UNPAIRED ? ` · ${result.quality_counts.UNPAIRED} unpaired` : ""}{result.quality_counts.AMBIGUOUS ? ` · ${result.quality_counts.AMBIGUOUS} ambiguous` : ""}</dd>
    </dl>
    {result.warnings.length > 0 && <ul className="trl-batch__warnings">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    <AuditTrail items={[["Analysis basis", <code>{result.analysis_basis}</code>], ...(result.policy ? [["Policy", <><code>{result.policy.policy_id}</code>; {result.policy.account_mode} ({result.policy.account_mode_source})</>] as [string, React.ReactNode]] : []), ["Quality codes", <>MT5_VERIFIED {result.quality_counts.MT5_VERIFIED}; INFERRED {result.quality_counts.INFERRED}; UNPAIRED {result.quality_counts.UNPAIRED}; AMBIGUOUS {result.quality_counts.AMBIGUOUS}</>], ["Artifact", <code>{result.artifacts.table}</code>]]} />
  </section>;
}

export function M3Analysis({ drawdown, equity, onRun }: {
  drawdown: DailyDrawdownResult | null;
  equity: EquityAvailabilityResult | null;
  onRun: () => void;
}): React.ReactElement {
  return <CollapsibleSection title="Time, balance, and risk foundation">
    <p className="trl-m0__note">Uses the report's own date and time, and the balance after closed trades (not open-position equity, which is in the Equity section).</p>
    <button type="button" onClick={onRun}>Run daily balance analysis</button>
    {drawdown && <section className="trl-m0__analysis-result">
      <h4>Realised-balance daily drawdown</h4>
      <dl className="trl-m0__diagnostic-grid">
        <dt>Days observed</dt><dd>{drawdown.daily_row_count}</dd>
        <dt>Worst report date</dt><dd>{drawdown.worst_day.date} ({drawdown.worst_day.coverage})</dd>
        <dt>Worst decline</dt><dd>{money(drawdown.worst_day.maximum_drawdown)} {drawdown.currency ?? "source currency"}{drawdown.worst_day.maximum_drawdown_percent !== null ? ` (${pct(drawdown.worst_day.maximum_drawdown_percent)})` : ""}</dd>
        <dt>Day's reference / high</dt><dd>{money(drawdown.worst_day.daily_reference_balance)} / {money(drawdown.worst_day.daily_high_water_balance)} {drawdown.currency ?? "source currency"}</dd>
      </dl>
      {drawdown.warnings.length > 0 && <ul className="trl-batch__warnings">{drawdown.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <AuditTrail items={[["Time basis", <><code>{drawdown.time_basis}</code>: no timezone conversion</>], ["Analysis basis", <code>{drawdown.analysis_basis}</code>], ["Policy", <code>{drawdown.policy_id}</code>], ["Artifact", <code>{drawdown.artifacts.table}</code>]]} />
    </section>}
    {equity && <p className="trl-m0__note">Open-position (equity) drawdown: {equity.status === "AVAILABLE" ? "available from the attached equity log; see the Equity section." : "not available yet; see the Equity section for how to add an equity log."}</p>}
  </CollapsibleSection>;
}
