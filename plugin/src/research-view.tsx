import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ItemView, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import type TradingResearchLabPlugin from "./main";
import type { EquityMetrics, SetCheckResult, CloseEventDisplaySeries, PerformanceMetrics, RMultipleMetrics, CombinedBalanceResult, CombinedDailyResult, DailyDrawdownResult, DatasetEvidence, EquityAvailabilityResult, FixedCostScenarioResult, MonteCarloResult, PortfolioPreflightResult, StatisticsResult, TradeAnalysisResult } from "./types";
import { experimentDocumentText, inspectReportForRegeneration, regenerateReportText, reportDocumentText, strategyDocumentText, uuidv7 } from "./research-documents";
import { ResearchService } from "./application/research-service";
import { LatestRun } from "./application/latest-run";
import { localPathForSelectedFile } from "./services/local-file-path";
import { createVaultDocument, readCurrentDocument, requestDocumentName } from "./vault/research-vault";
import { DashboardSummary } from "./components/dashboard-summary";
import { ALL_PAGES, pageInfo, type WorkspacePage } from "./application/navigation";
import { HelpPage } from "./components/help/help-page";
import { Evidence, type SnapshotVerification } from "./components/data/evidence-panel";
import { M5Preflight } from "./components/data/batch-preflight-panel";
import { M2Analysis, M3Analysis, Results } from "./components/analysis/analysis-panels";
import { RMultiplePanel, type RSource } from "./components/analysis/r-multiple-panel";
import { M4Documents } from "./components/research/documents-panel";
import { MonteCarloAnalysis, WhatIfAnalysis } from "./components/advanced/scenario-panels";
import { Diagnostics, type RunDiagnostics } from "./components/advanced/diagnostics-panel";
import { PortfolioLab } from "./components/portfolio/portfolio-lab";
import { EquityAttach, EquityHowTo } from "./components/analysis/equity-panel";
import { ParameterExplorer } from "./components/exploration/parameter-explorer";
import { upsertChoiceBlock } from "./vault/choice-block";
import { isMt5ReportPath, MT5_REPORT_ACCEPT, MT5_REPORT_HINT } from "./application/report-files";
import { DismissButton } from "./components/dismiss-button";
import { EquityPanel } from "./components/analysis/equity-panel";

export { writeGeneratedNote } from "./vault/research-vault";

export const RESEARCH_VIEW_TYPE = "trading-research-lab-m0";

