import React, { useMemo, useRef, useState } from "react";
import { useThresholds } from "../thresholds-context";
import { plain, plainSentence } from "../plain-language";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import { localPathForSelectedFile } from "../../services/local-file-path";
import type { Constraint, ForwardAttachment, NeighbourhoodSettings, Objective, ParameterEvaluation, ParameterStudy, SingleTestAttachment, StudyFinding } from "../../types";
import { TradeOffScatter } from "../tradeoff/trade-off-scatter";
import { NeighbourhoodPanel } from "./neighbourhood-panel";
import { defaultSettings } from "./neighbourhood-model";
import { axisOptions, betterHint, candidateLabel, compareTable, defaultObjectives, FORWARD_PREFIX, frontierMatchesAxes, keyResultLines, scatterPoints, statusText } from "./exploration-model";
import { isMt5ReportPath, MT5_REPORT_ACCEPT } from "../../application/report-files";
import { DismissButton } from "../dismiss-button";
import { RecordTo } from "../research/record-to";
import type { NotesApi } from "../../vault/notes-api";
import type { RecordRequirement } from "../../vault/research-notes-model";

const REQUIREMENT: RecordRequirement = { kinds: ["parameter-study", "general"] };
import { money, num } from "../display-format";

type Props = {
  service: ResearchService;
  /** TRL research notes; the choice is recorded in the Experiment chosen under Record to. */
  notes: NotesApi;
};

const DEFAULT_MESSAGE: Record<ParameterStudy["default"]["status"], string> = {
  IN_OPTIMISATION: "★ Your default settings are among the tested passes and are marked on the field.",
  SINGLE_TEST: "★ Your default is placed on the field from an attached single-test report.",
  NOT_TESTED: "★ Your default settings were not among the tested passes (common with MT5's genetic optimiser). Attach a single-test report of the default below to place it on the field.",
  NO_SCHEMA: "No .set file: the default reference point and parameter ranges are unavailable.",
};

const MAX_PINNED = 3;
const SEVERITY: Record<StudyFinding["severity"], string> = { BLOCKED: "Blocked", WARNING: "Warning", NOTE: "Note" };
const MAX_OBJECTIVES = 4;

/**
 * Parameter exploration (PX-001–PX-007). Every status and value shown comes
 * from the Core; this view only configures, plots, inspects, and records the
 * owner's own choice.
 */
