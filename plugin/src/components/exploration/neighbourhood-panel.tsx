import React, { useEffect, useRef, useState } from "react";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import { localPathForSelectedFile } from "../../services/local-file-path";
import type { NeighbourPoint, NeighbourhoodResult, NeighbourhoodRole, NeighbourhoodRunAttachment, NeighbourhoodSet, NeighbourhoodSettings, Objective, ParameterStudy } from "../../types";
import { canBeOrdinal, coverageText, heatmapCells, ordinalNames, statisticsNote, suggestedSetPath } from "./neighbourhood-model";
import { DismissButton } from "../dismiss-button";

type Props = {
  service: ResearchService;
  study: ParameterStudy;
  candidateId: string;
  objectives: Objective[];
  settings: NeighbourhoodSettings;
  onSettingsChange: (settings: NeighbourhoodSettings) => void;
  /** Path of the study's .set as typed at study creation; used to suggest where to save. */
  setPath: string;
  modellingMode: string;
};

const ROLE_LABEL: Record<NeighbourhoodRole, string> = { ORDINAL: "vary ±steps", CATEGORICAL: "must match (mode)", HELD_FIXED: "hold fixed" };
const SOURCE_LABEL: Record<NeighbourPoint["source"], string> = { OPTIMISATION: "optimisation", SINGLE_TEST: "single test", NEIGHBOURHOOD_RUN: "neighbourhood run" };

/**
 * Neighbourhood of the selected parameter set (PARAMETER_NEIGHBOURHOOD_SPEC.md).
 * Coverage comes first; statistics appear only when the Core says there are
 * enough tested neighbours. Nothing here scores or recommends.
 */