export class ResearchView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TradingResearchLabPlugin) {
    super(leaf);
  }

  getViewType(): string { return RESEARCH_VIEW_TYPE; }
  getDisplayText(): string { return "Trading Research Lab"; }
  getIcon(): string { return "line-chart"; }

  async onOpen(): Promise<void> {
    this.root = createRoot(this.contentEl);
    this.root.render(<ResearchPanel plugin={this.plugin} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}

function ResearchPanel({ plugin }: { plugin: TradingResearchLabPlugin }): React.ReactElement {
  // Notes linked to a report by trl_dataset_id; deletion moves them to Obsidian's trash (recoverable).
  const linkedNotes = useMemo(() => ({
    find: (datasetId: string): string[] => plugin.app.vault.getMarkdownFiles().filter((file) => plugin.app.metadataCache.getFileCache(file)?.frontmatter?.trl_dataset_id === datasetId).map((file) => file.path).sort(),
    trash: async (paths: string[]): Promise<number> => {
      let moved = 0;
      for (const notePath of paths) {
        const file = plugin.app.vault.getAbstractFileByPath(notePath);
        if (file) { await plugin.app.vault.trash(file, false); moved += 1; }
      }
      return moved;
    },
  }), [plugin]);
  const [status, setStatus] = useState("Ready. Select an MT5 Strategy Tester report (.xlsx or .html).");
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<StatisticsResult | null>(null);
  const [evidence, setEvidence] = useState<DatasetEvidence | null>(null);
  const [intakeStatus, setIntakeStatus] = useState<string | null>(null);
  const [snapshotVerification, setSnapshotVerification] = useState<SnapshotVerification | null>(null);
  const [diagnostics, setDiagnostics] = useState<RunDiagnostics | null>(null);
  const [accountMode, setAccountMode] = useState("UNDECLARED");
  const [closeEventAnalysis, setCloseEventAnalysis] = useState<TradeAnalysisResult | null>(null);
  const [lifecycleAnalysis, setLifecycleAnalysis] = useState<TradeAnalysisResult | null>(null);
  const [dailyDrawdown, setDailyDrawdown] = useState<DailyDrawdownResult | null>(null);
  const [equityAvailability, setEquityAvailability] = useState<EquityAvailabilityResult | null>(null);
  const [strategy, setStrategy] = useState<{ id: string; path: string } | null>(null);
  const [experiment, setExperiment] = useState<{ id: string; path: string } | null>(null);
  const [report, setReport] = useState<{ id: string; path: string } | null>(null);
  const [documentStatus, setDocumentStatus] = useState<string | null>(null);
  const [batchPaths, setBatchPaths] = useState<string[]>([]);
  const [batchPreflight, setBatchPreflight] = useState<PortfolioPreflightResult | null>(null);
  const [combinedBalance, setCombinedBalance] = useState<CombinedBalanceResult | null>(null);
  const [combinedDaily, setCombinedDaily] = useState<CombinedDailyResult | null>(null);
  const [fixedCost, setFixedCost] = useState("0.00");
  const [fixedCostScenario, setFixedCostScenario] = useState<FixedCostScenarioResult | null>(null);
  const [fixedCostError, setFixedCostError] = useState<string | null>(null);
  const [monteCarloSeed, setMonteCarloSeed] = useState("20260921");
  const [monteCarloPathCount, setMonteCarloPathCount] = useState("1000");
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [monteCarloError, setMonteCarloError] = useState<string | null>(null);
  // The page lives in the plugin's navigation store, shared with the left sidebar (NAV-1).
  const navigation = plugin.navigation;
  const activePage = useSyncExternalStore((listener) => navigation.subscribe(listener), () => navigation.current.page);
  const setActivePage = (page: WorkspacePage): void => navigation.setPage(page);
  const [importBusy, setImportBusy] = useState(false);
  const [equityMetrics, setEquityMetrics] = useState<EquityMetrics | null>(null);
  const [equityMetricsError, setEquityMetricsError] = useState<string | null>(null);
  const [validated, setValidated] = useState<{ datasetRef: string; eventCount: number; workerWasReady: boolean; readinessMs: number; importMs: number } | null>(null);
  const [libraryEntries, setLibraryEntries] = useState<DatasetEvidence[]>([]);
  const [setCheck, setSetCheck] = useState<SetCheckResult | null>(null);
  const setInputRef = useRef<HTMLInputElement>(null);
  const [displaySeries, setDisplaySeries] = useState<CloseEventDisplaySeries | null>(null);
  const [performanceMetrics, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [cardErrors, setCardErrors] = useState<{ closeEvents: string | null; dailyDrawdown: string | null; displaySeries: string | null; performance: string | null }>({ closeEvents: null, dailyDrawdown: null, displaySeries: null, performance: null });
  // Resolve the worker per request: saving settings replaces `plugin.worker`.
  const service = useMemo(() => new ResearchService({ request: (method, params, timeoutMs) => plugin.worker.request(method, params, timeoutMs) }), [plugin]);
  const importRuns = useRef(new LatestRun()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const [batchBusy, setBatchBusy] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  // Any change to the batch invalidates every downstream batch result.
  const resetBatchResults = (): void => { setBatchPreflight(null); setCombinedBalance(null); setCombinedDaily(null); setBatchError(null); };
  const batchStep = async (message: string, step: () => Promise<void>): Promise<void> => {
    setBatchBusy(message);
    setBatchError(null);
    try { await step(); } catch (caught) { setBatchError(reasonText(caught)); } finally { setBatchBusy(null); }
  };
  const selectBatchFiles = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    try {
      const paths = files.map(localPathForSelectedFile);
      if (paths.length === 0 || paths.some((path) => !isMt5ReportPath(path))) throw new Error("Select MT5 Strategy Tester reports (.xlsx or .html).");
      setBatchPaths((current) => [...current, ...paths.filter((path) => !current.includes(path))]);
      resetBatchResults();
    } catch (caught) { setBatchError(reasonText(caught)); }
  };
  const runBatchPreflight = (): Promise<void> => batchStep(`Checking ${batchPaths.length} reports (each is preserved and verified first)…`, async () => {
    resetBatchResults();
    const result = await service.preflightBatch(batchPaths);
    setBatchPreflight(result);
    new Notice(`Batch check: ${result.status === "ELIGIBLE" ? "eligible" : "blocked"}. Nothing was combined yet.`);
  });
  const createCombinedBalance = async (): Promise<void> => {
    if (batchPreflight?.status !== "ELIGIBLE") return;
    if (!window.confirm("Create the combined realised-balance artifact for this eligible batch? This does not create a research document.")) return;
    await batchStep("Creating the combined realised-balance series…", async () => {
      setCombinedBalance(await service.createCombinedRealisedBalance(batchPaths));
      setCombinedDaily(null);
      new Notice("Combined realised-balance artifact created. No research document was created.");
    });
  };
  const runCombinedDaily = (): Promise<void> => batchStep("Calculating combined daily realised drawdown…", async () => { setCombinedDaily(await service.combinedDailyDrawdown(batchPaths)); });
  const resetAnalysisState = (): void => {
    setCardErrors({ closeEvents: null, dailyDrawdown: null, displaySeries: null, performance: null });
    setStatistics(null);
    setDisplaySeries(null);
    setPerformance(null);
    setRResult(null);
    setRError(null);
    setDiagnostics(null);
    setCloseEventAnalysis(null);
    setLifecycleAnalysis(null);
    setDailyDrawdown(null);
    setEquityAvailability(null);
    setFixedCostScenario(null);
    setFixedCostError(null);
    setMonteCarloResult(null);
    setMonteCarloError(null);
    setExperiment(null);
    setReport(null);
    setDocumentStatus(null);
  };

  /** Step 1: preserve and validate the report. Nothing is analysed yet. */
  const run = async (requestedSourcePath: string): Promise<void> => {
    const sourceToValidate = requestedSourcePath.trim();
    if (!isMt5ReportPath(sourceToValidate)) {
      setError("Select an MT5 Strategy Tester report (.xlsx or .html).");
      return;
    }
    const token = importRuns.begin();
    const isCurrent = (): boolean => importRuns.isCurrent(token);
    setImportBusy(true);
    setError(null);
    resetAnalysisState();
    setValidated(null);
    setStatus("Copying the report unchanged and checking it…");
    try {
      const workerWasReady = plugin.worker.isReady;
      const readiness = await measure(() => plugin.worker.ensureReady());
      const imported = await measure(() => service.intakeMt5Report(sourceToValidate));
      if (!isCurrent()) return;
      setEvidence(imported.result.intake_receipt);
      setIntakeStatus(imported.result.intake_status);
      setSnapshotVerification({ state: "VERIFIED", message: "Verified during intake: the managed raw snapshot matches the selected source SHA-256." });
      setValidated({ datasetRef: imported.result.dataset_ref, eventCount: imported.result.event_count, workerWasReady, readinessMs: readiness.elapsedMs, importMs: imported.elapsedMs });
      setStatus(`Validated and stored: ${imported.result.event_count} source events. Nothing has been analysed yet.`);
    } catch (caught) {
      if (!isCurrent()) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("The report could not be validated.");
    } finally {
      if (isCurrent()) setImportBusy(false);
    }
  };

  /** Uses a report already in the library as the validated report (no re-import). */
  const useLibraryReport = (entry: DatasetEvidence): void => {
    importRuns.begin();
    resetAnalysisState();
    setError(null);
    setEvidence(entry);
    setIntakeStatus(null);
    setSnapshotVerification(null);
    setValidated({ datasetRef: entry.dataset_ref, eventCount: entry.event_count, workerWasReady: plugin.worker.isReady, readinessMs: 0, importMs: 0 });
    setStatus(`Using ${entry.original_filename} from the library. Nothing has been analysed yet.`);
  };

  /** Step 3: run TRL's calculations on the validated report. */
  const analyse = async (): Promise<void> => {
    if (!validated) return;
    const token = importRuns.begin();
    const isCurrent = (): boolean => importRuns.isCurrent(token);
    const datasetRef = validated.datasetRef;
    setImportBusy(true);
    setError(null);
    resetAnalysisState();
    try {
      const runStartedAt = performance.now();
      setStatus(`Calculating verified balance statistics for ${validated.eventCount} source events…`);
      const calculated = await measure(() => service.basicStatistics(datasetRef));
      if (!isCurrent()) return;
      setStatus("Calculating verified close-event and realised daily-balance dashboard results…");
      const automaticResults = await Promise.allSettled([
        service.closeEventSummary(datasetRef),
        service.realisedBalanceDailyDrawdown(datasetRef),
        service.equityAvailability(datasetRef),
        service.closeEventDisplaySeries(datasetRef),
        service.performanceMetrics(datasetRef),
      ]);
      if (!isCurrent()) return;
      const presentationStartedAt = performance.now();
      const measured: RunDiagnostics = {
        workerWasReady: validated.workerWasReady,
        workerReadinessMs: validated.readinessMs,
        importMs: validated.importMs,
        analysisMs: calculated.elapsedMs,
        reportPayloadMs: 0,
        noteWriteMs: 0,
        viewPresentationMs: 0,
        totalMs: 0,
      };
      setStatistics(calculated.result);
      const [closeEventResult, dailyDrawdownResult, equityAvailabilityResult, displaySeriesResult, performanceResult] = automaticResults;
      if (performanceResult.status === "fulfilled") setPerformance(performanceResult.value);
      if (displaySeriesResult.status === "fulfilled") setDisplaySeries(displaySeriesResult.value);
      if (closeEventResult.status === "fulfilled") setCloseEventAnalysis(closeEventResult.value);
      if (dailyDrawdownResult.status === "fulfilled") setDailyDrawdown(dailyDrawdownResult.value);
      setCardErrors({
        closeEvents: closeEventResult.status === "rejected" ? reasonText(closeEventResult.reason) : null,
        dailyDrawdown: dailyDrawdownResult.status === "rejected" ? reasonText(dailyDrawdownResult.reason) : null,
        displaySeries: displaySeriesResult.status === "rejected" ? reasonText(displaySeriesResult.reason) : null,
        performance: performanceResult.status === "rejected" ? reasonText(performanceResult.reason) : null,
      });
      if (equityAvailabilityResult.status === "fulfilled") setEquityAvailability(equityAvailabilityResult.value);
      setDiagnostics(measured);
      await nextAnimationFrame();
      if (!isCurrent()) return;
      setDiagnostics({ ...measured, viewPresentationMs: performance.now() - presentationStartedAt, totalMs: performance.now() - runStartedAt });
      const unavailableCards = automaticResults.filter((result) => result.status === "rejected").length;
      setStatus(unavailableCards === 0
        ? "Analysis complete. Results are on the Overview and Analysis pages. No research document was created."
        : `Analysis complete with ${unavailableCards} optional result(s) unavailable. Results are on the Overview and Analysis pages.`);
      new Notice("Trading Research Lab analysis completed. Open Overview or Analysis to see the results.");
    } catch (caught) {
      if (!isCurrent()) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("The analysis did not complete.");
    } finally {
      if (isCurrent()) setImportBusy(false);
    }
  };

  const createStrategy = async (): Promise<void> => {
    const title = await requestDocumentName(plugin.app, "Create strategy", "Strategy name", "New strategy");
    if (!title) return;
    setError(null);
    try {
      const id = uuidv7();
      const path = await createVaultDocument(plugin, "Strategies", title, strategyDocumentText(id, title));
      setStrategy({ id, path });
      setExperiment(null);
      setReport(null);
      setDocumentStatus(`Strategy created: ${path}`);
      new Notice("Trading Research Lab strategy created.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setDocumentStatus(`Strategy creation did not complete: ${message}`);
    }
  };

  const createExperiment = async (): Promise<void> => {
    if (strategy === null || statistics === null) return;
    const title = await requestDocumentName(plugin.app, "Create experiment", "Experiment name", "New experiment");
    if (!title) return;
    setError(null);
    try {
      const id = uuidv7();
      const path = await createVaultDocument(plugin, "Experiments", title, experimentDocumentText(id, title, strategy.id, statistics.dataset_id, statistics.analysis_run_id));
      setExperiment({ id, path });
      setReport(null);
      setDocumentStatus(`Experiment created: ${path}`);
      new Notice("Trading Research Lab experiment created.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setDocumentStatus(`Experiment creation did not complete: ${message}`);
    }
  };

  const selectStrategy = async (): Promise<void> => {
    setError(null);
    try {
      const selected = await readCurrentDocument(plugin, "strategy", []);
      setStrategy({ id: selected.id, path: selected.path });
      setExperiment(null);
      setReport(null);
      setDocumentStatus(`Existing strategy selected: ${selected.path}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setDocumentStatus(`Strategy selection did not complete: ${message}`);
    }
  };

  const selectExperiment = async (): Promise<void> => {
    if (statistics === null) return;
    setError(null);
    try {
      const selected = await readCurrentDocument(plugin, "experiment", ["trl_strategy_id", "trl_dataset_id", "trl_analysis_run_id"]);
      if (selected.values.trl_dataset_id !== statistics.dataset_id || selected.values.trl_analysis_run_id !== statistics.analysis_run_id) {
        throw new Error("Selected experiment does not match the currently loaded dataset and analysis. Load its matching report first.");
      }
      setStrategy({ id: selected.values.trl_strategy_id!, path: "Selected through experiment" });
      setExperiment({ id: selected.id, path: selected.path });
      setReport(null);
      setDocumentStatus(`Existing experiment selected: ${selected.path}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setDocumentStatus(`Experiment selection did not complete: ${message}`);
    }
  };

  const selectReport = async (): Promise<void> => {
    if (experiment === null || statistics === null) return;
    setError(null);
    try {
      const selected = await readCurrentDocument(plugin, "report", ["trl_experiment_id", "trl_dataset_id", "trl_analysis_run_id"]);
      if (selected.values.trl_experiment_id !== experiment.id || selected.values.trl_dataset_id !== statistics.dataset_id || selected.values.trl_analysis_run_id !== statistics.analysis_run_id) {
        throw new Error("Selected report does not match the selected experiment and currently loaded analysis.");
      }
      setReport({ id: selected.id, path: selected.path });
      setDocumentStatus(`Existing report selected: ${selected.path}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setDocumentStatus(`Report selection did not complete: ${message}`);
    }
  };

  const createOrRegenerateReport = async (): Promise<void> => {
    if (experiment === null || statistics === null || evidence === null) return;
    setError(null);
    try {
      const reportId = report?.id ?? uuidv7();
      const payload = await service.prepareReportPayload(evidence.dataset_ref, statistics.analysis_run_id, reportId);
      if (report === null) {
        const title = await requestDocumentName(plugin.app, "Create report", "Report name", "New research report");
        if (!title) return;
        const path = await createVaultDocument(plugin, "Reports", title, reportDocumentText(payload, title, experiment.id));
        await service.commitReportRevision(payload, 1, null);
        setReport({ id: reportId, path });
        setDocumentStatus(`Report revision 1 created: ${path}`);
        new Notice("Trading Research Lab report created.");
        return;
      }
      const existing = plugin.app.vault.getAbstractFileByPath(report.path);
      if (!(existing instanceof TFile)) throw new Error("The selected report is no longer available. Review the vault before creating another report.");
      const prior = await plugin.app.vault.read(existing);
      const inspection = inspectReportForRegeneration(prior, payload, experiment.id);
      if (!inspection.changed) {
        setDocumentStatus("NO_CHANGES_DETECTED — the report was not written and no revision was created.");
        new Notice("No report changes detected.");
        return;
      }
      if (!window.confirm("The generated report section changed. Any edits inside that generated section will be replaced; text outside it remains unchanged. Continue?")) {
        setDocumentStatus("Changed regeneration was cancelled before writing the report.");
        return;
      }
      const nextRevision = inspection.revision + 1;
      await plugin.app.vault.modify(existing, regenerateReportText(prior, payload, experiment.id, nextRevision));
      await service.commitReportRevision(payload, nextRevision, inspection.priorConfigurationHash);
      setDocumentStatus(`Report revision ${nextRevision} created: ${report.path}`);
      new Notice("Trading Research Lab report regenerated.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setDocumentStatus(`Report check did not complete: ${message}`);
    }
  };

  const [rSource, setRSource] = useState<RSource>("AVERAGE_LOSS");
  const [rAmount, setRAmount] = useState("");
  const [rResult, setRResult] = useState<RMultipleMetrics | null>(null);
  const [rBusy, setRBusy] = useState(false);
  const [rError, setRError] = useState<string | null>(null);
  const runRMultiples = async (): Promise<void> => {
    const datasetRef = evidence?.dataset_ref ?? statistics?.dataset_ref;
    if (datasetRef === undefined) return;
    setRBusy(true);
    setRError(null);
    try { setRResult(await service.rMultipleMetrics(datasetRef, rSource, rSource === "DECLARED" ? rAmount.trim() : undefined)); }
    catch (caught) { setRResult(null); setRError(reasonText(caught)); }
    finally { setRBusy(false); }
  };

  const recordParameterChoice = async (markdown: string, evaluationId: string): Promise<void> => {
    if (experiment === null) throw new Error("Select or create an Experiment under Research first.");
    const file = plugin.app.vault.getAbstractFileByPath(experiment.path);
    if (!(file instanceof TFile)) throw new Error(`The experiment note ${experiment.path} is not available. Re-select it under Research.`);
    const prior = await plugin.app.vault.read(file);
    const { text, replaced } = upsertChoiceBlock(prior, evaluationId, markdown);
    if (replaced && !window.confirm("Replace the choice previously recorded in this experiment note? Text outside the marked choice block stays unchanged.")) throw new Error("Recording was cancelled; the note was not changed.");
    await plugin.app.vault.modify(file, text);
    new Notice(replaced ? "Recorded choice updated in the experiment note." : "Choice recorded in the experiment note.");
  };

  const runM3Analysis = async (): Promise<void> => {
    const datasetRef = evidence?.dataset_ref ?? statistics?.dataset_ref;
    if (datasetRef === undefined) return;
    setError(null);
    setStatus("Calculating source-reported-clock realised-balance daily drawdown…");
    try {
      const drawdown = await service.realisedBalanceDailyDrawdown(datasetRef);
      const equity = await service.equityAvailability(datasetRef);
      setDailyDrawdown(drawdown);
      setCardErrors((current) => ({ ...current, dailyDrawdown: null }));
      setEquityAvailability(equity);
      setStatus("Daily balance analysis completed (report clock, closed-trade balance).");
      new Notice("Daily balance analysis completed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Daily balance analysis did not complete.");
    }
  };

  const runM2Analysis = async (): Promise<void> => {
    const datasetRef = evidence?.dataset_ref ?? statistics?.dataset_ref;
    if (datasetRef === undefined) return;
    setError(null);
    setStatus("Calculating source-verified close-event analysis…");
    try {
      const closeEvents = await service.closeEventSummary(datasetRef);
      setStatus("Applying the declared account-mode lifecycle policy…");
      const lifecycles = await service.reconstructLifecycles(datasetRef, accountMode);
      setCloseEventAnalysis(closeEvents);
      setCardErrors((current) => ({ ...current, closeEvents: null }));
      try {
        setDisplaySeries(await service.closeEventDisplaySeries(datasetRef));
        setCardErrors((current) => ({ ...current, displaySeries: null }));
      } catch (caught) {
        setCardErrors((current) => ({ ...current, displaySeries: reasonText(caught) }));
      }
      try {
        setPerformance(await service.performanceMetrics(datasetRef));
        setCardErrors((current) => ({ ...current, performance: null }));
      } catch (caught) {
        setCardErrors((current) => ({ ...current, performance: reasonText(caught) }));
      }
      setLifecycleAnalysis(lifecycles);
      setFixedCostScenario(null);
      setFixedCostError(null);
      setMonteCarloResult(null);
      setMonteCarloError(null);
      setStatus(lifecycles.eligible
        ? "Trade analysis completed. Verified closes and inferred lifecycles are shown separately."
        : "Trade analysis completed. No lifecycles were inferred for this account-mode declaration.");
      new Notice("Trade analysis completed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Trade analysis did not complete.");
    }
  };

  const runFixedCostScenario = async (): Promise<void> => {
    const datasetRef = evidence?.dataset_ref ?? statistics?.dataset_ref;
    if (datasetRef === undefined) return;
    setError(null);
    setFixedCostError(null);
    const cost = fixedCost.trim();
    if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cost)) {
      const message = "Additional cost must be a non-negative decimal, for example 0.50. Negative values are not allowed.";
      setFixedCostError(message);
      setStatus("What-if scenario not run: correct the additional cost.");
      return;
    }
    setStatus("Calculating the declared fixed-cost What-If scenario over verified close events…");
    try {
      const result = await service.fixedCostScenario(datasetRef, cost);
      setFixedCostScenario(result);
      setStatus("What-if scenario completed: a cost sensitivity check, not a forecast.");
      new Notice("What-if scenario completed.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setFixedCostError(message);
      setError(message);
      setStatus("What-if scenario did not complete.");
    }
  };

  const runMonteCarlo = async (): Promise<void> => {
    const datasetRef = evidence?.dataset_ref ?? statistics?.dataset_ref;
    if (datasetRef === undefined) return;
    setError(null);
    setMonteCarloError(null);
    const seed = monteCarloSeed.trim();
    const pathCountText = monteCarloPathCount.trim();
    if (!/^\d+$/.test(seed)) {
      const message = "Seed must be a non-negative whole number, for example 20260921.";
      setMonteCarloError(message);
      setStatus("Monte Carlo was not run: correct the seed.");
      return;
    }
    if (!/^\d+$/.test(pathCountText) || Number(pathCountText) < 1 || Number(pathCountText) > 10_000) {
      const message = "Path count must be a whole number from 1 to 10,000. The visible default is 1,000.";
      setMonteCarloError(message);
      setStatus("Monte Carlo was not run: correct the path count.");
      return;
    }
    setStatus("Running seeded order permutations of verified close-event P/L…");
    try {
      const result = await service.monteCarloOrderPermutation(datasetRef, seed, Number(pathCountText));
      setMonteCarloResult(result);
      setStatus("Monte Carlo order-permutation study completed. It is historical ordering sensitivity, not a forecast.");
      new Notice("Trading Research Lab Monte Carlo study completed.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setMonteCarloError(message);
      setError(message);
      setStatus("Monte Carlo study did not complete.");
    }
  };

  const refreshLibrary = async (): Promise<void> => {
    try { setLibraryEntries((await service.listRegistry()).entries); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const checkSetFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !validated) return;
    setError(null);
    try {
      const selected = localPathForSelectedFile(file);
      if (!selected.toLowerCase().endsWith(".set")) throw new Error("Select the MT5 settings file (.set) used for this test.");
      setSetCheck(await service.checkSet(validated.datasetRef, selected));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const verifySnapshot = async (): Promise<void> => {
    if (evidence === null) return;
    setError(null);
    setSnapshotVerification({ state: "CHECKING", message: "Checking the managed raw snapshot against its recorded SHA-256…" });
    try {
      const verification = await service.verifyRawSnapshot(evidence.dataset_ref);
      if (!verification.verified) throw new Error("The managed raw snapshot hash does not match its recorded source hash.");
      setStatus("Snapshot verified: TRL's stored copy matches the original file.");
      setSnapshotVerification({
        state: "VERIFIED",
        message: "Verified on demand: the managed raw snapshot hash matches the recorded source SHA-256.",
      });
      new Notice("Managed raw snapshot verified.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Raw snapshot verification did not complete.");
      setSnapshotVerification(null);
    }
  };

  const selectSourceFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) return;
    try {
      const selectedPath = localPathForSelectedFile(file);
      if (!isMt5ReportPath(selectedPath)) {
        throw new Error("Select an MT5 Strategy Tester report (.xlsx or .html).");
      }
      setError(null);
      setStatus(`Selected ${selectedPath}. Copying it unchanged and validating…`);
      void run(selectedPath);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStatus("No report was selected.");
    }
  };

  // Equity metrics are loaded once and shared by the Equity panel and the Monte Carlo guidance.
  useEffect(() => {
    setEquityMetrics(null);
    setEquityMetricsError(null);
    if (equityAvailability?.status !== "AVAILABLE") return;
    let current = true;
    service.equityMetrics(equityAvailability.dataset_ref).then((result) => { if (current) setEquityMetrics(result); }).catch((caught) => { if (current) setEquityMetricsError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { current = false; };
  }, [service, equityAvailability]);

  // Report status for the sidebar card (NAV-3); the sidebar never calculates.
  useEffect(() => {
    navigation.update({
      busy: importBusy,
      report: validated && evidence ? {
        name: evidence.original_filename,
        market: [evidence.supplied_facts.symbol, evidence.supplied_facts.period?.split(" ")[0]].filter(Boolean).join(" · "),
        analysed: statistics?.dataset_ref === validated.datasetRef,
        equity: Boolean(evidence.equity),
        setCheck: setCheck && setCheck.dataset_ref === validated.datasetRef ? setCheck.status : evidence.set_check?.status ?? null,
      } : null,
    });
  }, [navigation, importBusy, validated, evidence, statistics, setCheck]);
  useEffect(() => {
    navigation.update({ workspaceOpen: true });
    return () => navigation.update({ workspaceOpen: false });
  }, [navigation]);
  const analyseRef = useRef(analyse);
  analyseRef.current = analyse;
  useEffect(() => navigation.handleActions((action) => {
    if (action === "validate") fileInputRef.current?.click();
    else void analyseRef.current();
  }), [navigation]);

  return <section className="trl-m0">
    <header className="trl-m0__workspace-header trl-pagebar">
      <div><span className="trl-pagebar__brand">Trading Research Lab</span><h2>{pageInfo(activePage).label}</h2><p>{pageInfo(activePage).description}</p></div>
      <div className="trl-pagebar__controls">
        <select aria-label="Pages" value={activePage} onChange={(event) => setActivePage(event.currentTarget.value as WorkspacePage)}>
          {ALL_PAGES.map((page) => <option key={page.id} value={page.id}>{page.label}</option>)}
        </select>
        <button type="button" title="Show the TRL navigation in the left sidebar" onClick={() => void plugin.openNavigation(true)}>☰ Sidebar</button>
      </div>
    </header>
    <input ref={fileInputRef} className="trl-m0__file-input" type="file" accept={MT5_REPORT_ACCEPT} onChange={selectSourceFile} />
    {error && <div className="trl-m0__error-wrap"><pre className="trl-m0__error" role="alert">{error}</pre><DismissButton onDismiss={() => setError(null)} /></div>}
    {activePage === "overview" && <DashboardSummary
      statistics={statistics}
      evidence={evidence}
      closeEvents={closeEventAnalysis}
      dailyDrawdown={dailyDrawdown}
      strategy={strategy}
      experiment={experiment}
      report={report}
      errors={cardErrors}
      displaySeries={displaySeries}
      performance={performanceMetrics}
      busyStatus={importBusy ? status : null}
      onBrowseReport={() => setActivePage("data")}
      onFocusDocuments={() => setActivePage("research")}
      onRunTradeAnalysis={() => void runM2Analysis()}
      onRunDailyAnalysis={() => void runM3Analysis()}
    />}
    {activePage === "data" && <section className="trl-page" aria-label="Data and import">
      <header className="trl-page__header"><div><h3>Data & import</h3><p>Bring in one MT5 report at a time. TRL preserves the original source before any analysis.</p></div></header>
      <section className="trl-page__surface trl-import__step" aria-label="Step 1: report">
        <h4>1. Report</h4>
        <p className="trl-m0__note">Choose one {MT5_REPORT_HINT}. TRL copies it unchanged, checks it, and stores it in the library. Nothing is analysed yet.</p>
        <div className="trl-m0__actions">
          <button type="button" className="mod-cta" disabled={importBusy} onClick={() => fileInputRef.current?.click()}>Browse and validate report…</button>
          <select aria-label="Use a report already in the library" value="" disabled={importBusy} onFocus={() => void refreshLibrary()} onChange={(event) => { const entry = libraryEntries.find((item) => item.dataset_ref === event.currentTarget.value); if (entry) useLibraryReport(entry); }}>
            <option value="">…or use a report already in the library</option>
            {libraryEntries.map((entry) => <option key={entry.dataset_ref} value={entry.dataset_ref}>{entry.original_filename} · {entry.supplied_facts.symbol ?? "?"} {entry.supplied_facts.period ?? ""}</option>)}
          </select>
        </div>
        {validated && evidence && <dl className="trl-import__facts">
          <dt>Report</dt><dd><strong>{evidence.original_filename}</strong></dd>
          <dt>Market</dt><dd>{evidence.supplied_facts.symbol ?? "—"} · {evidence.supplied_facts.period ?? "—"}</dd>
          <dt>Account</dt><dd>{evidence.supplied_facts.initial_deposit ?? "—"} {evidence.supplied_facts.currency ?? ""} · leverage {evidence.supplied_facts.leverage ?? "—"}</dd>
          <dt>Source events</dt><dd>{validated.eventCount}</dd>
          <dt>Checks</dt><dd>Copied unchanged and hash-verified{evidence.source_checks?.includes("HTML_DEALS_TOTALS_MATCH") ? "; HTML deal totals match the deals" : ""}{evidence.equity ? "; equity log attached" : ""}</dd>
        </dl>}
        {validated && evidence && evidence.warnings.length > 0 && <ul className="trl-batch__warnings">{evidence.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
        <p className="trl-m0__note" role="status">{status}</p>
      </section>
      {validated && evidence && <section className="trl-page__surface trl-import__step" aria-label="Step 2: companion files">
        <h4>2. Companion files <span className="trl-m0__note">(optional)</span></h4>
        <p className="trl-m0__note">Add these if you have them. Each is checked against the report above; you can skip them and add them later.</p>
        <div className="trl-import__companions">
          <div className="trl-import__companion">
            <h5>Equity log (.csv): floating drawdown</h5>
            <EquityHowTo />
            <EquityAttach service={service} datasetRef={validated.datasetRef} attached={Boolean(evidence.equity)} onAttached={() => { void service.getEvidence(validated.datasetRef).then(setEvidence); if (statistics?.dataset_ref === validated.datasetRef) void service.equityAvailability(validated.datasetRef).then(setEquityAvailability); }} />
          </div>
          <div className="trl-import__companion">
            <h5>Settings file (.set): were the intended inputs used?</h5>
            <p className="trl-m0__note">MT5 can silently run a test with the EA's defaults or an old preset. Choose the .set you meant to use and TRL compares it, input by input, with what the report shows actually ran.</p>
            <input ref={setInputRef} className="trl-m0__file-input" type="file" accept=".set" onChange={(event) => void checkSetFile(event)} />
            <button type="button" onClick={() => setInputRef.current?.click()}>Browse and check .set…</button>
            {setCheck && setCheck.dataset_ref === validated.datasetRef && <div className="trl-companion">
              <p className={setCheck.status === "MATCH" ? "trl-companion__ok" : "trl-m0__inline-error"}>{setCheck.status === "MATCH" ? `✓ All ${setCheck.compared} inputs in ${setCheck.set_filename} match the report.` : `${setCheck.differences.length} of ${setCheck.compared} inputs differ from ${setCheck.set_filename}.`}<DismissButton onDismiss={() => setSetCheck(null)} /></p>
              {setCheck.differences.length > 0 && <div className="trl-monthly"><table><thead><tr><th scope="col">Input</th><th scope="col">Report (ran with)</th><th scope="col">.set (intended)</th></tr></thead><tbody>{setCheck.differences.map((item) => <tr key={item.name}><th scope="row">{item.name}</th><td>{item.report_value}</td><td>{item.set_value}</td></tr>)}</tbody></table></div>}
              {setCheck.notes.map((note) => <p key={note} className="trl-m0__note">{note}</p>)}
            </div>}
          </div>
        </div>
      </section>}
      {validated && <section className="trl-page__surface trl-import__step" aria-label="Step 3: analyse">
        <h4>3. Analyse</h4>
        <p className="trl-m0__note">Runs TRL's calculations on the validated report. Results appear on <strong>Overview</strong> (dashboard) and <strong>Analysis</strong> (details and equity). No research note is created unless you ask on the Research page.</p>
        <div className="trl-m0__actions">
          <button type="button" className="mod-cta" disabled={importBusy} onClick={() => void analyse()}>{statistics?.dataset_ref === validated.datasetRef ? "Analyse again" : "Start analysis"}</button>
          {statistics?.dataset_ref === validated.datasetRef && <>
            <button type="button" onClick={() => setActivePage("overview")}>Open Overview</button>
            <button type="button" onClick={() => setActivePage("analysis")}>Open Analysis</button>
          </>}
        </div>
      </section>}
      <M5Preflight paths={batchPaths} result={batchPreflight} combined={combinedBalance} daily={combinedDaily} busy={batchBusy} error={batchError} inputRef={batchInputRef} onSelect={selectBatchFiles} onRemove={(path) => { setBatchPaths((current) => current.filter((item) => item !== path)); resetBatchResults(); }} onClear={() => { setBatchPaths([]); resetBatchResults(); }} onRun={() => void runBatchPreflight()} onCreate={() => void createCombinedBalance()} onDaily={() => void runCombinedDaily()} />
      {evidence && <Evidence evidence={evidence} intakeStatus={intakeStatus} snapshotVerification={snapshotVerification} onVerify={() => void verifySnapshot()} />}
    </section>}
    {activePage === "analysis" && <section className="trl-page" aria-label="Analysis">
      <header className="trl-page__header"><div><h3>Analysis</h3><p>Review verified results first. Any unavailable evidence remains explicitly unavailable.</p></div></header>
      {!statistics && <section className="trl-page__empty"><p>Import an MT5 report before running analysis.</p><button type="button" className="mod-cta" onClick={() => setActivePage("data")}>Go to Data & import</button></section>}
      {statistics && <Results statistics={statistics} />}
      {(evidence || statistics) && <M2Analysis
      accountMode={accountMode}
      closeEvents={closeEventAnalysis}
      lifecycles={lifecycleAnalysis}
      onAccountModeChange={setAccountMode}
      onRun={() => void runM2Analysis()}
    />}
      {(evidence || statistics) && <M3Analysis
      drawdown={dailyDrawdown}
      equity={equityAvailability}
      onRun={() => void runM3Analysis()}
    />}
      {evidence && <EquityPanel service={service} datasetRef={evidence.dataset_ref} availability={equityAvailability} metrics={equityMetrics} error={equityMetricsError} currency={evidence.supplied_facts.currency} onChanged={() => void service.equityAvailability(evidence.dataset_ref).then(setEquityAvailability)} />}
      {(evidence || statistics) && <RMultiplePanel source={rSource} amount={rAmount} result={rResult} busy={rBusy} error={rError} enabled={statistics !== null} onSourceChange={(value) => { setRSource(value); setRResult(null); setRError(null); }} onAmountChange={(value) => { setRAmount(value); setRError(null); }} onRun={() => void runRMultiples()} />}
    </section>}
    {activePage === "research" && <section className="trl-page" aria-label="Research documents">
      <header className="trl-page__header"><div><h3>Research</h3><p>Link explicit Strategy, Experiment, and Report notes without overwriting your writing.</p></div></header>
      <M4Documents
        hasAnalysis={statistics !== null && evidence !== null}
        strategy={strategy}
        experiment={experiment}
        report={report}
        documentStatus={documentStatus}
        onCreateStrategy={() => void createStrategy()}
        onSelectStrategy={() => void selectStrategy()}
        onCreateExperiment={() => void createExperiment()}
        onSelectExperiment={() => void selectExperiment()}
        onCreateOrRegenerateReport={() => void createOrRegenerateReport()}
        onSelectReport={() => void selectReport()}
      />
    </section>}
    {activePage === "help" && <HelpPage />}
    {activePage === "portfolio" && <PortfolioLab service={service} linkedNotes={linkedNotes} />}
    {activePage === "parameters" && <ParameterExplorer service={service} experiment={experiment} onRecordChoice={recordParameterChoice} />}
    {activePage === "advanced" && <section className="trl-page" aria-label="Advanced research">
      <header className="trl-page__header"><div><h3>Advanced research</h3><p>Optional, qualified studies. Results are research evidence, not trading recommendations.</p></div></header>
      <section className="trl-page__surface trl-moved-card"><h4>Parameter studies and forward checks</h4><p className="trl-m0__note">Importing MT5 optimisation results, pairing forward tests, and neighbourhood checks now live on the Parameters page.</p><button type="button" onClick={() => setActivePage("parameters")}>Open Parameters</button></section>
      {(evidence || statistics) && <WhatIfAnalysis
      cost={fixedCost}
      error={fixedCostError}
      result={fixedCostScenario}
      enabled={closeEventAnalysis !== null}
      onCostChange={(value) => { setFixedCost(value); setFixedCostError(null); }}
      onRun={() => void runFixedCostScenario()}
    />}
      {(evidence || statistics) && <MonteCarloAnalysis
      equity={equityMetrics}
      seed={monteCarloSeed}
      pathCount={monteCarloPathCount}
      error={monteCarloError}
      result={monteCarloResult}
      enabled={closeEventAnalysis !== null}
      onSeedChange={(value) => { setMonteCarloSeed(value); setMonteCarloError(null); }}
      onPathCountChange={(value) => { setMonteCarloPathCount(value); setMonteCarloError(null); }}
      onRun={() => void runMonteCarlo()}
    />}
      {diagnostics && plugin.settings.showDeveloperDiagnostics && <Diagnostics diagnostics={diagnostics} />}
    </section>}
  </section>;
}

async function measure<T>(operation: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const startedAt = performance.now();
  const result = await operation();
  return { result, elapsedMs: performance.now() - startedAt };
}

function reasonText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
