import React, { useState } from "react";
import * as fs from "fs";
import * as nodePath from "path";
import loggerInclude from "../../../../mql5/Include/TRL_EquityLogger.mqh";
import loggerExample from "../../../../mql5/Experts/TRL_EquityLogger_Example.mq5";
import { DismissButton } from "../dismiss-button";
import { WidgetSurface } from "../layout/widget-surface";
import { HELP_WIDGETS } from "../../layout/widgets";
import { LOGGER_FILES, looksLikeMql5Folder, relativeParts, type SaveTarget } from "./help-model";
import { CHECKLIST_INTRO, CHECKLIST_STEPS, COVERAGE_TEXT } from "./optimisation-checklist";
import { LABEL_TEXT, SOURCES, WORKFLOW_GAPS, WORKFLOW_INTRO, WORKFLOW_STEPS, type WorkflowPoint } from "./research-workflow";

const CONTENT: Record<string, string> = { "TRL_EquityLogger.mqh": loggerInclude, "TRL_EquityLogger_Example.mq5": loggerExample };
const LOGGER_VERSION = /TRL_EQUITY_LOGGER_VER\s+"([^"]+)"/.exec(loggerInclude)?.[1] ?? "unknown";

type SaveOutcome = { file: string; path: string; result: "saved" | "exists" | "error"; message?: string };

