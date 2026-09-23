import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Notice } from "obsidian";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import { localPathForSelectedFile } from "../../services/local-file-path";
import type { DatasetEvidence, ParetoEvaluation, PortfolioCombination, PortfolioExploration, SavedCombinationEntry } from "../../types";
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
  const [archived, setArchived] = useState<DatasetEvidence[]>([]);
  const [tracks, setTracks] = useState<TrackDraft[]>([]);
  const [capital, setCapital] = useState("");
  const [period, setPeriod] = useState<"UNION" | "COMMON">("UNION");
  const [result, setResult] = useState<{ combination: PortfolioCombination; labels: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runs = useRef(new LatestRun()).current;
  const [saved, setSaved] = useState<SavedCombination[]>([]);
  const [unavailable, setUnavailable] = useState<SavedCombinationEntry[]>([]);
  const [evaluation, setEvaluation] = useState<ParetoEvaluation | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [exploration, setExploration] = useState<{ result: PortfolioExploration; labels: string[]; tracks: string[][]; capital: string; period: "UNION" | "COMMON" } | null>(null);
  const [explorerSelected, setExplorerSelected] = useState<string | null>(null);
  const evaluations = useRef(new LatestRun()).current;

  const refreshLibrary = useCallback(async (): Promise<void> => {
    try { const registry = await service.listRegistry(); setLibrary(registry.entries); setArchived(registry.archived_entries ?? []); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }, [service]);
  useEffect(() => { void refreshLibrary(); }, [refreshLibrary]);

  const applySaved = (entries: SavedCombinationEntry[]): void => {
    setSaved(entries.filter((entry) => entry.combination !== null).map((entry) => ({ key: entry.saved.key, name: entry.saved.name, labels: entry.saved.labels, combination: entry.combination! })));
    setUnavailable(entries.filter((entry) => entry.combination === null));
  };
  // Saved setups live in the worker workspace; their numbers are recalculated on load.
  useEffect(() => {
    service.listSavedCombinations().then((listed) => applySaved(listed.entries)).catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [service]);
  const savedKeyOf = (combination: PortfolioCombination): string | null => saved.find((item) => item.combination.combination_id === combination.combination_id)?.key ?? null;

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

  const archive = async (entry: DatasetEvidence, restore: boolean): Promise<void> => {
    setError(null);
    try {
      const result = restore ? await service.restoreDataset(entry.dataset_ref) : await service.archiveDataset(entry.dataset_ref);
      await refreshLibrary();
      const users = result.used_by.map((use) => use.kind === "SAVED_COMBINATION" ? `saved combination "${use.name}"` : "a parameter study").join(", ");
      new Notice(restore ? `${entry.original_filename} restored to the library.` : `${entry.original_filename} archived.${users ? ` Still used by ${users}; those keep working.` : ""}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
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

  const saveCurrent = async (): Promise<void> => {
    if (!result) return;
    const name = saveName.trim() || result.labels.join(" + ");
    const combination = result.combination;
    setError(null);
    try {
      const stored = await service.saveCombination(name, result.labels, combination.tracks.map((track) => track.dataset_refs), combination.configuration.starting_capital, combination.configuration.window);
      applySaved((await service.listSavedCombinations()).entries);
      setActiveKey(stored.saved.key);
      setSaveName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const removeSaved = async (key: string): Promise<void> => {
    setError(null);
    try {
      await service.deleteSavedCombination(key);
      setSaved((current) => current.filter((item) => item.key !== key));
      setUnavailable((current) => current.filter((entry) => entry.saved.key !== key));
      if (activeKey === key) setActiveKey(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
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
        setActiveKey(savedKeyOf(combination));
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
            ? <span className="trl-m0__note">{(() => { const index = tracks.findIndex((track) => track.refs.includes(entry.dataset_ref)); return `In track ${index + 1}${tracks[index]?.label ? ` · ${tracks[index]!.label}` : ""}`; })()}</span>
            : <span className="trl-portfolio__assign">
              <button type="button" className="trl-link-button" disabled={busy !== null} title="Hide from the library. Nothing is deleted; restore it any time from Archived reports." onClick={() => void archive(entry, false)}>Archive</button>
              <button type="button" disabled={busy !== null} onClick={() => change(addTrack(tracks, entry.dataset_ref, entry.original_filename.replace(/\.xlsx$/i, "")))}>New track</button>
              {tracks.length > 0 && <select value="" disabled={busy !== null} onChange={(event) => { if (event.currentTarget.value) change(addToTrack(tracks, event.currentTarget.value, entry.dataset_ref)); }}>
                <option value="">Chain onto…</option>
                {tracks.map((track, index) => <option key={track.key} value={track.key}>{index + 1}. {track.label || track.key}</option>)}
              </select>}
            </span>}</td>
        </tr>)}</tbody>
      </table>}
      {archived.length > 0 && <details className="trl-portfolio__archived">
        <summary>Archived reports ({archived.length})</summary>
        <p className="trl-m0__note">Archived reports are hidden from the library but not deleted; saved combinations and studies that use them keep working.</p>
        <table className="trl-portfolio__table">
          <tbody>{archived.map((entry) => <tr key={entry.dataset_ref}>
            <td>{describe(entry, entry.dataset_ref)}</td>
            <td>{entry.event_count}</td>
            <td><button type="button" disabled={busy !== null} onClick={() => void archive(entry, true)}>Restore</button></td>
          </tr>)}</tbody>
        </table>
      </details>}
    </section>

    <section className="trl-page__surface">
      <h4>2. Tracks</h4>
      <p className="trl-m0__note">A track is one strategy's history: one report, or consecutive reports of the same EA chained together (checked by the Core).</p>
      {tracks.length === 0 ? <p className="trl-m0__note">Create a track from a report above.</p> : <ul className="trl-portfolio__tracks">{tracks.map((track, index) => <li key={track.key}>
        <span className="trl-portfolio__track-number" aria-label={`Track ${index + 1}`}>{index + 1}</span>
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
      <button type="button" disabled={busy !== null} onClick={() => void saveCurrent()}>{savedKeyOf(result.combination) ? "Rename saved combination" : "Save combination for comparison"}</button>
    </section>}
    {result && <CombinedDashboard combination={result.combination} labels={result.labels} />}
    <SavedCombinations saved={saved} evaluation={evaluation} activeKey={activeKey} onOpen={(key) => { const item = saved.find((entry) => entry.key === key); if (item) { setResult({ combination: item.combination, labels: item.labels }); setActiveKey(key); } }} onRemove={(key) => void removeSaved(key)} />
    {unavailable.length > 0 && <ul className="trl-batch__findings">{unavailable.map((entry) => <li key={entry.saved.key}>
      <strong className="is-blocked">Saved combination "{entry.saved.name}" cannot be recalculated</strong>
      <span>{entry.error?.message ?? "Unknown error."} Its reports may have been removed from the workspace.</span>
      <button type="button" onClick={() => void removeSaved(entry.saved.key)}>Remove</button>
    </li>)}</ul>}
    {exploration && <CombinationExplorer exploration={exploration.result} labels={exploration.labels} selectedId={explorerSelected} onPick={(members, id) => { setExplorerSelected(id); void runCombine(members.map((index) => exploration.tracks[index]!), members.map((index) => exploration.labels[index]!), exploration.capital, exploration.period); }} />}
  </section>;
}
