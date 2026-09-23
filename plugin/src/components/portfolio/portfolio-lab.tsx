import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Notice } from "obsidian";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import { localPathForSelectedFile } from "../../services/local-file-path";
import type { DatasetEvidence, ParetoEvaluation, PortfolioCombination, PortfolioExploration } from "../../types";
import { CombinationExplorer } from "./combination-explorer";
import { CombinedDashboard } from "./combined-dashboard";
import { SavedCombinations, type SavedCombination } from "./saved-combinations";
import { addToTrack, addTrack, combinationRequest, removeReport, removeTrack, renameTrack, toggleIncluded, type TrackDraft } from "./portfolio-model";

type Props = { service: ResearchService };

/**
 * Portfolio Lab v1: build strategy tracks from imported reports and combine
 * them on one account (as reported). All results come from portfolio.combine.
 */
export function PortfolioLab({ service }: Props): React.ReactElement {
  const [library, setLibrary] = useState<DatasetEvidence[]>([]);
  const [tracks, setTracks] = useState<TrackDraft[]>([]);
  const [capital, setCapital] = useState("");
  const [period, setPeriod] = useState<"UNION" | "COMMON">("UNION");
  const [result, setResult] = useState<{ combination: PortfolioCombination; labels: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runs = useRef(new LatestRun()).current;
  const [saved, setSaved] = useState<SavedCombination[]>([]);
  const [evaluation, setEvaluation] = useState<ParetoEvaluation | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [exploration, setExploration] = useState<{ result: PortfolioExploration; labels: string[]; tracks: string[][]; capital: string; period: "UNION" | "COMMON" } | null>(null);
  const [explorerSelected, setExplorerSelected] = useState<string | null>(null);
  const evaluations = useRef(new LatestRun()).current;

  const refreshLibrary = useCallback(async (): Promise<void> => {
    try { setLibrary((await service.listRegistry()).entries); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }, [service]);
  useEffect(() => { void refreshLibrary(); }, [refreshLibrary]);

  const byRef = useMemo(() => new Map(library.map((entry) => [entry.dataset_ref, entry])), [library]);
  const assigned = useMemo(() => new Set(tracks.flatMap((track) => track.refs)), [tracks]);
  const request = combinationRequest(tracks);
  const suggestedCapital = useMemo(() => {
    const deposits = request.tracks.flat().map((ref) => Number(byRef.get(ref)?.supplied_facts.initial_deposit ?? NaN)).filter((value) => Number.isFinite(value));
    return deposits.length ? String(Math.max(...deposits)) : "";
  }, [request.tracks, byRef]);

  const change = (next: TrackDraft[]): void => { setTracks(next); setResult(null); setError(null); };

  const importFiles = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    setError(null);
    try {
      const paths = files.map(localPathForSelectedFile);
      if (paths.some((path) => !path.toLowerCase().endsWith(".xlsx"))) throw new Error("Select MT5 Strategy Tester .xlsx reports.");
      for (const [index, path] of paths.entries()) {
        setBusy(`Importing and verifying report ${index + 1} of ${paths.length}…`);
        await service.intakeMt5Excel(path);
      }
      await refreshLibrary();
      new Notice(`${paths.length} report(s) imported into the library.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const resolveAmount = (): string | null => {
    const amount = (capital.trim() || suggestedCapital).trim();
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) { setError("Enter a positive starting capital, for example 10000."); return null; }
    return amount;
  };

  // Pareto status of saved combinations always comes from the Core.
  useEffect(() => {
    if (saved.length < 2) { setEvaluation(null); return; }
    const token = evaluations.begin();
    setEvaluation(null);
    service.paretoEvaluate(saved.map((item) => ({ id: item.key, values: { net_pnl: item.combination.net_pnl, maximum_drawdown: item.combination.metrics.balance_metrics.maximum_drawdown } })), [{ metric: "net_pnl", direction: "MAX" }, { metric: "maximum_drawdown", direction: "MIN" }])
      .then((evaluated) => { if (evaluations.isCurrent(token)) setEvaluation(evaluated); })
      .catch((caught) => { if (evaluations.isCurrent(token)) setError(caught instanceof Error ? caught.message : String(caught)); });
  }, [saved, service, evaluations]);

  const saveCurrent = (): void => {
    if (!result) return;
    const name = saveName.trim() || result.labels.join(" + ");
    const key = result.combination.combination_id;
    setSaved((current) => [...current.filter((item) => item.key !== key), { key, name, labels: result.labels, combination: result.combination }]);
    setActiveKey(key);
    setSaveName("");
  };

  const runExplore = async (): Promise<void> => {
    const amount = resolveAmount();
    if (amount === null) return;
    setBusy(`Exploring all combinations of ${request.tracks.length} tracks…`);
    setError(null);
    try {
      const explored = await service.portfolioExplore(request.tracks, amount, period);
      setExploration({ result: explored, labels: request.labels, tracks: request.tracks, capital: amount, period });
      setExplorerSelected(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const runCombine = async (tracksToCombine = request.tracks, labelsToUse = request.labels, amountOverride?: string, periodOverride?: "UNION" | "COMMON"): Promise<void> => {
    const amount = amountOverride ?? resolveAmount();
    if (amount === null) return;
    const token = runs.begin();
    setBusy(`Combining ${tracksToCombine.length} track(s) on ${amount}…`);
    setError(null);
    try {
      const combination = await service.portfolioCombine(tracksToCombine, amount, periodOverride ?? period);
      if (runs.isCurrent(token)) {
        setResult({ combination, labels: labelsToUse });
        setActiveKey(saved.some((item) => item.key === combination.combination_id) ? combination.combination_id : null);
      }
    } catch (caught) {
      if (runs.isCurrent(token)) { setResult(null); setError(caught instanceof Error ? caught.message : String(caught)); }
    } finally {
      if (runs.isCurrent(token)) setBusy(null);
    }
  };

  const describe = (entry: DatasetEvidence | undefined, ref: string): string => entry ? `${entry.original_filename} · ${entry.supplied_facts.symbol ?? "?"} ${entry.supplied_facts.period ?? ""}` : ref;

  return <section className="trl-page" aria-label="Portfolio Lab">
    <header className="trl-page__header"><div><h3>Portfolio Lab</h3><p>Combine EA backtests as if they had traded together on one account, and compare how return balances against drawdown.</p></div></header>
    <p className="trl-portfolio__caveat" role="note"><strong>Realised balance only.</strong> MT5 reports do not include floating (open-position) losses. For DCA, grid or martingale EAs the real equity drawdown can be far larger than shown here. Do not judge prop-firm suitability from these figures.</p>

    <section className="trl-page__surface">
      <h4>1. Report library</h4>
      <input ref={inputRef} className="trl-m0__file-input" type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void importFiles(event)} />
      <div className="trl-m0__actions">
        <button type="button" className="mod-cta" disabled={busy !== null} onClick={() => inputRef.current?.click()}>Import backtest reports…</button>
        <button type="button" disabled={busy !== null} onClick={() => void refreshLibrary()}>Refresh</button>
      </div>
      {library.length === 0 ? <p className="trl-m0__note">No reports imported yet.</p> : <table className="trl-portfolio__table">
        <thead><tr><th>Report</th><th>Events</th><th>Track</th></tr></thead>
        <tbody>{library.map((entry) => <tr key={entry.dataset_ref}>
          <td>{describe(entry, entry.dataset_ref)}</td>
          <td>{entry.event_count}</td>
          <td>{assigned.has(entry.dataset_ref)
            ? <span className="trl-m0__note">In {tracks.find((track) => track.refs.includes(entry.dataset_ref))?.label || "a track"}</span>
            : <span className="trl-portfolio__assign">
              <button type="button" disabled={busy !== null} onClick={() => change(addTrack(tracks, entry.dataset_ref, entry.original_filename.replace(/\.xlsx$/i, "")))}>New track</button>
              {tracks.length > 0 && <select value="" disabled={busy !== null} onChange={(event) => { if (event.currentTarget.value) change(addToTrack(tracks, event.currentTarget.value, entry.dataset_ref)); }}>
                <option value="">Chain onto…</option>
                {tracks.map((track) => <option key={track.key} value={track.key}>{track.label || track.key}</option>)}
              </select>}
            </span>}</td>
        </tr>)}</tbody>
      </table>}
    </section>

    <section className="trl-page__surface">
      <h4>2. Tracks</h4>
      <p className="trl-m0__note">A track is one strategy's history: one report, or consecutive reports of the same EA chained together (checked by the Core).</p>
      {tracks.length === 0 ? <p className="trl-m0__note">Create a track from a report above.</p> : <ul className="trl-portfolio__tracks">{tracks.map((track) => <li key={track.key}>
        <label className="trl-portfolio__include"><input type="checkbox" checked={track.included} onChange={() => change(toggleIncluded(tracks, track.key))} /> Include</label>
        <input className="trl-portfolio__label" value={track.label} aria-label="Track name" onChange={(event) => change(renameTrack(tracks, track.key, event.currentTarget.value))} />
        <ol>{track.refs.map((ref) => <li key={ref}>{describe(byRef.get(ref), ref)} <button type="button" onClick={() => change(removeReport(tracks, ref))}>Remove</button></li>)}</ol>
        <button type="button" onClick={() => change(removeTrack(tracks, track.key))}>Delete track</button>
      </li>)}</ul>}
    </section>

    <section className="trl-page__surface">
      <h4>3. Combine</h4>
      <div className="trl-m0__scenario-fields">
        <label className="trl-m0__field"><span>Starting capital (you declare it)</span><input inputMode="decimal" value={capital} placeholder={suggestedCapital || "10000"} onChange={(event) => { setCapital(event.currentTarget.value); setResult(null); }} /></label>
        <label className="trl-m0__field"><span>Period</span><select value={period} onChange={(event) => { setPeriod(event.currentTarget.value as "UNION" | "COMMON"); setResult(null); }}>
          <option value="UNION">Each track while it was active (union)</option>
          <option value="COMMON">Only when all tracks were active (common)</option>
        </select></label>
      </div>
      <div className="trl-m0__actions">
        <button type="button" className="mod-cta" disabled={busy !== null || request.tracks.length === 0} onClick={() => void runCombine()}>Combine {request.tracks.length} track{request.tracks.length === 1 ? "" : "s"}</button>
        <button type="button" disabled={busy !== null || request.tracks.length < 2 || request.tracks.length > 10} onClick={() => void runExplore()} title="Compute every combination of the included tracks (2 to 10 tracks)">Explore all combinations</button>
      </div>
      {!capital.trim() && suggestedCapital && <span className="trl-m0__note"> Uses {suggestedCapital} (largest initial deposit) unless you enter another amount.</span>}
      {busy && <p className="trl-dashboard__progress" role="status">{busy}</p>}
      {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    </section>

    {result && <section className="trl-portfolio__save">
      <input value={saveName} placeholder={result.labels.join(" + ")} aria-label="Combination name" onChange={(event) => setSaveName(event.currentTarget.value)} />
      <button type="button" onClick={saveCurrent}>{saved.some((item) => item.key === result.combination.combination_id) ? "Update saved combination" : "Save combination for comparison"}</button>
    </section>}
    {result && <CombinedDashboard combination={result.combination} labels={result.labels} />}
    <SavedCombinations saved={saved} evaluation={evaluation} activeKey={activeKey} onOpen={(key) => { const item = saved.find((entry) => entry.key === key); if (item) { setResult({ combination: item.combination, labels: item.labels }); setActiveKey(key); } }} onRemove={(key) => { setSaved((current) => current.filter((item) => item.key !== key)); if (activeKey === key) setActiveKey(null); }} />
    {exploration && <CombinationExplorer exploration={exploration.result} labels={exploration.labels} selectedId={explorerSelected} onPick={(members, id) => { setExplorerSelected(id); void runCombine(members.map((index) => exploration.tracks[index]!), members.map((index) => exploration.labels[index]!), exploration.capital, exploration.period); }} />}
  </section>;
}