export function NeighbourhoodPanel({ service, study, candidateId, objectives, settings, onSettingsChange, setPath, modellingMode }: Props): React.ReactElement {
  const [result, setResult] = useState<NeighbourhoodResult | null>(null);
  const [slice, setSlice] = useState<{ axes: [string, string] | null; metric: string | null }>({ axes: null, metric: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<NeighbourhoodSet | null>(null);
  const [target, setTarget] = useState("");
  const [written, setWritten] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<NeighbourhoodRunAttachment | null>(null);
  const [refresh, setRefresh] = useState(0);
  const runInput = useRef<HTMLInputElement>(null);
  const runs = useRef(new LatestRun()).current;
  const metrics = study.metrics;
  const labelOf = (id: string): string => metrics.find((metric) => metric.id === id)?.label ?? id;

  useEffect(() => {
    const token = runs.begin();
    setError(null);
    setPrepared(null);
    setWritten(null);
    service.neighbourhood(study.study_ref, candidateId, objectives, settings, slice.axes, slice.metric)
      .then((next) => { if (runs.isCurrent(token)) setResult(next); })
      .catch((caught) => { if (runs.isCurrent(token)) { setResult(null); setError(caught instanceof Error ? caught.message : String(caught)); } });
  }, [service, study.study_ref, candidateId, JSON.stringify(objectives), JSON.stringify(settings), JSON.stringify(slice), refresh]);

  const setRole = (name: string, role: NeighbourhoodRole): void => {
    onSettingsChange({ ...settings, roles: { ...settings.roles, [name]: role } });
    setSlice({ axes: null, metric: slice.metric });
  };

  const prepare = async (): Promise<void> => {
    setError(null);
    setWritten(null);
    try {
      const rendered = await service.renderNeighbourhoodSet(study.study_ref, candidateId, settings);
      setPrepared(rendered);
      setTarget(suggestedSetPath(setPath, rendered.suggested_filename));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const save = async (): Promise<void> => {
    setError(null);
    setBusy("Writing the neighbourhood .set…");
    try {
      const saved = await service.writeNeighbourhoodSet(study.study_ref, candidateId, settings, target.trim());
      setWritten(`Saved ${saved.path} (${saved.runs} settings). In MT5, load it on the Inputs tab, choose "Slow complete algorithm", and use the same symbol, timeframe, dates, deposit and modelling mode as the study. Then attach the exported results below.`);
      setPrepared(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } finally { setBusy(null); }
  };

  const attachRun = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError(null);
    setBusy("Importing the neighbourhood run and matching it to its .set…");
    try {
      const path = localPathForSelectedFile(file);
      if (!path.toLowerCase().endsWith(".xml")) throw new Error("Select the MT5 optimisation results (.xml) of the neighbourhood run.");
      const intake = await service.intakeOptimisationGrid(path, study.context.modelling_mode ?? modellingMode.trim());
      const attached = await service.attachNeighbourhoodRun(study.study_ref, intake.optimisation_ref);
      setAttachment(attached);
      if (attached.status === "READY") setRefresh((value) => value + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } finally { setBusy(null); }
  };

  const ordinal = ordinalNames(settings);
  const direction = (id: string): "MAX" | "MIN" | null => objectives.find((objective) => objective.metric === id)?.direction ?? metrics.find((metric) => metric.id === id)?.default_direction ?? null;
  const points = result ? (result.neighbours.length > 0 ? result.neighbours : result.nearest) : [];
  const shownMetrics = objectives.map((objective) => objective.metric);

  return <section className="trl-page__surface trl-neighbourhood" aria-label="Neighbourhood">
    <h4>Neighbourhood of {result?.candidate.label ?? "the selected set"}</h4>
    <p className="trl-m0__note">Do nearby settings behave similarly (a plateau), or is this an isolated peak? Neighbours are other tested settings within the chosen number of .set steps.</p>

    <details className="trl-neighbourhood__roles">
      <summary>How neighbours are defined (±{settings.radius} step{settings.radius === 1 ? "" : "s"})</summary>
      <div className="trl-exploration__row">
        <label>Distance <select value={settings.radius} onChange={(event) => onSettingsChange({ ...settings, radius: Number(event.currentTarget.value) as 1 | 2 })}><option value={1}>±1 step</option><option value={2}>±2 steps</option></select></label>
      </div>
      {study.parameters.map((parameter) => <div key={parameter.name} className="trl-exploration__row">
        <span className="trl-neighbourhood__param">{parameter.name}</span>
        <select value={settings.roles[parameter.name] ?? "CATEGORICAL"} onChange={(event) => setRole(parameter.name, event.currentTarget.value as NeighbourhoodRole)}>
          {canBeOrdinal(parameter) && <option value="ORDINAL">{ROLE_LABEL.ORDINAL}</option>}
          <option value="CATEGORICAL">{ROLE_LABEL.CATEGORICAL}</option>
          <option value="HELD_FIXED">{ROLE_LABEL.HELD_FIXED}</option>
        </select>
      </div>)}
      <p className="trl-m0__note">"Hold fixed" suits inputs that mainly rescale risk, such as a lot size.</p>
    </details>

    {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
    {busy && <p className="trl-dashboard__progress" role="status">{busy}</p>}

    {result && <>
      <p className={`trl-neighbourhood__coverage${result.coverage.sufficient ? "" : " is-low"}`}><strong>{coverageText(result)}</strong> {statisticsNote(result)}</p>
      {result.boundaries.some((item) => item.steps_below === 0 || item.steps_above === 0) && <p className="trl-m0__note">At the edge of the .set range for {result.boundaries.filter((item) => item.steps_below === 0 || item.steps_above === 0).map((item) => item.name).join(", ")}: settings beyond the range were never explored.</p>}

      {result.isolated_peak?.assessed && <p className={`trl-neighbourhood__peak${result.isolated_peak.flag ? " is-flagged" : ""}`} role="note">
        {result.isolated_peak.flag ? "Isolated peak: " : "Not an isolated peak: "}{result.isolated_peak.flag ? "this set beats every tested neighbour by more than their spread on every objective. Treat its results with extra caution." : "at least one objective is within the neighbours' spread."} <span className="trl-m0__note">Rule: {result.isolated_peak.rule}</span>
      </p>}

      {result.statistics && <div className="trl-monthly"><table>
        <thead><tr><th scope="col">Objective</th><th scope="col">This set</th><th scope="col">Neighbour median</th><th scope="col">Middle half (IQR)</th><th scope="col">Best neighbour</th><th scope="col">Better than</th></tr></thead>
        <tbody>{objectives.map((objective) => { const row = result.statistics?.[objective.metric]; return row && <tr key={objective.metric}>
          <th scope="row">{labelOf(objective.metric)} {objective.direction === "MAX" ? "↑" : "↓"}</th>
          <td>{row.candidate_value ?? "—"}</td><td>{row.median ?? "—"}</td><td>{row.q1 !== undefined ? `${row.q1} – ${row.q3}` : "—"}</td><td>{row.best_neighbour ?? "—"}</td>
          <td>{row.candidate_better_than != null ? `${row.candidate_better_than} of ${row.count}` : "—"}</td>
        </tr>; })}</tbody>
      </table></div>}
      {result.context && <p className="trl-m0__note">{result.context.profit_positive_share !== null ? `${Math.round(Number(result.context.profit_positive_share) * 100)}% of tested neighbours were profitable` : ""}{result.context.worst_equity_drawdown_pct !== null ? ` · worst neighbour equity drawdown ${result.context.worst_equity_drawdown_pct}%` : ""}.</p>}

      {points.length > 0 && <>
        <h5>{result.neighbours.length > 0 ? `Tested neighbours (${result.neighbours.length})` : "Nearest tested settings (outside the neighbourhood)"}</h5>
        <div className="trl-monthly"><table>
          <thead><tr><th scope="col">Setting</th><th scope="col">Steps away</th><th scope="col">Differs in</th>{shownMetrics.map((id) => <th key={id} scope="col">{labelOf(id)}</th>)}</tr></thead>
          <tbody>{points.map((point) => <tr key={point.id}>
            <th scope="row" title={SOURCE_LABEL[point.source]}>{point.label}</th><td>{point.distance}</td>
            <td>{Object.entries(point.differs).map(([name, value]) => `${name} ${value}`).join(", ") || "—"}</td>
            {shownMetrics.map((id) => <td key={id}>{point.metrics[id] ?? "—"}</td>)}
          </tr>)}</tbody>
        </table></div>
      </>}

      {result.slice && <SliceHeatmap result={result} ordinal={ordinal} metrics={metrics} direction={direction(result.slice.metric)} onChange={(axes, metric) => setSlice({ axes, metric })} />}
      {!result.slice && <p className="trl-m0__note">The map needs two parameters set to "vary ±steps".</p>}
    </>}

    <div className="trl-neighbourhood__fill">
      <h5>Fill the gaps with a targeted MT5 run</h5>
      <p className="trl-m0__note">TRL writes a new .set covering exactly this neighbourhood (never overwriting a file). Run it in MT5 with the full-grid "Slow complete algorithm", then attach the results.</p>
      <div className="trl-m0__actions">
        <button type="button" disabled={busy !== null} onClick={() => void prepare()}>Prepare neighbourhood .set</button>
        <input ref={runInput} className="trl-m0__file-input" type="file" accept=".xml" onChange={(event) => void attachRun(event)} />
        <button type="button" disabled={busy !== null} onClick={() => runInput.current?.click()}>Attach neighbourhood run (.xml)…</button>
      </div>
      {prepared && <div className="trl-neighbourhood__save">
        <p className="trl-m0__note">{prepared.runs} settings to test: {Object.entries(prepared.varied).map(([name, range]) => `${name} ${range.start}–${range.stop} step ${range.step}`).join("; ")}. Held: {Object.entries(prepared.fixed).map(([name, value]) => `${name} = ${value}`).join(", ") || "none"}.</p>
        <label className="trl-m0__field"><span>Save as (full path; the folder must exist)</span><input value={target} onChange={(event) => setTarget(event.currentTarget.value)} /></label>
        <button type="button" className="mod-cta" disabled={busy !== null || !target.trim().toLowerCase().endsWith(".set")} onClick={() => void save()}>Save .set</button>
      </div>}
      {written && <p className="trl-exploration__notice" role="status">{written}<DismissButton onDismiss={() => setWritten(null)} /></p>}
      {attachment && <ul className="trl-batch__findings"><li>
        <DismissButton onDismiss={() => setAttachment(null)} />
        <strong className={attachment.status === "READY" ? "is-note" : "is-blocked"}>Neighbourhood run: {attachment.status === "READY" ? `${attachment.run_count} settings added as tested neighbours` : "not attached"}</strong>
        {attachment.findings.map((finding) => <span key={finding.code}>{finding.severity === "BLOCKED" ? "Blocked" : finding.severity === "WARNING" ? "Warning" : "Note"}: {finding.message}</span>)}
      </li></ul>}
    </div>
  </section>;
}

function SliceHeatmap({ result, ordinal, metrics, direction, onChange }: {
  result: NeighbourhoodResult;
  ordinal: string[];
  metrics: ParameterStudy["metrics"];
  direction: "MAX" | "MIN" | null;
  onChange: (axes: [string, string], metric: string) => void;
}): React.ReactElement {
  const slice = result.slice!;
  const [x, y] = slice.axes;
  const rows = heatmapCells(slice, direction, x, y);
  const pick = (axis: 0 | 1, value: string): void => {
    const next: [string, string] = axis === 0 ? [value, value === y ? x : y] : [value === x ? y : x, value];
    onChange(next, slice.metric);
  };
  return <figure className="trl-neighbourhood__map">
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field"><span>Across</span><select value={x} onChange={(event) => pick(0, event.currentTarget.value)}>{ordinal.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label className="trl-m0__field"><span>Down</span><select value={y} onChange={(event) => pick(1, event.currentTarget.value)}>{ordinal.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label className="trl-m0__field"><span>Colour</span><select value={slice.metric} onChange={(event) => onChange(slice.axes, event.currentTarget.value)}>{metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select></label>
    </div>
    <div className="trl-neighbourhood__grid-wrap">
      <table className="trl-neighbourhood__grid" aria-label={`${metrics.find((metric) => metric.id === slice.metric)?.label ?? slice.metric} by ${x} and ${y}; other inputs as the selected set`}>
        <thead><tr><th scope="col">{y} \ {x}</th>{slice.x_values.map((value) => <th key={value} scope="col">{value}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={slice.y_values[index]}>
          <th scope="row">{slice.y_values[index]}</th>
          {row.map((cell, column) => <td key={slice.x_values[column]} title={cell.title} className={`${cell.tested ? "is-tested" : "is-untested"}${cell.isCandidate ? " is-candidate" : ""}`} style={cell.shade === null ? undefined : { "--trl-shade": cell.shade.toFixed(3) } as React.CSSProperties}>{cell.tested ? cell.value : ""}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <figcaption className="trl-m0__note">Other inputs as the selected set. Darker = better{direction ? "" : " (higher value; this metric has no better direction)"}. Hatched = not tested (unknown, not zero). Outlined = selected set.{slice.windowed ? " Showing a window around the selected set." : ""}</figcaption>
  </figure>;
}
