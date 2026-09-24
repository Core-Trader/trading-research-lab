import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import { localPathForSelectedFile } from "../../services/local-file-path";
import type { Constraint, SweepComparison, SweepEvaluation, SymbolSweep } from "../../types";
import { AuditTrail } from "../audit-trail";
import { DismissButton } from "../dismiss-button";
import { GuidanceBlock } from "../guidance";
import { TradeOffScatter } from "../tradeoff/trade-off-scatter";
import { RecordTo } from "../research/record-to";
import type { NotesApi } from "../../vault/notes-api";
import type { RecordRequirement } from "../../vault/research-notes-model";
import { MODE_SUGGESTIONS, STATUS_TEXT, metricText, shadeMatrix, sortRows, sweepGuidance, sweepLabel, type SortState } from "./sweep-model";

type ImportResult = { path: string; outcome: "imported" | "existing" | "refused"; message: string };

type Props = {
  service: ResearchService;
  notes: NotesApi;
};

const REQUIREMENT: RecordRequirement = { kinds: ["symbol-scan", "general"] };

const TABLE_METRICS = ["net_profit", "profit_factor", "recovery_factor", "equity_drawdown_pct", "trades", "mt5_sharpe", "expected_payoff"];
const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path;
const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);

/**
 * Symbol scan (SYMBOL_SWEEP_SPEC.md S1–S9): MT5 "All symbols selected in Market
 * Watch" sweeps. Every value and status comes from the Core; TRL marks
 * trade-offs and records the owner's shortlist, never a winner.
 */