/** Help & downloads: how to record equity in MT5 backtests, with the MQL5 files. */
export function HelpPage(): React.ReactElement {
  const [target, setTarget] = useState<SaveTarget>("mt5");
  const [folder, setFolder] = useState("");
  const [outcomes, setOutcomes] = useState<SaveOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (): void => {
    setError(null);
    setOutcomes(null);
    const base = folder.trim().replace(/^"|"$/g, "");
    try {
      if (!base || !fs.existsSync(base) || !fs.statSync(base).isDirectory()) throw new Error("That folder does not exist. Paste the full path of an existing folder.");
      if (target === "mt5" && !looksLikeMql5Folder(fs.readdirSync(base))) throw new Error("This is not an MQL5 folder (it has no Include and Experts folders). In MetaTrader use File → Open Data Folder, then open MQL5 and copy that path.");
      setOutcomes(LOGGER_FILES.map((file) => {
        const destination = nodePath.join(base, ...relativeParts(file, target));
        try {
          fs.mkdirSync(nodePath.dirname(destination), { recursive: true });
          fs.writeFileSync(destination, CONTENT[file.name]!, { encoding: "utf8", flag: "wx" });  // never overwrite
          return { file: file.name, path: destination, result: "saved" };
        } catch (caught) {
          const code = (caught as { code?: string }).code;
          return code === "EEXIST" ? { file: file.name, path: destination, result: "exists" } : { file: file.name, path: destination, result: "error", message: caught instanceof Error ? caught.message : String(caught) };
        }
      }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  return <section className="trl-page" aria-label="Help and downloads">
    <header className="trl-page__header"><div><h3>Help & downloads</h3><p>A research workflow from symbol scan to go-live, an optimisation checklist, how to record equity in MT5 backtests, and which MT5 files TRL reads.</p></div></header>

    <WidgetSurface surface="help" label="Help" variant="stack" definitions={HELP_WIDGETS} widgets={{
    "help.workflow": <ResearchWorkflow />,
    "help.optimisation": <OptimisationChecklist />,
    "help.equity-logger": <HelpSection id="equity-logger" title="Equity logger (floating drawdown)" summary="Record open-position drawdown in MT5 backtests; save the MQL5 files">
      <p>MT5 reports list closed trades only. The TRL equity logger records how deep open positions went during a Strategy Tester run, so TRL can show real equity drawdown and daily equity loss. You need the EA's source code (.mq5).</p>

      <h5>1. Get the files</h5>
      <ul className="trl-help__files">{LOGGER_FILES.map((file) => <li key={file.name}><code>{file.name}</code>: {file.description}</li>)}</ul>
      <div className="trl-m0__scenario-fields">
        <label className="trl-m0__field"><span>Save to</span><select value={target} onChange={(event) => setTarget(event.currentTarget.value as SaveTarget)}>
          <option value="mt5">My MT5 MQL5 folder (puts each file where MT5 needs it)</option>
          <option value="folder">Any folder (both files side by side)</option>
        </select></label>
        <label className="trl-m0__field"><span>{target === "mt5" ? "MQL5 folder (MetaTrader: File → Open Data Folder → MQL5)" : "Folder"}</span><input value={folder} onChange={(event) => setFolder(event.currentTarget.value)} placeholder={target === "mt5" ? "e.g. D:\\MT5\\MQL5" : "e.g. D:\\Downloads"} /></label>
      </div>
      <div className="trl-m0__actions"><button type="button" className="mod-cta" disabled={!folder.trim()} onClick={save}>Save files</button><span className="trl-m0__note">Logger version {LOGGER_VERSION}. Existing files are never overwritten.</span></div>
      {error && <p className="trl-m0__inline-error" role="alert">{error}<DismissButton onDismiss={() => setError(null)} /></p>}
      {outcomes && <ul className="trl-batch__findings"><li>
        <DismissButton onDismiss={() => setOutcomes(null)} />
        {outcomes.map((item) => <span key={item.file}>{item.result === "saved" ? "✓ Saved" : item.result === "exists" ? "Already there (left unchanged)" : "Not saved"}: <code>{item.path}</code>{item.message ? ` (${item.message})` : ""}</span>)}
      </li></ul>}
      <p className="trl-m0__note">There is no ready-made .ex5: the logger is an include that becomes part of your EA, and MetaQuotes recommends compiling each EA in the terminal that runs it. Compiling takes one click (F7 in MetaEditor).</p>

      <h5>2. Add it to your EA</h5>
      <p>Work on a copy of your EA. Add four lines (the example EA shows them, marked "TRL"):</p>
      <pre className="trl-help__code">{`#include <TRL_EquityLogger.mqh>    // near the top

// in OnInit, just before return(INIT_SUCCEEDED):
TrlEquityInit();

// FIRST line of OnTick, before any "return" filter:
TrlEquityOnTick();

// in OnDeinit (add it if the EA has none):
TrlEquityFinish();`}</pre>
      <ul>
        <li><strong>The most common mistake:</strong> if OnTick starts with a new-bar filter such as <code>if(!IsNewBar()) return;</code>, put <code>TrlEquityOnTick();</code> above it; otherwise dips between bars are missed.</li>
        <li><strong>Timer-driven or multi-symbol EAs:</strong> also call <code>TrlEquityOnTick();</code> at the start of <code>OnTimer</code> (add <code>EventSetTimer(1);</code> in OnInit if there is no timer).</li>
        <li>Optimisations: the logger stays silent. Run the pass you care about as a single test.</li>
        <li>For a row every minute use <code>TrlEquityInit(PERIOD_M1);</code>. Every row already holds the lowest and highest equity of all ticks in it.</li>
      </ul>

      <h5>3. Run and import</h5>
      <ol>
        <li>Compile (F7), then run a single Strategy Tester test, preferably with "Every tick based on real ticks". Save the report as .html or .xlsx.</li>
        <li>The log is in <code>%APPDATA%\MetaQuotes\Terminal\Common\Files\TRL\</code>. If you ran the test more than once, take the newest file (<code>_2</code>, <code>_3</code>…).</li>
        <li>In TRL, go to <strong>Data & import</strong> → Browse and validate report → Companion files → Browse and validate equity log. The report and log must come from the same run; TRL checks the balance after every deal.</li>
      </ol>
    </HelpSection>,
    "help.mt5-exports": <HelpSection id="mt5-exports" title="What to export from MT5" summary="Which MT5 file each TRL feature reads">
      <div className="trl-monthly"><table>
        <thead><tr><th scope="col">To do this in TRL</th><th scope="col">Export from MT5</th><th scope="col">File</th></tr></thead>
        <tbody>
          <tr><th scope="row">Analyse a backtest; combine EAs in Portfolio</th><td>Backtest report (right-click → save report)</td><td>.xlsx or .html</td></tr>
          <tr><th scope="row">Record floating drawdown</th><td>TRL equity logger, run in the same single test</td><td>.csv</td></tr>
          <tr><th scope="row">Check the intended inputs were used</th><td>EA inputs (Inputs tab → Save)</td><td>.set</td></tr>
          <tr><th scope="row">Parameter exploration</th><td>Optimization results → Export to XML</td><td>.xml</td></tr>
          <tr><th scope="row">Out-of-sample check</th><td>Optimisation with a Forward period; export both tabs</td><td>.xml + .forward .xml</td></tr>
        </tbody>
      </table></div>
      <p className="trl-m0__note">The full guides ship with TRL in its <code>docs</code> folder: <code>EQUITY_LOGGER.md</code> and <code>MT5_EXPORT_GUIDE.md</code>.</p>
    </HelpSection>,
    }} />
  </section>;
}

const OPEN_KEY = "trl-help-open-sections";

/** Which Help sections the viewer left open (a per-device convenience; all open when unknown). */
function readOpen(): Record<string, boolean> {
  try { return JSON.parse(window.localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>; } catch { return {}; }
}

/** A Help section that folds to its title; the open/closed state is remembered on this device. */
function HelpSection({ id, title, summary, children }: { id: string; title: string; summary: string; children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(() => readOpen()[id] ?? true);
  const toggle = (event: React.SyntheticEvent<HTMLDetailsElement>): void => {
    const next = event.currentTarget.open;
    setOpen(next);
    try { window.localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpen(), [id]: next })); } catch { /* storage unavailable: state is not remembered */ }
  };
  return <details className="trl-page__surface trl-help trl-help__section" open={open} onToggle={toggle} aria-label={title}>
    <summary><h4>{title}</h4>{!open && <span className="trl-m0__note">{summary}</span>}</summary>
    {children}
  </details>;
}

function Check({ point }: { point: WorkflowPoint }): React.ReactElement {
  const source = point.source ? SOURCES[point.source] : null;
  return <li className={`trl-workflow__check is-${point.label.toLowerCase()}`}>
    <span className="trl-workflow__label" title={LABEL_TEXT[point.label]}>{LABEL_TEXT[point.label]}</span> {point.text}
    {source && <span className="trl-workflow__source"> Source: {source.url ? <a href={source.url}>{source.title}</a> : source.title}.</span>}
  </li>;
}

/** The optimisation checklist (owner-approved 2026-09-24); content lives in optimisation-checklist.ts. */
function OptimisationChecklist(): React.ReactElement {
  return <HelpSection id="optimisation-checklist" title="Optimisation checklist: seven steps, mapped to TRL" summary="Your MT5 optimisation tutorial, step by step, with the TRL tool for each">
    {CHECKLIST_INTRO.map((line) => <p key={line}>{line}</p>)}
    {CHECKLIST_STEPS.map((step) => <details key={step.number} className="trl-workflow__step">
      <summary><strong>{step.number}. {step.title}</strong> · {step.question} <span className={`trl-checklist__coverage is-${step.coverage.toLowerCase()}`}>{COVERAGE_TEXT[step.coverage]}</span></summary>
      <dl className="trl-prop__summary">
        <dt>In TRL</dt><dd>{step.tool}</dd>
        <dt>Research workflow</dt><dd>Step {step.workflowSteps.join(", ")}</dd>
      </dl>
      <ul className="trl-workflow__checks">{step.points.map((point) => <Check key={point.text} point={point} />)}</ul>
    </details>)}
    <p className="trl-m0__note">The same checklist ships as <code>OPTIMISATION_CHECKLIST.md</code> in TRL's <code>docs</code> folder.</p>
  </HelpSection>;
}

/** The research workflow guide (owner-approved 2026-09-24); content lives in research-workflow.ts. */
function ResearchWorkflow(): React.ReactElement {
  return <HelpSection id="research-workflow" title="Research workflow: from symbol scan to go-live" summary="The steps from a broad symbol scan to a go-live decision, with sources">
    {WORKFLOW_INTRO.map((line) => <p key={line}>{line}</p>)}
    <p className="trl-m0__note">Labels: {(Object.keys(LABEL_TEXT) as Array<keyof typeof LABEL_TEXT>).map((key) => <span key={key} className={`trl-workflow__label is-${key.toLowerCase()}`}>{LABEL_TEXT[key]}</span>)}</p>
    {WORKFLOW_STEPS.map((step) => <details key={step.number} className="trl-workflow__step">
      <summary><strong>{step.number}. {step.title}</strong> · {step.purpose}</summary>
      <dl className="trl-prop__summary">
        <dt>Where</dt><dd>{step.where}</dd>
        <dt>Inputs</dt><dd>{step.inputs}</dd>
      </dl>
      <ul className="trl-workflow__checks">{step.checks.map((point) => <Check key={point.text} point={point} />)}</ul>
    </details>)}
    <details className="trl-workflow__step">
      <summary><strong>Not in TRL yet</strong> · steps that stay in MT5 or need a future feature</summary>
      <ul>{WORKFLOW_GAPS.map((gap) => <li key={gap}>{gap}</li>)}</ul>
    </details>
    <p className="trl-m0__note">The same guide ships as <code>RESEARCH_WORKFLOW.md</code> in TRL's <code>docs</code> folder.</p>
  </HelpSection>;
}
