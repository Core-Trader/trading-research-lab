import React, { useState } from "react";
import * as fs from "fs";
import * as nodePath from "path";
import loggerInclude from "../../../../mql5/Include/TRL_EquityLogger.mqh";
import loggerExample from "../../../../mql5/Experts/TRL_EquityLogger_Example.mq5";
import { DismissButton } from "../dismiss-button";
import { LOGGER_FILES, looksLikeMql5Folder, relativeParts, type SaveTarget } from "./help-model";

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
    <header className="trl-page__header"><div><h3>Help & downloads</h3><p>How to record equity in MT5 backtests, and which MT5 files TRL reads.</p></div></header>

    <section className="trl-page__surface trl-help">
      <h4>Equity logger (floating drawdown)</h4>
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
    </section>

    <section className="trl-page__surface trl-help">
      <h4>What to export from MT5</h4>
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
    </section>
  </section>;
}