export function SymbolScanPage({ service, notes }: Props): React.ReactElement {
  const [xmlPaths, setXmlPaths] = useState<string[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [setPath, setSetPath] = useState("");
  const [mode, setMode] = useState("1 minute OHLC");
  const [library, setLibrary] = useState<SymbolSweep[]>([]);
  const [maxCompare, setMaxCompare] = useState(6);
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [compareRefs, setCompareRefs] = useState<string[]>([]);
  const [axes, setAxes] = useState({ x: "equity_drawdown_pct", y: "net_profit" });
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [evaluation, setEvaluation] = useState<SweepEvaluation | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "net_profit", direction: "desc" });
  const [compareMetric, setCompareMetric] = useState("net_profit");
  const [comparison, setComparison] = useState<SweepComparison | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const xmlInput = useRef<HTMLInputElement>(null);
  const setInput = useRef<HTMLInputElement>(null);
  const runs = useRef(new LatestRun()).current;

  const refresh = useCallback(async (): Promise<SymbolSweep[]> => {
    const listed = await service.listSymbolSweeps();
    setLibrary(listed.sweeps);
    setMaxCompare(listed.max_compare);
    return listed.sweeps;
  }, [service]);
  useEffect(() => { refresh().then((sweeps) => setActiveRef((current) => current ?? sweeps[0]?.sweep_ref ?? null)).catch((caught) => setError(fail(caught))); }, [refresh]);

  const active = library.find((item) => item.sweep_ref === activeRef) ?? null;
  const metrics = active?.metrics ?? [];
  const metricOf = (id: string) => metrics.find((metric) => metric.id === id);
  const labelOf = (id: string): string => metricOf(id)?.label ?? id;

  const evaluate = useCallback(async (sweepRef: string, x: string, y: string, filters: Constraint[]): Promise<void> => {
    const sweep = library.find((item) => item.sweep_ref === sweepRef);
    if (!sweep) return;
    const direction = (id: string): "MAX" | "MIN" => sweep.metrics.find((metric) => metric.id === id)?.default_direction ?? "MAX";
    const token = runs.begin();
    try {
      const result = await service.evaluateSymbolSweep(sweepRef, [{ metric: y, direction: direction(y) }, { metric: x, direction: direction(x) }], filters);
      if (runs.isCurrent(token)) setEvaluation(result);
    } catch (caught) { if (runs.isCurrent(token)) { setEvaluation(null); setError(fail(caught)); } }
  }, [library, runs, service]);
  const filtersValid = constraints.every((constraint) => /^-?\d+(\.\d+)?$/.test(constraint.threshold.trim()));
  useEffect(() => {
    if (!activeRef || !filtersValid) return;
    void evaluate(activeRef, axes.x, axes.y, constraints.map((constraint) => ({ ...constraint, threshold: constraint.threshold.trim() })));
  }, [activeRef, axes, constraints, filtersValid, evaluate]);

  useEffect(() => {
    if (compareRefs.length < 2) { setComparison(null); return; }
    service.compareSymbolSweeps(compareRefs, compareMetric).then(setComparison).catch((caught) => { setComparison(null); setError(fail(caught)); });
  }, [compareRefs, compareMetric, service]);

  const pick = (event: React.ChangeEvent<HTMLInputElement>, extension: string, apply: (path: string) => void): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const path = localPathForSelectedFile(file);
      if (!path.toLowerCase().endsWith(extension)) throw new Error(`Select an MT5 ${extension} file.`);
      apply(path);
    } catch (caught) { setError(fail(caught)); }
  };

  // Browse XML accepts several files; a .set belongs to one EA, so it is used only when a single file is imported.
  const pickXml = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    try {
      const paths = files.map((item) => localPathForSelectedFile(item));
      const wrong = paths.filter((path) => !path.toLowerCase().endsWith(".xml"));
      if (wrong.length) throw new Error(`Select MT5 .xml files only (not: ${wrong.map(fileName).join(", ")}).`);
      setXmlPaths(paths);
      setImportResults(null);
    } catch (caught) { setError(fail(caught)); }
  };

  const importSweeps = async (): Promise<void> => {
    const paths = xmlPaths;
    setError(null);
    setImportResults(null);
    const results: ImportResult[] = [];
    let lastRef: string | null = null;
    for (const [index, path] of paths.entries()) {
      setBusy(`Importing ${index + 1} of ${paths.length}: ${fileName(path)}…`);
      try {
        const sweep = await service.intakeSymbolSweep(path, mode.trim(), paths.length === 1 ? setPath.trim() || null : null);
        lastRef = sweep.sweep_ref;
        results.push({ path, outcome: sweep.created === false ? "existing" : "imported", message: sweep.created === false ? sweepLabel(sweep) : `${sweepLabel(sweep)}: ${sweep.row_count} symbols` });
      } catch (caught) {
        results.push({ path, outcome: "refused", message: fail(caught) });
      }
    }
    setBusy(null);
    await refresh().catch((caught) => setError(fail(caught)));
    if (lastRef) setActiveRef(lastRef);
    setImportResults(results);
    // Keep only the refused files selected, so a retry does not repeat the ones that worked.
    setXmlPaths(results.filter((item) => item.outcome === "refused").map((item) => item.path));
    if (results.every((item) => item.outcome !== "refused")) setSetPath("");
  };

  const toggleCompare = (ref: string): void => setCompareRefs((current) => current.includes(ref) ? current.filter((item) => item !== ref) : current.length >= maxCompare ? current : [...current, ref]);
  const toggleShortlist = (symbol: string): void => { setRecorded(null); setShortlist((current) => current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol].sort()); };

  const remove = async (sweep: SymbolSweep): Promise<void> => {
    if (!window.confirm(`Delete TRL's copy of ${sweepLabel(sweep)}? Your original file is not touched; you can import it again.`)) return;
    try {
      await service.deleteSymbolSweep(sweep.sweep_ref);
      setCompareRefs((current) => current.filter((item) => item !== sweep.sweep_ref));
      const remaining = await refresh();
      if (activeRef === sweep.sweep_ref) { setActiveRef(remaining[0]?.sweep_ref ?? null); setEvaluation(null); }
    } catch (caught) { setError(fail(caught)); }
  };

  const recordShortlist = async (): Promise<void> => {
    const refs = [...new Set([...(activeRef ? [activeRef] : []), ...compareRefs])];
    setBusy("Recording the shortlist…");
    try {
      const rendered = await service.renderSymbolShortlist(refs, shortlist, reason);
      if (!target) throw new Error("Choose or create an experiment under Record to.");
      await notes.record(target, rendered.markdown, rendered.shortlist_id);
      setRecorded(`Recorded ${shortlist.length} symbol(s) in ${target}.`);
    } catch (caught) { setError(fail(caught)); } finally { setBusy(null); }
  };

  const rows = useMemo(() => evaluation ? sortRows(evaluation.rows, sort) : [], [evaluation, sort]);
  const points = useMemo(() => (evaluation?.rows ?? []).map((row) => ({ id: row.symbol, label: row.symbol, x: (row[axes.x] as string) ?? null, y: (row[axes.y] as string) ?? null, status: row.pareto.status, rank: row.pareto.rank })), [evaluation, axes]);
  const shades = useMemo(() => comparison ? shadeMatrix(comparison, metricOf(compareMetric)?.default_direction ?? null) : [], [comparison, compareMetric, metrics]);
  const metricOptions = metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>);
  const header = (key: string, label: string): React.ReactElement => <th scope="col" aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" className="trl-link-button" onClick={() => setSort({ key, direction: sort.key === key && sort.direction === "desc" ? "asc" : "desc" })}>{label}{sort.key === key ? (sort.direction === "desc" ? " ▼" : " ▲") : ""}</button>
  </th>;

  return <section className="trl-page" aria-label="Symbol scan">
    <header className="trl-page__header"><div><h3>Symbol scan</h3><p>See how one EA did on every symbol in an MT5 symbol sweep, compare EAs side by side, and shortlist symbols for realistic re-tests. TRL marks trade-offs; it never picks a winner.</p></div></header>

    <section className="trl-page__surface">
      <h4>1. Import a symbol sweep</h4>
      <p className="trl-m0__note">In MT5, optimise with <strong>All symbols selected in Market Watch</strong>, then on the Optimization results tab right-click → Export to XML.</p>
      <input ref={xmlInput} className="trl-m0__file-input" type="file" accept=".xml" multiple onChange={pickXml} />
      <input ref={setInput} className="trl-m0__file-input" type="file" accept=".set" onChange={(event) => pick(event, ".set", setSetPath)} />
      <div className="trl-m0__scenario-fields">
        <label className="trl-m0__field"><span>Symbol sweep results (.xml): one or several files</span>{xmlPaths.length > 1
          ? <span className="trl-sweep__picked">{xmlPaths.length} files: {xmlPaths.map(fileName).join(", ")}</span>
          : <input value={xmlPaths[0] ?? ""} onChange={(event) => setXmlPaths(event.currentTarget.value ? [event.currentTarget.value] : [])} placeholder="C:\\path\\to\\sweep.xml" />}</label>
        <label className="trl-m0__field"><span>EA settings file (.set), optional: records the inputs the sweep used{xmlPaths.length > 1 ? " (only with a single file)" : ""}</span><input value={setPath} disabled={xmlPaths.length > 1} onChange={(event) => setSetPath(event.currentTarget.value)} placeholder={xmlPaths.length > 1 ? "Import files one at a time to attach a .set to each" : "C:\\path\\to\\ea.set"} /></label>
        <label className="trl-m0__field"><span>Modelling mode (you declare it; the XML does not say)</span><input list="trl-sweep-modes" value={mode} onChange={(event) => setMode(event.currentTarget.value)} /><datalist id="trl-sweep-modes">{MODE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></label>
      </div>
      <div className="trl-m0__actions">
        <button type="button" disabled={busy !== null} onClick={() => xmlInput.current?.click()}>Browse XML…</button>
        <button type="button" disabled={busy !== null || xmlPaths.length > 1} onClick={() => setInput.current?.click()}>Browse .set…</button>
        <button type="button" className="mod-cta" disabled={busy !== null || xmlPaths.length === 0 || !xmlPaths.every((path) => path.trim().toLowerCase().endsWith(".xml")) || !mode.trim()} onClick={() => void importSweeps()}>{xmlPaths.length > 1 ? `Import ${xmlPaths.length} sweeps` : "Import sweep"}</button>
      </div>
      {busy && <p className="trl-dashboard__progress" role="status">{busy}</p>}
      {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
      {notice && <p className="trl-exploration__notice" role="status">{notice}<DismissButton onDismiss={() => setNotice(null)} /></p>}
      {importResults && <ul className="trl-batch__findings" aria-label="Import results"><li>
        <DismissButton onDismiss={() => setImportResults(null)} />
        {importResults.map((item) => <span key={item.path} className={item.outcome === "refused" ? "is-blocked" : undefined}>{item.outcome === "imported" ? "✓ Imported" : item.outcome === "existing" ? "Already in the library" : "Not imported"}: <code>{fileName(item.path)}</code> · {item.message}</span>)}
      </li></ul>}
    </section>

    {library.length > 0 && <section className="trl-page__surface">
      <h4>2. Sweep library</h4>
      <p className="trl-m0__note">Open a sweep to see its symbols. Tick up to {maxCompare} sweeps to compare EAs side by side ({compareRefs.length} of {maxCompare} ticked).</p>
      <table className="trl-portfolio__table">
        <thead><tr><th scope="col">Compare</th><th scope="col">EA</th><th scope="col">Test</th><th scope="col">Symbols</th><th scope="col">Account</th><th scope="col">Inputs</th><th scope="col" /></tr></thead>
        <tbody>{library.map((sweep) => <tr key={sweep.sweep_ref} className={sweep.sweep_ref === activeRef ? "is-active" : undefined}>
          <td><input type="checkbox" aria-label={`Compare ${sweepLabel(sweep)}`} checked={compareRefs.includes(sweep.sweep_ref)} disabled={!compareRefs.includes(sweep.sweep_ref) && compareRefs.length >= maxCompare} onChange={() => toggleCompare(sweep.sweep_ref)} /></td>
          <td><button type="button" className="trl-link-button" onClick={() => setActiveRef(sweep.sweep_ref)}>{sweep.context.expert ?? sweep.source.filename}</button>{sweep.sweep_ref === activeRef && <span className="trl-m0__note"> (open)</span>}</td>
          <td>{sweep.context.timeframe} {sweep.context.start}–{sweep.context.end}<br /><span className="trl-m0__note">{sweep.modelling_mode}</span></td>
          <td>{sweep.row_count}{sweep.zero_trade_symbols.length ? <span className="trl-m0__note"> ({sweep.zero_trade_symbols.length} without trades)</span> : null}</td>
          <td>{sweep.context.deposit} · 1:{sweep.context.leverage}<br /><span className="trl-m0__note">{sweep.context.server}</span></td>
          <td title={sweep.declared_set?.note}>{sweep.declared_set ? `${sweep.declared_set.filename} (declared)` : "not recorded"}</td>
          <td><button type="button" className="trl-link-button is-danger" onClick={() => void remove(sweep)}>Delete…</button></td>
        </tr>)}</tbody>
      </table>
    </section>}

    {active && <section className="trl-page__surface">
      <h4>3. Symbols · {sweepLabel(active)}</h4>
      <div className="trl-exploration__editor">
        <div>
          <strong>Axes</strong>
          <div className="trl-exploration__row"><span>Across</span><select value={axes.x} onChange={(event) => setAxes({ ...axes, x: event.currentTarget.value })}>{metricOptions}</select></div>
          <div className="trl-exploration__row"><span>Up</span><select value={axes.y} onChange={(event) => setAxes({ ...axes, y: event.currentTarget.value })}>{metricOptions}</select></div>
          <p className="trl-m0__note">The frontier uses each metric's usual direction (for example more profit, less drawdown).</p>
        </div>
        <div>
          <strong>Filters (your thresholds)</strong>
          {constraints.map((constraint, index) => <div key={index} className="trl-exploration__row">
            <select value={constraint.metric} onChange={(event) => setConstraints(constraints.map((item, position) => position === index ? { ...item, metric: event.currentTarget.value } : item))}>{metricOptions}</select>
            <select value={constraint.operator} onChange={(event) => setConstraints(constraints.map((item, position) => position === index ? { ...item, operator: event.currentTarget.value as ">=" | "<=" } : item))}><option value=">=">at least</option><option value="<=">at most</option></select>
            <input inputMode="decimal" value={constraint.threshold} placeholder="value" onChange={(event) => setConstraints(constraints.map((item, position) => position === index ? { ...item, threshold: event.currentTarget.value } : item))} />
            <button type="button" onClick={() => setConstraints(constraints.filter((_, position) => position !== index))}>Remove</button>
          </div>)}
          <button type="button" onClick={() => setConstraints([...constraints, { metric: metricOf("trades") ? "trades" : metrics[0]?.id ?? "", operator: ">=", threshold: "" }])}>Add filter</button>
          {!filtersValid && <p className="trl-m0__note">Enter a number in each filter to apply it.</p>}
        </div>
      </div>
      {evaluation && <>
        <TradeOffScatter points={points} xLabel={labelOf(axes.x)} yLabel={labelOf(axes.y)} xBetter={metricOf(axes.x)?.default_direction === "MIN" ? "lower" : "higher"} yBetter={metricOf(axes.y)?.default_direction === "MIN" ? "lower" : "higher"}
          frontierLine selectedId={null} onSelect={(point) => toggleShortlist(point.id)}
          details={(point) => { const row = evaluation.rows.find((item) => item.symbol === point.id); return row ? <>{TABLE_METRICS.filter((id) => id !== axes.x && id !== axes.y && metricOf(id)).map((id) => <span key={id}>{labelOf(id)}: <strong>{metricText(metricOf(id), row[id])}</strong></span>)}<span>{shortlist.includes(row.symbol) ? "✓ In your shortlist (click to remove)" : "Click to add to your shortlist"}</span></> : null; }} />
        <div className="trl-monthly"><table>
          <thead><tr><th scope="col">Shortlist</th>{header("symbol", "Symbol")}{TABLE_METRICS.filter((id) => metricOf(id)).map((id) => <React.Fragment key={id}>{header(id, labelOf(id))}</React.Fragment>)}<th scope="col">Status</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.symbol} className={row.pareto.status === "PARETO" ? "is-frontier" : row.pareto.status === "CONSTRAINED" ? "is-muted" : undefined}>
            <td><input type="checkbox" aria-label={`Shortlist ${row.symbol}`} checked={shortlist.includes(row.symbol)} onChange={() => toggleShortlist(row.symbol)} /></td>
            <th scope="row">{row.symbol}{row.zero_trades ? <span className="trl-m0__note"> (no trades)</span> : null}</th>
            {TABLE_METRICS.filter((id) => metricOf(id)).map((id) => <td key={id} title={String(row[id] ?? "")}>{metricText(metricOf(id), row[id])}</td>)}
            <td title={row.pareto.violations.map((item) => `${labelOf(item.metric)} ${item.operator} ${item.threshold} (is ${item.value ?? "missing"})`).join("; ")}>{STATUS_TEXT[row.pareto.status]}</td>
          </tr>)}</tbody>
        </table></div>
        <GuidanceBlock guidance={sweepGuidance(evaluation, labelOf(axes.x), labelOf(axes.y))} defaultOpen={false} />
        <AuditTrail items={[
          ["Source", <><code>{active.source.filename}</code> · SHA-256 <code>{active.source.sha256.slice(0, 16)}…</code></>],
          ["MT5 title", active.context.title],
          ["Modelling mode", `${active.modelling_mode} (declared by you)`],
          ["Inputs", active.declared_set ? `${active.declared_set.filename}: ${Object.entries(active.declared_set.inputs).map(([name, value]) => `${name}=${value}`).join(", ")}. ${active.declared_set.note}` : "not recorded"],
          ["Adapter", <code>{active.adapter_version}</code>],
          ["Notes", active.limitations.join(" ")],
        ]} />
      </>}
    </section>}

    {compareRefs.length >= 2 && <section className="trl-page__surface">
      <h4>4. Compare EAs</h4>
      <div className="trl-exploration__row"><span>Show</span><select value={compareMetric} onChange={(event) => setCompareMetric(event.currentTarget.value)}>{metricOptions}</select></div>
      {comparison && <>
        {comparison.differences.length > 0 && <p className={comparison.comparable ? "trl-m0__note" : "trl-portfolio__caveat"} role="note"><strong>{comparison.comparable ? "Note:" : "Not like-for-like:"}</strong> these sweeps differ in {comparison.differences.map((item) => `${item.field} (${item.values.join(" / ")})`).join("; ")}.</p>}
        <div className="trl-neighbourhood__grid-wrap"><table className="trl-neighbourhood__grid trl-sweep-compare" aria-label={`${comparison.metric_label} by symbol for each EA`}>
          <thead><tr><th scope="col">Symbol</th>{comparison.sweeps.map((sweep) => <th key={sweep.sweep_ref} scope="col" title={sweep.filename}>{sweep.expert ?? sweep.filename}</th>)}</tr></thead>
          <tbody>{comparison.matrix.map((row, rowIndex) => <tr key={row.symbol}>
            <th scope="row"><label><input type="checkbox" checked={shortlist.includes(row.symbol)} onChange={() => toggleShortlist(row.symbol)} /> {row.symbol}</label></th>
            {row.values.map((value, column) => { const shade = shades[rowIndex]?.[column] ?? null; return <td key={column} className={row.tested[column] ? "is-tested" : "is-untested"} style={shade === null ? undefined : { "--trl-shade": shade.toFixed(3) } as React.CSSProperties} title={row.tested[column] ? `${row.symbol} · ${comparison.sweeps[column]?.expert}: ${value}` : "Not in this sweep"}>{row.tested[column] ? metricText(metricOf(compareMetric), value) : "—"}</td>; })}
          </tr>)}</tbody>
        </table></div>
        <p className="trl-m0__note">Darker = better for this metric ({metricOf(compareMetric)?.default_direction === "MIN" ? "lower is better" : "higher is better"}), shaded across the whole grid. "—" = not in that sweep. Tick a symbol to shortlist it.</p>
      </>}
    </section>}

    {shortlist.length > 0 && <section className="trl-page__surface">
      <h4>5. Record your shortlist</h4>
      <p><strong>Shortlist ({shortlist.length}):</strong> {shortlist.join(", ")} <button type="button" className="trl-link-button" onClick={() => setShortlist([])}>Clear</button></p>
      <RecordTo notes={notes} requirement={REQUIREMENT} createKind="symbol-scan" value={target} onChange={setTarget} />
      <p className="trl-m0__note">The shortlist is written into a marked block of that note; the rest of the note is left untouched.</p>
      <label className="trl-m0__field"><span>Why these symbols? (your words, recorded verbatim)</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. profitable for two of the three EAs with equity drawdown under my limit" /></label>
      <div className="trl-m0__actions"><button type="button" className="mod-cta" disabled={!target || busy !== null} onClick={() => void recordShortlist()}>Record shortlist</button></div>
      {recorded && <p className="trl-exploration__notice" role="status">{recorded}<DismissButton onDismiss={() => setRecorded(null)} /></p>}
      <p className="trl-m0__note"><strong>Next:</strong> re-test each shortlisted symbol in MT5 as a single test with "Every tick based on real ticks" and your broker's commissions, then import the reports on Data & import.</p>
    </section>}
  </section>;
}
