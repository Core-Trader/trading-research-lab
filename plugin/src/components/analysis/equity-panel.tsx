import React, { useEffect, useRef, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { localPathForSelectedFile } from "../../services/local-file-path";
import type { EquityAvailabilityResult, EquityLogAttachment, EquityMetrics } from "../../types";
import { DismissButton } from "../dismiss-button";
import { drawdownGap, equityGeometry } from "./equity-model";

const MODES = ["Every tick based on real ticks", "Every tick", "1 minute OHLC", "Open prices only"];

/**
 * Equity evidence (PL-006): attach a TRL tester equity log to the loaded
 * report, then show floating drawdown and daily equity loss. Every number is
 * Core output; without a verified log, equity stays unavailable.
 */
export function EquityPanel({ service, datasetRef, availability, balanceDrawdown, currency, onChanged }: {
  service: ResearchService;
  datasetRef: string;
  availability: EquityAvailabilityResult | null;
  balanceDrawdown: string | null;
  currency: string | null;
  onChanged: () => void;
}): React.ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState(MODES[0]!);
  const [attempt, setAttempt] = useState<EquityLogAttachment | null>(null);
  const [metrics, setMetrics] = useState<EquityMetrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = availability?.status === "AVAILABLE";

  useEffect(() => {
    setMetrics(null);
    if (!available) return;
    let current = true;
    service.equityMetrics(datasetRef).then((result) => { if (current) setMetrics(result); }).catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { current = false; };
  }, [service, datasetRef, available]);

  const attach = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const path = localPathForSelectedFile(file);
      if (!path.toLowerCase().endsWith(".csv")) throw new Error("Select the TRL equity log (.csv) written by TRL_EquityLogger.");
      const result = await service.attachEquityLog(datasetRef, path, mode);
      setAttempt(result);
      if (result.status === "LINKED_VERIFIED") onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } finally { setBusy(false); }
  };

  const geometry = metrics ? equityGeometry(metrics.display_series) : null;
  const gap = metrics ? drawdownGap(metrics.maximum_equity_drawdown, balanceDrawdown) : null;
  const unit = currency ?? "";

  return <section className="trl-m0__analysis-result trl-equity" aria-label="Equity evidence">
    <h4>Equity (floating drawdown)</h4>
    {!available && <>
      <p className="trl-m0__note">MT5 reports show closed trades only, so how deep open positions went is unknown. Record it with the TRL equity logger (see the help page "Recording equity in MT5 backtests"), then attach the log here.</p>
      <div className="trl-m0__scenario-fields">
        <label className="trl-m0__field"><span>Modelling mode of that test</span><select value={mode} onChange={(event) => setMode(event.currentTarget.value)}>{MODES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <input ref={input} className="trl-m0__file-input" type="file" accept=".csv" onChange={(event) => void attach(event)} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Checking the log…" : "Attach equity log (.csv)…"}</button>
    </>}
    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
    {attempt && attempt.status !== "LINKED_VERIFIED" && <ul className="trl-batch__findings"><li>
      <DismissButton onDismiss={() => setAttempt(null)} />
      <strong className="is-blocked">Equity log not attached</strong>
      {attempt.findings.map((finding) => <span key={finding.code}>{finding.message}</span>)}
    </li></ul>}
    {metrics && <>
      <dl className="trl-m0__diagnostic-grid">
        <dt>Max equity drawdown</dt><dd><strong>{metrics.maximum_equity_drawdown} {unit}</strong>{metrics.maximum_equity_drawdown_percent !== null ? ` (${Number(metrics.maximum_equity_drawdown_percent).toFixed(2)}% of the prior peak)` : ""}</dd>
        {availability?.status === "AVAILABLE" && <><dt>MT5 reported</dt><dd>{availability.equity.mt5_reported_equity_drawdown ?? "—"} {unit}{availability.equity.findings.includes("EQUITY_DRAWDOWN_DIFFERS") ? " — differs from the log (see findings)" : " — agrees with the log"}</dd></>}
        {balanceDrawdown !== null && <><dt>Realised-balance drawdown</dt><dd>{balanceDrawdown} {unit}</dd></>}
        <dt>Worst day (equity)</dt><dd>{metrics.worst_day.date}: −{metrics.worst_day.loss} {unit}{metrics.worst_day.loss_percent_of_initial !== null ? ` (${Number(metrics.worst_day.loss_percent_of_initial).toFixed(2)}% of the initial balance)` : ""}, low at {metrics.worst_day.lowest_at.replace("T", " ")}</dd>
        <dt>Evidence</dt><dd>TRL tester log, {metrics.row_count} rows; modelling {availability?.status === "AVAILABLE" ? availability.equity.modelling_mode : "—"}</dd>
      </dl>
      {gap && <p className="trl-equity__gap" role="note">{gap}</p>}
      {geometry && <figure className="trl-equity__chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Balance and equity from ${metrics.display_series[0]?.time} to ${metrics.display_series.at(-1)?.time}; shaded band is the lowest to highest equity`}>
          <polygon className="trl-equity__band" points={geometry.band} />
          <polyline className="trl-equity__equity" points={geometry.equity} vectorEffect="non-scaling-stroke" />
          <polyline className="trl-equity__balance" points={geometry.balance} vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption className="trl-m0__note">Balance (solid) and equity at each interval close (dashed); the shaded band spans the lowest to highest equity reached. Range {Number(geometry.low).toFixed(2)}–{Number(geometry.high).toFixed(2)} {unit}.</figcaption>
      </figure>}
      <ul className="trl-batch__warnings">{metrics.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </>}
  </section>;
}
