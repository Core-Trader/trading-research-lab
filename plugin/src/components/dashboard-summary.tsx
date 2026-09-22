import React, { type ReactNode } from "react";
import { buildDashboardModel, type DashboardInputs } from "./dashboard-model";

type DashboardSummaryProps = DashboardInputs & {
  busyStatus: string | null;
  chart: ReactNode;
  onBrowseReport: () => void;
  onFocusDocuments: () => void;
  onRunTradeAnalysis: () => void;
  onRunDailyAnalysis: () => void;
};

/** Presentation-only MVP dashboard. Financial results always originate in the Core. */
export function DashboardSummary({
  busyStatus, chart, onBrowseReport, onFocusDocuments, onRunTradeAnalysis, onRunDailyAnalysis, ...inputs
}: DashboardSummaryProps): React.ReactElement {
  const model = buildDashboardModel(inputs);
  const busy = busyStatus !== null;
  if (model === null) {
    return <section className="trl-dashboard trl-dashboard--empty" aria-label="Research dashboard" aria-busy={busy}>
      <h3>Research dashboard</h3>
      {busy
        ? <p className="trl-dashboard__progress" role="status">{busyStatus}</p>
        : <p>Start by selecting an MT5 Strategy Tester Excel report and running intake. Your verified dataset, balance curve, analysis and research documents will appear here.</p>}
      <button type="button" className="mod-cta" disabled={busy} onClick={onBrowseReport}>Browse MT5 report…</button>
    </section>;
  }

  const { dataset, balance, closeEvents, dailyRisk, documents } = model;
  return <section className="trl-dashboard" aria-label="Research dashboard" aria-busy={busy}>
    <header className="trl-dashboard__header">
      <div><h3>Research dashboard</h3><p>Verified source evidence and local Core results. Advanced research is kept below.</p></div>
      <span className="trl-dashboard__status">{dataset.status}</span>
    </header>
    {busy && <p className="trl-dashboard__progress" role="status">{busyStatus} The results below belong to the previous import until this run completes.</p>}
    <section className="trl-dashboard__workflow" aria-label="Research workflow">
      <div className="trl-dashboard__workflow-step"><span className="trl-dashboard__step-number">1</span><div><strong>Import</strong><p>Verified source evidence is ready.</p></div><button type="button" disabled={busy} onClick={onBrowseReport}>Import another</button></div>
      <div className="trl-dashboard__workflow-step"><span className="trl-dashboard__step-number">2</span><div><strong>Analyse</strong><p>{closeEvents ? "Verified close-event analysis is ready." : "Run verified close-event analysis next."}</p></div>{!closeEvents && <button type="button" className="mod-cta" disabled={busy} onClick={onRunTradeAnalysis}>Run analysis</button>}</div>
      <div className="trl-dashboard__workflow-step"><span className="trl-dashboard__step-number">3</span><div><strong>Document</strong><p>{documents.linkedCount} of 3 linked: Strategy → Experiment → Report.</p></div><button type="button" onClick={onFocusDocuments}>Open documents</button></div>
    </section>
    <div className="trl-dashboard__grid">
      <section className="trl-dashboard__card">
        <h4>Dataset</h4>
        <strong>{dataset.filename}</strong>
        <p>{dataset.detail}</p>
        <p className="trl-m0__note">{dataset.adapter}</p>
      </section>
      <section className="trl-dashboard__card">
        <h4>Verified balance</h4>
        <dl><dt>Opening</dt><dd>{balance.opening}</dd><dt>Final</dt><dd>{balance.final}</dd><dt>Change</dt><dd>{balance.change}</dd></dl>
      </section>
      <section className="trl-dashboard__card">
        <h4>Verified close events</h4>
        {closeEvents
          ? <><strong>{closeEvents.netPnl}</strong><p>{closeEvents.detail}</p><dl><dt>Win rate</dt><dd>{closeEvents.winRate}</dd></dl></>
          : <><p>Not calculated yet.</p><button type="button" disabled={busy} onClick={onRunTradeAnalysis}>Run trade analysis</button></>}
      </section>
      <section className="trl-dashboard__card">
        <h4>Daily realised balance risk</h4>
        {dailyRisk
          ? <><strong>{dailyRisk.worstDecline}</strong><p>Worst date: {dailyRisk.worstDate} · {dailyRisk.worstDeclinePercent} of daily reference</p></>
          : <><p>Not calculated yet. This is source-clock realised balance, not intratrade equity.</p><button type="button" disabled={busy} onClick={onRunDailyAnalysis}>Run daily balance analysis</button></>}
      </section>
      <section className="trl-dashboard__card">
        <h4>Research documents</h4>
        <strong>{documents.linkedCount} of 3 linked</strong>
        <p>Strategy: {documents.strategy ? "linked" : "not linked"} · Experiment: {documents.experiment ? "linked" : "not linked"} · Report: {documents.report ? "linked" : "not linked"}</p><button type="button" onClick={onFocusDocuments}>Open document workflow</button>
      </section>
      <section className="trl-dashboard__card trl-dashboard__card--chart">
        <h4>Balance curve</h4>
        {chart}
      </section>
    </div>
  </section>;
}
