import React from "react";
import type { DailyDrawdownResult, EquityAvailabilityResult, StatisticsResult, TradeAnalysisResult } from "../../types";
import { BalanceChart } from "../balance-chart";
import { CollapsibleSection } from "../collapsible-section";

export function Results({ statistics }: { statistics: StatisticsResult }): React.ReactElement {
  return <CollapsibleSection title="Verified results" defaultOpen>
    <ul>
      <li>Dataset: <code>{statistics.dataset_ref}</code></li>
      <li>Opening balance: <code>{statistics.opening_balance} {statistics.currency ?? ""}</code></li>
      <li>Final reported balance: <code>{statistics.final_reported_balance} {statistics.currency ?? ""}</code></li>
      <li>Reported change: <code>{statistics.reported_balance_change} {statistics.currency ?? ""}</code></li>
      <li>Equity curve: <code>{statistics.equity_curve.status}</code> — {statistics.equity_curve.reason}</li>
    </ul>
    <BalanceChart points={statistics.balance_curve.points} currency={statistics.currency} />
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
        <option value="NETTING">Netting — event analysis only in M2</option>
      </select>
    </label>
    <p className="trl-m0__note">This declaration is always displayed as USER_SUPPLIED; it is not fetched from a regular MT5 report.</p>
    <button type="button" onClick={onRun}>Run M2 trade analysis</button>
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
      <dt>Analysis basis</dt><dd><code>{result.analysis_basis}</code></dd>
      {result.policy && <><dt>Policy</dt><dd><code>{result.policy.policy_id}</code>; {result.policy.account_mode} — {result.policy.account_mode_source}</dd></>}
      {result.eligible === false && <><dt>Lifecycle eligibility</dt><dd>Not eligible: no inferred lifecycle was created.</dd></>}
      <dt>Count</dt><dd>{metrics.count}</dd>
      <dt>Net P/L</dt><dd><code>{metrics.net_pnl} {currency}</code></dd>
      <dt>Gross profit / loss</dt><dd><code>{metrics.gross_profit} / {metrics.gross_loss} {currency}</code></dd>
      <dt>Win / loss / breakeven</dt><dd>{metrics.win_count} / {metrics.loss_count} / {metrics.breakeven_count}</dd>
      <dt>Quality counts</dt><dd>MT5_VERIFIED: {result.quality_counts.MT5_VERIFIED}; INFERRED: {result.quality_counts.INFERRED}; UNPAIRED: {result.quality_counts.UNPAIRED}; AMBIGUOUS: {result.quality_counts.AMBIGUOUS}</dd>
      <dt>Artifact</dt><dd><code>{result.artifacts.table}</code></dd>
      <dt>Warnings</dt><dd>{result.warnings.join(" ")}</dd>
    </dl>
  </section>;
}

export function M3Analysis({ drawdown, equity, onRun }: {
  drawdown: DailyDrawdownResult | null;
  equity: EquityAvailabilityResult | null;
  onRun: () => void;
}): React.ReactElement {
  return <CollapsibleSection title="Time, balance, and risk foundation">
    <p className="trl-m0__note">The basic M3 result uses the report date/time exactly as supplied. It is realised-balance analysis, not equity or prop-firm compliance.</p>
    <button type="button" onClick={onRun}>Run M3 daily balance analysis</button>
    {drawdown && <section className="trl-m0__analysis-result">
      <h4>Realised-balance daily drawdown</h4>
      <dl className="trl-m0__diagnostic-grid">
        <dt>Time basis</dt><dd><code>{drawdown.time_basis}</code> — no timezone conversion</dd>
        <dt>Analysis basis</dt><dd><code>{drawdown.analysis_basis}</code></dd>
        <dt>Policy</dt><dd><code>{drawdown.policy_id}</code></dd>
        <dt>Days observed</dt><dd>{drawdown.daily_row_count}</dd>
        <dt>Worst report date</dt><dd>{drawdown.worst_day.date} ({drawdown.worst_day.coverage})</dd>
        <dt>Worst decline</dt><dd><code>{drawdown.worst_day.maximum_drawdown} {drawdown.currency ?? "source currency"}</code> ({drawdown.worst_day.maximum_drawdown_percent ?? "Unavailable"}%)</dd>
        <dt>Daily reference / high water</dt><dd><code>{drawdown.worst_day.daily_reference_balance} / {drawdown.worst_day.daily_high_water_balance} {drawdown.currency ?? "source currency"}</code></dd>
        <dt>Artifact</dt><dd><code>{drawdown.artifacts.table}</code></dd>
        <dt>Warnings</dt><dd>{drawdown.warnings.join(" ")}</dd>
      </dl>
    </section>}
    {equity && <section className="trl-m0__analysis-result">
      <h4>Intratrade equity</h4>
      <dl className="trl-m0__diagnostic-grid">
        <dt>Status</dt><dd><code>{equity.status}</code></dd>
        {equity.status === "UNAVAILABLE" ? <><dt>Reason</dt><dd>{equity.reason}</dd>
        <dt>Required later evidence</dt><dd>{equity.required_evidence}</dd></> : <><dt>Source</dt><dd>TRL tester equity log, linked to this report</dd></>}
      </dl>
    </section>}
  </CollapsibleSection>;
}