export function ParameterExplorer({ service, notes }: Props): React.ReactElement {
  const [target, setTarget] = useState<string | null>(null);
  const [xmlPath, setXmlPath] = useState("");
  const [setPath, setSetPath] = useState("");
  const [modellingMode, setModellingMode] = useState("1-minute OHLC");
  const [study, setStudy] = useState<ParameterStudy | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [thresholds] = useThresholds();  // G5: your minimum trades pre-fills a trades constraint
  const [constraints, setConstraints] = useState<Constraint[]>((() => thresholds.minTrades ? [{ metric: "trades", operator: ">=" as const, threshold: String(thresholds.minTrades) }] : []));
  const [evaluation, setEvaluation] = useState<ParameterEvaluation | null>(null);
  const [evaluatedConfig, setEvaluatedConfig] = useState("");
  const [axes, setAxes] = useState<{ x: string; y: string; size: string | null }>({ x: "", y: "", size: null });
  const [selected, setSelected] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const xmlInput = useRef<HTMLInputElement>(null);
  const setInput = useRef<HTMLInputElement>(null);
  const singleInput = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<SingleTestAttachment[]>([]);
  const forwardInput = useRef<HTMLInputElement>(null);
  const [forward, setForward] = useState<ForwardAttachment | null>(null);
  const [neighbourhoodSettings, setNeighbourhoodSettings] = useState<NeighbourhoodSettings>({ roles: {}, radius: 1 });
  const runs = useRef(new LatestRun()).current;

  const configKey = JSON.stringify({ objectives, constraints });
  const stale = evaluation !== null && configKey !== evaluatedConfig;
  const metrics = study?.metrics ?? [];
  const plottable = axisOptions(evaluation, metrics);
  const labelOf = (id: string): string => plottable.find((option) => option.id === id)?.label ?? metrics.find((metric) => metric.id === id)?.label ?? id;

  const pick = (event: React.ChangeEvent<HTMLInputElement>, extension: string, apply: (path: string) => void): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const path = localPathForSelectedFile(file);
      if (!path.toLowerCase().endsWith(extension)) throw new Error(`Select an MT5 ${extension} file.`);
      apply(path);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const runEvaluation = async (target: ParameterStudy, nextObjectives: Objective[], nextConstraints: Constraint[]): Promise<void> => {
    const token = runs.begin();
    setBusy("Evaluating constraints and the Pareto frontier…");
    setError(null);
    try {
      const result = await service.evaluateParameterStudy(target.study_ref, nextObjectives, nextConstraints);
      if (!runs.isCurrent(token)) return;
      setEvaluation(result);
      setEvaluatedConfig(JSON.stringify({ objectives: nextObjectives, constraints: nextConstraints }));
    } catch (caught) {
      if (runs.isCurrent(token)) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (runs.isCurrent(token)) setBusy(null);
    }
  };

  const createStudy = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    setBusy("Importing the optimisation and building the study…");
    try {
      const optimisation = await service.intakeOptimisationGrid(xmlPath.trim(), modellingMode.trim());
      const schema = setPath.trim() ? await service.intakeParameterSchema(setPath.trim()) : null;
      const created = await service.createParameterStudy(optimisation.optimisation_ref, schema?.schema_ref ?? null);
      const initial = defaultObjectives(created.metrics);
      setStudy(created);
      setAttachments([]);
      setForward(null);
      setNeighbourhoodSettings(defaultSettings(created.parameters));
      setObjectives(initial);
      setConstraints([]);
      setEvaluation(null);
      setSelected(null);
      setPinned([]);
      const drawdown = initial.find((objective) => objective.direction === "MIN")?.metric ?? initial[1]?.metric ?? "";
      const reward = initial.find((objective) => objective.metric !== drawdown)?.metric ?? initial[0]?.metric ?? "";
      setAxes({ x: drawdown, y: reward, size: created.metrics.some((metric) => metric.id === "trades") ? "trades" : null });
      setBusy(null);
      if (created.status === "READY" && initial.length > 0) await runEvaluation(created, initial, []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(null);
    }
  };

  const attachSingleTest = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !study) return;
    setError(null);
    setBusy("Importing the single-test report and checking it against the study…");
    try {
      const path = localPathForSelectedFile(file);
      if (!isMt5ReportPath(path)) throw new Error("Select an MT5 Strategy Tester report (.xlsx or .html).");
      const intake = await service.intakeMt5Report(path);
      const attached = await service.addSingleTest(study.study_ref, intake.dataset_ref);
      setAttachments((current) => [...current.filter((item) => item.candidate_id !== attached.candidate_id), attached]);
      setBusy(null);
      if (attached.status === "READY" && objectives.length > 0) await runEvaluation(study, objectives, constraints);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(null);
    }
  };

  const attachForward = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !study) return;
    setError(null);
    setBusy("Importing the forward results and pairing them with the study's passes…");
    try {
      const path = localPathForSelectedFile(file);
      if (!path.toLowerCase().endsWith(".xml")) throw new Error("Select the MT5 forward optimisation results (.xml).");
      const intake = await service.intakeOptimisationGrid(path, study.context.modelling_mode ?? modellingMode.trim());
      const attached = await service.attachForward(study.study_ref, intake.optimisation_ref);
      setForward(attached);
      setBusy(null);
      if (attached.status === "READY" && objectives.length > 0) await runEvaluation(study, objectives, constraints);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(null);
    }
  };

  const recordChoice = async (): Promise<void> => {
    if (!study || !selected || !evaluation || stale) return;
    setBusy("Recording your choice in the experiment note…");
    setError(null);
    try {
      const rendered = await service.renderParameterChoice(study.study_ref, objectives, constraints, selected, reason, study.schema_ref ? neighbourhoodSettings : undefined);
      if (!target) throw new Error("Choose or create an experiment under Record to.");
      await notes.record(target, rendered.markdown, rendered.evaluation_id);
      setNotice(`Choice recorded in ${target}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const points = useMemo(() => evaluation && axes.x && axes.y ? scatterPoints(evaluation, axes.x, axes.y, axes.size) : [], [evaluation, axes]);
  const comparison = useMemo(() => evaluation ? compareTable(evaluation, pinned) : null, [evaluation, pinned]);
  const selectedCandidate = evaluation?.candidates.find((candidate) => candidate.id === selected) ?? null;
  const defaultStatus = evaluation?.study.default.status ?? study?.default.status ?? "NO_SCHEMA";
  const metricOptions = metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>);
  const plotOptions = plottable.map((option) => <option key={option.id} value={option.id}>{option.label}</option>);
  const forwardAxis = [axes.x, axes.y, axes.size ?? ""].some((id) => id.startsWith(FORWARD_PREFIX));
  // The hover card shows forward profit and drawdown plus the plotted metrics, not the whole catalogue.
  const forwardCardIds = new Set(["net_profit", "equity_drawdown_pct", ...[axes.x, axes.y].map((id) => id.replace(FORWARD_PREFIX, ""))]);
  const forwardCardMetrics = evaluation?.forward?.metrics.filter((metric) => forwardCardIds.has(metric.id)) ?? [];
  const overlap = evaluation?.forward?.findings.some((finding) => finding.code === "PERIODS_OVERLAP") ?? false;

  return <section className="trl-page" aria-label="Parameter exploration">
    <header className="trl-page__header"><div><h3>Parameter exploration</h3><p>See where your EA settings sit among all tested parameter sets, and choose the trade-off you prefer. TRL marks trade-offs; it never picks a winner.</p></div></header>

    <section className="trl-page__surface">
      <h4>1. Study</h4>
      <input ref={xmlInput} className="trl-m0__file-input" type="file" accept=".xml" onChange={(event) => pick(event, ".xml", setXmlPath)} />
      <input ref={setInput} className="trl-m0__file-input" type="file" accept=".set" onChange={(event) => pick(event, ".set", setSetPath)} />
      <div className="trl-m0__scenario-fields">
        <label className="trl-m0__field"><span>MT5 optimisation results (.xml)</span><input value={xmlPath} onChange={(event) => setXmlPath(event.currentTarget.value)} placeholder="C:\\path\\to\\optimisation.xml" /></label>
        <label className="trl-m0__field"><span>EA settings file (.set), optional: supplies ranges and the default</span><input value={setPath} onChange={(event) => setSetPath(event.currentTarget.value)} placeholder="C:\\path\\to\\ea.set" /></label>
        <label className="trl-m0__field"><span>Modelling mode (you declare it; the XML does not say)</span><input value={modellingMode} onChange={(event) => setModellingMode(event.currentTarget.value)} /></label>
      </div>
      <div className="trl-m0__actions">
        <button type="button" disabled={busy !== null} onClick={() => xmlInput.current?.click()}>Browse XML…</button>
        <button type="button" disabled={busy !== null} onClick={() => setInput.current?.click()}>Browse .set…</button>
        <button type="button" className="mod-cta" disabled={busy !== null || !xmlPath.trim().toLowerCase().endsWith(".xml") || !modellingMode.trim()} onClick={() => void createStudy()}>Create study</button>
      </div>
      {busy && <p className="trl-dashboard__progress" role="status">{busy}</p>}
      {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
      {notice && <p className="trl-exploration__notice" role="status">{notice}<DismissButton onDismiss={() => setNotice(null)} /></p>}
    </section>

    {study && <section className="trl-page__surface">
      <h4>Study summary{study.context.title ? `: ${study.context.title}` : ""}</h4>
      <p className="trl-m0__note">{study.pass_count} tested parameter sets{study.full_grid_size ? ` out of ${study.full_grid_size} possible in the .set ranges` : ""}{study.context.deposit ? ` · deposit ${money(study.context.deposit)}` : ""} · modelling {study.context.modelling_mode ?? "not declared"}.</p>
      <p className={`trl-exploration__default is-${defaultStatus.toLowerCase()}`}>{DEFAULT_MESSAGE[defaultStatus]}</p>
      <div className="trl-monthly"><table>
        <thead><tr><th scope="col">Parameter</th><th scope="col">Kind</th><th scope="col">Default</th><th scope="col">Range (start–stop, step)</th><th scope="col">Values tested</th></tr></thead>
        <tbody>{study.parameters.map((parameter) => <tr key={parameter.name}>
          <th scope="row">{parameter.name}</th>
          <td>{parameter.kind === "NUMERIC" ? (parameter.ordinal ? "numeric, ordered" : parameter.ordinal === false ? "numeric, categorical" : "numeric") : parameter.kind.toLowerCase()}</td>
          <td>{parameter.default ?? "—"}</td>
          <td>{parameter.start != null ? `${parameter.start}–${parameter.stop}, step ${parameter.step}` : "—"}</td>
          <td title={parameter.tested_values.join(", ")}>{parameter.tested_values.length}{parameter.value_count ? ` of ${parameter.value_count}` : ""}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="trl-exploration__single">
        <input ref={singleInput} className="trl-m0__file-input" type="file" accept={MT5_REPORT_ACCEPT} onChange={(event) => void attachSingleTest(event)} />
        <button type="button" disabled={busy !== null || study.status !== "READY"} onClick={() => singleInput.current?.click()}>Attach a single-test report…</button>
        <span className="trl-m0__note">Run your default (or any setting) as a single MT5 test with the same symbol, period and dates, then attach its report (.xlsx or .html) to place it on the field. All of its inputs are checked against the .set file.</span>
      </div>
      {attachments.length > 0 && <ul className="trl-batch__findings">{attachments.map((item) => <li key={item.candidate_id}>
        <DismissButton onDismiss={() => setAttachments((current) => current.filter((other) => other.candidate_id !== item.candidate_id))} />
        <strong className={item.status === "READY" ? "is-note" : "is-blocked"}>{item.label}: {item.status === "READY" ? (item.is_default ? "placed on the field as ★ your default" : "placed on the field") : "not placed"}</strong>
        {item.findings.map((finding) => <span key={finding.code}>{finding.severity === "BLOCKED" ? "Blocked" : finding.severity === "WARNING" ? "Warning" : "Note"}: {finding.message}</span>)}
      </li>)}</ul>}
      <div className="trl-exploration__single">
        <input ref={forwardInput} className="trl-m0__file-input" type="file" accept=".xml" onChange={(event) => void attachForward(event)} />
        <button type="button" disabled={busy !== null || study.status !== "READY"} onClick={() => forwardInput.current?.click()}>Attach forward results (.xml)…</button>
        <span className="trl-m0__note">The MT5 forward-test export for a later period. Passes are paired by identical inputs, so you can see how each setting did on data it was not optimised on.</span>
      </div>
      {forward && <ul className="trl-batch__findings"><li>
        {forward.status !== "READY" && <DismissButton onDismiss={() => setForward(null)} />}
        <strong className={forward.status === "READY" ? "is-note" : "is-blocked"}>Forward results{forward.period?.source === "MT5_TITLE" ? ` ${forward.period.forward[0]}–${forward.period.forward[1]}` : forward.period?.source === "MT5_BUILT_IN_FORWARD" ? ` (MT5 built-in forward, ${forward.period.whole_range[0]}–${forward.period.whole_range[1]})` : ""}: {forward.status === "READY" ? `${forward.matched_count} of the tested sets paired` : "not attached"}</strong>
        {forward.status === "READY" && <span>{forward.in_sample_only_count} in-sample sets have no forward run; {forward.forward_only_count} forward sets were not in the in-sample results.</span>}
        {forward.findings.map((finding) => <span key={finding.code}>{SEVERITY[finding.severity]}: {finding.message}</span>)}
      </li></ul>}
      {study.findings.length > 0 && <ul className="trl-batch__findings">{study.findings.map((finding) => <li key={finding.code}><strong className={`is-${finding.severity.toLowerCase()}`}>{finding.severity === "NOTE" ? "Note" : finding.severity === "WARNING" ? "Warning" : "Blocked"}</strong><span>{finding.message}</span></li>)}</ul>}
    </section>}

    {study?.status === "READY" && <section className="trl-page__surface">
      <h4>2. Objectives and constraints</h4>
      <p className="trl-m0__note">Objectives are what you want to improve. Constraints remove sets you would never accept; they are kept on the field as hollow points, not deleted.</p>
      <div className="trl-exploration__editor">
        <div>
          <strong>Objectives</strong>
          {objectives.map((objective, index) => <div key={index} className="trl-exploration__row">
            <select value={objective.metric} onChange={(event) => setObjectives(objectives.map((item, position) => position === index ? { ...item, metric: event.currentTarget.value } : item))}>{metricOptions}</select>
            <select value={objective.direction} onChange={(event) => setObjectives(objectives.map((item, position) => position === index ? { ...item, direction: event.currentTarget.value as "MAX" | "MIN" } : item))}><option value="MAX">higher is better</option><option value="MIN">lower is better</option></select>
            <button type="button" disabled={objectives.length <= 1} onClick={() => setObjectives(objectives.filter((_, position) => position !== index))}>Remove</button>
          </div>)}
          <button type="button" disabled={objectives.length >= MAX_OBJECTIVES || metrics.length === 0} onClick={() => { const unused = metrics.find((metric) => !objectives.some((objective) => objective.metric === metric.id)); if (unused) setObjectives([...objectives, { metric: unused.id, direction: unused.default_direction ?? "MAX" }]); }}>Add objective</button>
        </div>
        <div>
          <strong>Constraints</strong>
          {constraints.map((constraint, index) => <div key={index} className="trl-exploration__row">
            <select value={constraint.metric} onChange={(event) => setConstraints(constraints.map((item, position) => position === index ? { ...item, metric: event.currentTarget.value } : item))}>{metricOptions}</select>
            <select value={constraint.operator} onChange={(event) => setConstraints(constraints.map((item, position) => position === index ? { ...item, operator: event.currentTarget.value as ">=" | "<=" } : item))}><option value=">=">at least</option><option value="<=">at most</option></select>
            <input inputMode="decimal" value={constraint.threshold} placeholder="value" onChange={(event) => setConstraints(constraints.map((item, position) => position === index ? { ...item, threshold: event.currentTarget.value } : item))} />
            <button type="button" onClick={() => setConstraints(constraints.filter((_, position) => position !== index))}>Remove</button>
          </div>)}
          <button type="button" onClick={() => setConstraints([...constraints, { metric: metrics.find((metric) => metric.id === "trades")?.id ?? metrics[0]?.id ?? "", operator: ">=", threshold: "" }])}>Add constraint</button>
        </div>
      </div>
      <div className="trl-m0__actions">
        <button type="button" className="mod-cta" disabled={busy !== null || objectives.length === 0 || constraints.some((constraint) => !/^-?\d+(\.\d+)?$/.test(constraint.threshold.trim()))} onClick={() => void runEvaluation(study, objectives, constraints.map((constraint) => ({ ...constraint, threshold: constraint.threshold.trim() })))}>{stale ? "Re-evaluate (settings changed)" : "Evaluate"}</button>
        {evaluation && <span className="trl-m0__note">{evaluation.counts.PARETO} on the frontier · {evaluation.counts.DOMINATED} dominated · {evaluation.counts.CONSTRAINED} fail a constraint{evaluation.counts.INCOMPLETE ? ` · ${evaluation.counts.INCOMPLETE} missing a value` : ""}</span>}
      </div>
    </section>}

    {evaluation && study && <section className="trl-page__surface">
      <h4>3. Trade-off field</h4>
      {stale && <p className="trl-m0__inline-error" role="note">The field shows the previous evaluation; your objectives or constraints have changed since. Re-evaluate to update it.</p>}
      <div className="trl-m0__scenario-fields">
        <label className="trl-m0__field"><span>Horizontal axis</span><select value={axes.x} onChange={(event) => setAxes({ ...axes, x: event.currentTarget.value })}>{plotOptions}</select></label>
        <label className="trl-m0__field"><span>Vertical axis</span><select value={axes.y} onChange={(event) => setAxes({ ...axes, y: event.currentTarget.value })}>{plotOptions}</select></label>
        <label className="trl-m0__field"><span>Point size</span><select value={axes.size ?? ""} onChange={(event) => setAxes({ ...axes, size: event.currentTarget.value || null })}><option value="">uniform</option>{plotOptions}</select></label>
      </div>
      {forwardAxis && <p className="trl-m0__note">Colours and the frontier are from the in-sample evaluation; forward values exist only for paired passes, so unpaired ones are not plotted.{overlap ? " The forward period overlaps the in-sample period, so these are not out-of-sample results." : ""}</p>}
      <TradeOffScatter
        points={points}
        xLabel={labelOf(axes.x)}
        yLabel={labelOf(axes.y)}
        xBetter={betterHint(axes.x, objectives, metrics)}
        yBetter={betterHint(axes.y, objectives, metrics)}
        frontierLine={frontierMatchesAxes(JSON.parse(evaluatedConfig).objectives as Objective[], axes.x, axes.y)}
        sizeLabel={axes.size ? labelOf(axes.size) : undefined}
        selectedId={selected}
        onSelect={(point) => setSelected(point.id)}
        details={(point) => {
          const candidate = evaluation.candidates.find((item) => item.id === point.id);
          if (!candidate) return null;
          return <>{keyResultLines(candidate, metrics, [axes.x, axes.y, axes.size]).map((line) => <span key={line.id} className="trl-tradeoff__key-result">{line.label}: <strong>{line.value}</strong></span>)}{Object.entries(candidate.parameters).map(([name, value]) => <span key={name}>{name} = {value}</span>)}{evaluation.forward && <span>{candidate.forward ? `Forward: ${forwardCardMetrics.map((metric) => `${metric.label} ${num(candidate.forward!.metrics[metric.id])}`).join(" · ")}` : "No forward match"}</span>}{candidate.pareto.violations.map((violation) => <span key={violation.metric}>✗ {labelOf(violation.metric)} {violation.operator} {violation.threshold} (is {violation.value === null || violation.value === undefined ? "missing" : num(violation.value)})</span>)}</>;
        }}
      />
      {!frontierMatchesAxes(JSON.parse(evaluatedConfig).objectives as Objective[], axes.x, axes.y) && <p className="trl-m0__note">The frontier line is shown only when the two axes are exactly the two objectives; frontier points are still highlighted.</p>}
      {selectedCandidate && <div className="trl-exploration__selected">
        <strong>Selected: {candidateLabel(selectedCandidate)}{selectedCandidate.is_default ? " (your default)" : ""}</strong> · {statusText(selectedCandidate)}
        <button type="button" disabled={pinned.includes(selectedCandidate.id) || pinned.length >= MAX_PINNED || selectedCandidate.is_default} onClick={() => setPinned([...pinned, selectedCandidate.id])}>Pin for comparison</button>
      </div>}
    </section>}

    {evaluation && comparison && comparison.columns.length > 0 && <section className="trl-page__surface">
      <h4>4. Compare with your default</h4>
      <div className="trl-monthly"><table className="trl-exploration__compare">
        <thead><tr><th scope="col" />{comparison.columns.map((column) => <th key={column.key} scope="col">{column.title}{column.key !== "default" && <button type="button" className="trl-link-button" onClick={() => setPinned(pinned.filter((id) => id !== column.key))}> ✕</button>}</th>)}</tr></thead>
        <tbody>{comparison.rows.map((row) => <tr key={row.label} className={`is-${row.kind}`}><th scope="row">{row.label}</th>{row.cells.map((cell, index) => <td key={index} className={cell.differs ? "is-different" : undefined}>{cell.value}</td>)}</tr>)}</tbody>
      </table></div>
      <p className="trl-m0__note">Highlighted parameter values differ from your default. Metrics are MT5-reported for each pass{evaluation.forward ? (overlap ? "; forward rows come from an export whose period overlaps the in-sample period" : "; forward rows are the same settings on the later forward period") : ""}. Pin up to {MAX_PINNED} passes from the field.</p>
    </section>}

    {evaluation && selectedCandidate && study?.schema_ref && <NeighbourhoodPanel service={service} study={study} candidateId={selectedCandidate.id} objectives={(JSON.parse(evaluatedConfig) as { objectives: Objective[] }).objectives} settings={neighbourhoodSettings} onSettingsChange={setNeighbourhoodSettings} setPath={setPath} modellingMode={modellingMode} />}
    {evaluation && selectedCandidate && study && !study.schema_ref && <p className="trl-m0__note">Neighbourhood analysis needs the study's .set file (its ranges and steps define which settings are neighbours).</p>}

    {evaluation && selectedCandidate && <section className="trl-page__surface">
      <h4>5. Record your choice</h4>
      <RecordTo notes={notes} requirement={REQUIREMENT} createKind="parameter-study" value={target} onChange={setTarget} />
      <p className="trl-m0__note">The choice is written into a marked block of that note; the rest of the note is left untouched.</p>
      <label className="trl-m0__field"><span>Why this trade-off? (your words, recorded verbatim)</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="e.g. accept ~20% less profit for half the equity drawdown" /></label>
      <button type="button" className="mod-cta" disabled={!target || busy !== null || stale} onClick={() => void recordChoice()}>Record {candidateLabel(selectedCandidate)} as my choice</button>
    </section>}

    {evaluation && <ul className="trl-batch__warnings">{evaluation.warnings.map((warning) => <li key={warning}>{plainSentence(warning)}</li>)}</ul>}
  </section>;
}
