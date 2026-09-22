import React from "react";
import { BalanceChart } from "./balance-chart";
import { DashboardCard, type CardAction, type CardState } from "./dashboard-card";
import { buildDashboardModel, type DashboardInputs, type Kpi } from "./dashboard-model";
import { CloseEventBars, DailyPnlCalendar, MonthlyPnlTable } from "./pnl-visuals";
import type { CloseEventDisplaySeries } from "../types";

type DashboardSummaryProps = DashboardInputs & {
  displaySeries: CloseEventDisplaySeries | null;
  busyStatus: string | null;
  onBrowseReport: () => void;
  onFocusDocuments: () => void;
  onRunTradeAnalysis: () => void;
  onRunDailyAnalysis: () => void;
};

/** Presentation-only MVP dashboard. Financial results always originate in the Core. */
export function DashboardSummary({
  displaySeries, busyStatus, onBrowseReport, onFocusDocuments, onRunTradeAnalysis, onRunDailyAnalysis, ...inputs
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
      {busy && <div className="trl-dashboard__grid trl-dashboard__grid--preview">
        <DashboardCard title="Verified balance curve" state={{ kind: "loading", message: "Preparing balance curve" }} className="trl-dashboard__card--chart" />
        <DashboardCard title="Key results" state={{ kind: "loading", message: "Preparing key results" }} />
      </div>}
    </section>;
  }

  const { dataset, closeEvents, documents, kpis } = model;
  // One action per missing source, placed on the first tile of that source.
  const actionFor = (kpi: Kpi): CardAction | undefined => {
    if (kpi.state === "ready") return undefined;
    if (kpi.id === "net-pnl") return { label: "Run trade analysis", onClick: onRunTradeAnalysis, disabled: busy };
    if (kpi.id === "worst-day") return { label: "Run daily balance analysis", onClick: onRunDailyAnalysis, disabled: busy };
    return undefined;
  };
  const statistics = inputs.statistics!;
  const seriesError = inputs.errors?.displaySeries ?? null;
  const seriesState: CardState = displaySeries
    ? { kind: "ready" }
    : seriesError ? { kind: "error", message: seriesError } : { kind: "empty", message: "Not calculated yet. Run trade analysis to build the close-event P/L views." };
  const seriesAction: CardAction = { label: "Run trade analysis", onClick: onRunTradeAnalysis, disabled: busy };

  return <section className="trl-dashboard" aria-label="Research dashboard" aria-busy={busy}>
    <header className="trl-dashboard__header">
      <div><h3>Research dashboard</h3><p>{dataset.filename} · verified source evidence and local Core results.</p></div>
      <span className="trl-dashboard__status">{dataset.status}</span>
    </header>
    {busy && <p className="trl-dashboard__progress" role="status">{busyStatus} The results below belong to the previous import until this run completes.</p>}
    <section className="trl-dashboard__workflow" aria-label="Research workflow">
      <div className="trl-dashboard__workflow-step"><span className="trl-dashboard__step-number">1</span><div><strong>Import</strong><p>Verified source evidence is ready.</p></div><button type="button" disabled={busy} onClick={onBrowseReport}>Import another</button></div>
      <div className="trl-dashboard__workflow-step"><span className="trl-dashboard__step-number">2</span><div><strong>Analyse</strong><p>{closeEvents ? "Verified close-event analysis is ready." : "Run verified close-event analysis next."}</p></div>{!closeEvents && <button type="button" className="mod-cta" disabled={busy} onClick={onRunTradeAnalysis}>Run analysis</button>}</div>
      <div className="trl-dashboard__workflow-step"><span className="trl-dashboard__step-number">3</span><div><strong>Document</strong><p>{documents.linkedCount} of 3 linked: Strategy → Experiment → Report.</p></div><button type="button" onClick={onFocusDocuments}>Open documents</button></div>
    </section>
    <section className="trl-kpi-row" aria-label="Key results">
      {kpis.map((kpi) => <KpiTile key={kpi.id} kpi={kpi} action={actionFor(kpi)} />)}
    </section>
    <div className="trl-dashboard__grid">
      <DashboardCard title="Verified balance curve" state={{ kind: "ready" }} className="trl-dashboard__card--chart">
        <BalanceChart points={statistics.balance_curve.points} currency={statistics.currency} />
      </DashboardCard>
      <DashboardCard title="Dataset" state={{ kind: "ready" }}>
        <strong>{dataset.filename}</strong>
        <p>{dataset.detail}</p>
        <p className="trl-m0__note">{dataset.adapter}</p>
      </DashboardCard>
      <DashboardCard title="Close-event P/L" state={seriesState} action={seriesAction} className="trl-dashboard__card--chart">
        {displaySeries && <CloseEventBars series={displaySeries} />}
      </DashboardCard>
      <DashboardCard title="Research documents" state={{ kind: "ready" }}>
        <strong>{documents.linkedCount} of 3 linked</strong>
        <ul className="trl-doc-links">
          <li className={documents.strategy ? "is-linked" : ""}>Strategy — {documents.strategy ? "linked" : "not linked"}</li>
          <li className={documents.experiment ? "is-linked" : ""}>Experiment — {documents.experiment ? "linked" : "not linked"}</li>
          <li className={documents.report ? "is-linked" : ""}>Report — {documents.report ? "linked" : "not linked"}</li>
        </ul>
        <button type="button" onClick={onFocusDocuments}>{documents.linkedCount === 0 ? "Start Strategy → Experiment → Report" : "Open document workflow"}</button>
        {!closeEvents && <p className="trl-m0__note">Tip: run trade analysis first so the report includes verified close events.</p>}
      </DashboardCard>
      <DashboardCard title="Daily P/L calendar" state={seriesState} className="trl-dashboard__card--wide">
        {displaySeries && <DailyPnlCalendar series={displaySeries} />}
      </DashboardCard>
      <DashboardCard title="Monthly results" state={seriesState} className="trl-dashboard__card--wide">
        {displaySeries && <MonthlyPnlTable series={displaySeries} />}
      </DashboardCard>
    </div>
  </section>;
}

function KpiTile({ kpi, action }: { kpi: Kpi; action?: CardAction }): React.ReactElement {
  return <div className={`trl-kpi trl-kpi--${kpi.state} trl-kpi--${kpi.tone}`} title={kpi.exact}>
    <span className="trl-kpi__label">{kpi.label}</span>
    <strong className="trl-kpi__value">{kpi.value}</strong>
    <span className="trl-kpi__detail" role={kpi.state === "error" ? "alert" : undefined}>{kpi.detail}</span>
    {action && <button type="button" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>}
  </div>;
}
