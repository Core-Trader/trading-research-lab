import React, { useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ItemView, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import type TradingResearchLabPlugin from "./main";
import type { CombinedBalanceResult, CombinedDailyResult, DailyDrawdownResult, DatasetEvidence, EquityAvailabilityResult, FixedCostScenarioResult, MonteCarloResult, OptimisationGridResult, PairedForwardResult, PortfolioPreflightResult, StatisticsResult, TradeAnalysisResult } from "./types";
import { experimentDocumentText, inspectReportForRegeneration, regenerateReportText, reportDocumentText, strategyDocumentText, uuidv7 } from "./research-documents";
import { ResearchService } from "./application/research-service";
import { LatestRun } from "./application/latest-run";
import { localPathForSelectedFile } from "./services/local-file-path";
import { createVaultDocument, readCurrentDocument, requestDocumentName } from "./vault/research-vault";
import { DashboardSummary } from "./components/dashboard-summary";
import { WorkspaceNavigation, type WorkspacePage } from "./components/workspace-navigation";
import { Evidence, type SnapshotVerification } from "./components/data/evidence-panel";
import { M5Preflight } from "./components/data/batch-preflight-panel";
import { M2Analysis, M3Analysis, Results } from "./components/analysis/analysis-panels";
import { M4Documents } from "./components/research/documents-panel";
import { MonteCarloAnalysis, WhatIfAnalysis } from "./components/advanced/scenario-panels";
import { OptimisationEvidence, PairedForwardEvidence } from "./components/advanced/optimisation-panels";
import { Diagnostics, type RunDiagnostics } from "./components/advanced/diagnostics-panel";

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
  const [sourcePath, setSourcePath] = useState("");
  const [status, setStatus] = useState("Ready. Select an MT5 Strategy Tester .xlsx report.");
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
  const [optimisationPath, setOptimisationPath] = useState("");
  const [optimisationResult, setOptimisationResult] = useState<OptimisationGridResult | null>(null);
  const [optimisationMode, setOptimisationMode] = useState("1-minute OHLC");
  const [optimisationFilter, setOptimisationFilter] = useState("");
  const [optimisationSort, setOptimisationSort] = useState("Pass");
  const [forwardInPath, setForwardInPath] = useState("");
  const [forwardPath, setForwardPath] = useState("");
  const [forwardInStart, setForwardInStart] = useState("");
  const [forwardInEnd, setForwardInEnd] = useState("");
  const [forwardStart, setForwardStart] = useState("");
  const [forwardEnd, setForwardEnd] = useState("");
  const [forwardMode, setForwardMode] = useState("");
  const [activePage, setActivePage] = useState<WorkspacePage>("overview");
  const [forwardResult, setForwardResult] = useState<PairedForwardResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [cardErrors, setCardErrors] = useState<{ closeEvents: string | null; dailyDrawdown: string | null }>({ closeEvents: null, dailyDrawdown: null });
  // Resolve the worker per request: saving settings replaces `plugin.worker`.
  const service = useMemo(() => new ResearchService({ request: (method, params, timeoutMs) => plugin.worker.request(method, params, timeoutMs) }), [plugin]);
  const importRuns = useRef(new LatestRun()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const optimisationInputRef = useRef<HTMLInputElement>(null);
  const forwardInInputRef = useRef<HTMLInputElement>(null);
  const forwardInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const canRun = useMemo(() => sourcePath.trim().toLowerCase().endsWith(".xlsx"), [sourcePath]);
  const canRunOptimisation = useMemo(() => optimisationPath.trim().toLowerCase().endsWith(".xml") && optimisationMode.trim().length > 0, [optimisationPath, optimisationMode]);
  const selectBatchFiles = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    try {
      const paths = files.map(localPathForSelectedFile);
      if (paths.length === 0 || paths.some((path) => !path.toLowerCase().endsWith(".xlsx"))) throw new Error("Select an MT5 Strategy Tester .xlsx report.");
      setBatchPaths((current) => [...current, ...paths.filter((path) => !current.includes(path))]);
      setBatchPreflight(null);
      setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const runBatchPreflight = async (): Promise<void> => {
    setError(null);
    try {
      const result = await service.preflightBatch(batchPaths);
      setBatchPreflight(result);
      setCombinedBalance(null);
      new Notice(`M5 batch preflight ${result.status.toLowerCase()}. No combined artifact was written.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const createCombinedBalance = async (): Promise<void> => {
    if (batchPreflight?.status !== "ELIGIBLE") return;
    if (!window.confirm("Create the combined realised-balance artifact for this eligible batch? This does not create a research document.")) return;
    setError(null);
    try {
      const result = await service.createCombinedRealisedBalance(batchPaths);
      setCombinedBalance(result);
      new Notice("Combined realised-balance artifact created. No research document was created.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const runCombinedDaily = async (): Promise<void> => { try { setCombinedDaily(await service.combinedDailyDrawdown(batchPaths)); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } };
  const run = async (requestedSourcePath = sourcePath.trim()): Promise<void> => {
    const sourceToAnalyse = requestedSourcePath.trim();
    if (!sourceToAnalyse.toLowerCase().endsWith(".xlsx")) {
      setError("Select an MT5 Strategy Tester Excel report with the .xlsx extension.");
      return;
    }
    // A newer import supersedes this one; its late results must never be shown.
    const token = importRuns.begin();
    const isCurrent = (): boolean => importRuns.isCurrent(token);
    setImportBusy(true);
    setError(null);
    setCardErrors({ closeEvents: null, dailyDrawdown: null });
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
    setStatus("Creating verified raw snapshot and canonical intake evidence…");
    try {
      const runStartedAt = performance.now();
      const workerWasReady = plugin.worker.isReady;
      const readiness = await measure(() => plugin.worker.ensureReady());
      const imported = await measure(() => service.intakeMt5Excel(sourceToAnalyse));
      if (!isCurrent()) return;
      setStatus(`Calculating verified balance statistics for ${imported.result.event_count} source events…`);
      const datasetRef = imported.result.dataset_ref;
      const calculated = await measure(() => service.basicStatistics(datasetRef));
      if (!isCurrent()) return;
      setStatus("Calculating verified close-event and realised daily-balance dashboard results…");
      const automaticResults = await Promise.allSettled([
        service.closeEventSummary(datasetRef),
        service.realisedBalanceDailyDrawdown(datasetRef),
        service.equityAvailability(datasetRef),
      ]);
      if (!isCurrent()) return;
      const presentationStartedAt = performance.now();
      const measured: RunDiagnostics = {
        workerWasReady,
        workerReadinessMs: readiness.elapsedMs,
        importMs: imported.elapsedMs,
        analysisMs: calculated.elapsedMs,
        reportPayloadMs: 0,
        noteWriteMs: 0,
        viewPresentationMs: 0,
        totalMs: 0,
      };
      setStatistics(calculated.result);
      setEvidence(imported.result.intake_receipt);
      const [closeEventResult, dailyDrawdownResult, equityAvailabilityResult] = automaticResults;
      if (closeEventResult.status === "fulfilled") setCloseEventAnalysis(closeEventResult.value);
      if (dailyDrawdownResult.status === "fulfilled") setDailyDrawdown(dailyDrawdownResult.value);
      setCardErrors({
        closeEvents: closeEventResult.status === "rejected" ? reasonText(closeEventResult.reason) : null,
        dailyDrawdown: dailyDrawdownResult.status === "rejected" ? reasonText(dailyDrawdownResult.reason) : null,
      });
      if (equityAvailabilityResult.status === "fulfilled") setEquityAvailability(equityAvailabilityResult.value);
      setIntakeStatus(imported.result.intake_status);
      setSnapshotVerification({
        state: "VERIFIED",
        message: "Verified during intake: the managed raw snapshot matches the selected source SHA-256.",
      });
      setDiagnostics(measured);
      await nextAnimationFrame();
      if (!isCurrent()) return;
      setDiagnostics({
        ...measured,
        viewPresentationMs: performance.now() - presentationStartedAt,
        totalMs: performance.now() - runStartedAt,
      });
      setActivePage("overview");
      const unavailableCards = automaticResults.filter((result) => result.status === "rejected").length;
      setStatus(unavailableCards === 0
        ? "Completed. Verified dashboard results are ready. No research document was created."
        : `Completed. Basic dashboard results are ready; ${unavailableCards} optional card(s) could not be calculated.`);
      new Notice(unavailableCards === 0
        ? "Trading Research Lab analysis completed. No research document was created."
        : "Trading Research Lab analysis completed with limited dashboard results. No research document was created.");
    } catch (caught) {
      if (!isCurrent()) return;
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStatus("Research run did not complete.");
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
      setStatus("M3 basic analysis completed. Results use the report clock and realised balances only.");
      new Notice("Trading Research Lab M3 analysis completed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("M3 balance and risk analysis did not complete.");
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
      setLifecycleAnalysis(lifecycles);
      setFixedCostScenario(null);
      setFixedCostError(null);
      setMonteCarloResult(null);
      setMonteCarloError(null);
      setStatus(lifecycles.eligible
        ? "M2 analysis completed. Verified close events and inferred lifecycles are shown separately."
        : "M2 close-event analysis completed. No inferred lifecycles were created for the current account-mode declaration.");
      new Notice("Trading Research Lab M2 analysis completed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("M2 trade analysis did not complete.");
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
      setStatus("M6 What-If scenario was not run: correct the additional cost.");
      return;
    }
    setStatus("Calculating the declared fixed-cost What-If scenario over verified close events…");
    try {
      const result = await service.fixedCostScenario(datasetRef, cost);
      setFixedCostScenario(result);
      setStatus("M6 What-If scenario completed. It is a user-supplied cost sensitivity result, not a forecast.");
      new Notice("Trading Research Lab M6 What-If scenario completed.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setFixedCostError(message);
      setError(message);
      setStatus("M6 What-If scenario did not complete.");
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

  const refreshEvidence = async (): Promise<void> => {
    setError(null);
    try {
      const registry = await service.listRegistry();
      const nextEvidence = registry.entries[0] ?? null;
      if (nextEvidence?.dataset_ref !== evidence?.dataset_ref) {
        setIntakeStatus(null);
        setSnapshotVerification(null);
      }
      setEvidence(nextEvidence);
      setStatus(`Registry contains ${registry.entries.length} dataset(s).`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const runOptimisationIntake = async (): Promise<void> => {
    setError(null);
    setStatus("Creating immutable optimisation-export snapshot and preserving reported pass values…");
    try {
      const result = await service.intakeOptimisationGrid(optimisationPath.trim(), optimisationMode.trim());
      setOptimisationResult(result);
      setOptimisationSort("Pass");
      setOptimisationFilter("");
      setStatus(`Optimisation evidence imported: ${result.pass_count} MT5-reported passes. Sorting and filtering are inspection only.`);
      new Notice("Trading Research Lab optimisation evidence imported. No parameter was selected.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStatus("Optimisation evidence import did not complete.");
    }
  };

  const runForwardPair = async (): Promise<void> => {
    setError(null);
    try {
      const result = await service.intakePairedForwardGrid({
        in_sample_path: forwardInPath, forward_path: forwardPath,
        in_sample_start: forwardInStart, in_sample_end: forwardInEnd,
        forward_start: forwardStart, forward_end: forwardEnd,
        modelling_mode: forwardMode,
      });
      setForwardResult(result);
      setStatus(`Paired forward evidence imported: ${result.pair_count} exact parameter pairs. No parameter was selected.`);
      new Notice("Paired forward evidence imported. No parameter was selected.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStatus("Paired forward evidence import did not complete.");
    }
  };

  const verifySnapshot = async (): Promise<void> => {
    if (evidence === null) return;
    setError(null);
    setSnapshotVerification({ state: "CHECKING", message: "Checking the managed raw snapshot against its recorded SHA-256…" });
    try {
      const verification = await service.verifyRawSnapshot(evidence.dataset_ref);
      if (!verification.verified) throw new Error("The managed raw snapshot hash does not match its recorded source hash.");
      setStatus(`Managed raw snapshot verified: ${verification.observed_sha256}`);
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
      if (!selectedPath.toLowerCase().endsWith(".xlsx")) {
        throw new Error("Select an MT5 Strategy Tester Excel report with the .xlsx extension.");
      }
      setSourcePath(selectedPath);
      setError(null);
      setStatus(`Selected ${selectedPath}. Preserving source evidence and preparing analysis…`);
      void run(selectedPath);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStatus("No report was selected.");
    }
  };

  const selectOptimisationFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) return;
    try {
      const selectedPath = localPathForSelectedFile(file);
      if (!selectedPath.toLowerCase().endsWith(".xml")) throw new Error("Select an MT5 optimisation XML export with the .xml extension.");
      setOptimisationPath(selectedPath);
      setError(null);
      setStatus(`Selected optimisation export: ${selectedPath}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStatus("No optimisation export was selected.");
    }
  };

  const selectForwardFile = (target: "in" | "forward") => (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) return;
    try {
      const selected = localPathForSelectedFile(file);
      if (!selected.toLowerCase().endsWith(".xml")) throw new Error("Select an MT5 XML export.");
      if (target === "in") setForwardInPath(selected); else setForwardPath(selected);
      setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  return <section className="trl-m0">
    <header className="trl-m0__workspace-header">
      <div><h2>Trading Research Lab</h2><p>Local-first quantitative research workspace</p></div>
      <span>Desktop research canvas</span>
    </header>
    <WorkspaceNavigation activePage={activePage} onChange={setActivePage} />
    <input ref={fileInputRef} className="trl-m0__file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={selectSourceFile} />
    {error && <pre className="trl-m0__error" role="alert">{error}</pre>}
    {activePage === "overview" && <DashboardSummary
      statistics={statistics}
      evidence={evidence}
      closeEvents={closeEventAnalysis}
      dailyDrawdown={dailyDrawdown}
      strategy={strategy}
      experiment={experiment}
      report={report}
      errors={cardErrors}
      busyStatus={importBusy ? status : null}
      onBrowseReport={() => fileInputRef.current?.click()}
      onFocusDocuments={() => setActivePage("research")}
      onRunTradeAnalysis={() => void runM2Analysis()}
      onRunDailyAnalysis={() => void runM3Analysis()}
    />}
    {activePage === "data" && <section className="trl-page" aria-label="Data and import">
      <header className="trl-page__header"><div><h3>Data & import</h3><p>Bring in one MT5 report at a time. TRL preserves the original source before any analysis.</p></div></header>
      <section className="trl-page__surface">
      <p className="trl-m0__note">Select one MT5 Strategy Tester Excel report to preserve its source, create canonical evidence, and populate the dashboard.</p>
      <label className="trl-m0__field">
        <span>MT5 Strategy Tester Excel report (.xlsx)</span>
        <input value={sourcePath} onChange={(event) => setSourcePath(event.currentTarget.value)} placeholder="C:\\path\\to\\report.xlsx" />
      </label>
      <div className="trl-m0__actions">
        <button type="button" className="mod-cta" disabled={importBusy} onClick={() => fileInputRef.current?.click()}>Browse report and analyse…</button>
        <button type="button" disabled={!canRun || importBusy} onClick={() => void run()}>Analyse typed path</button>
        <button type="button" onClick={() => void refreshEvidence()}>Refresh recent data</button>
        <span role="status">{status}</span>
      </div>
      </section>
      {evidence && <Evidence evidence={evidence} intakeStatus={intakeStatus} snapshotVerification={snapshotVerification} onVerify={() => void verifySnapshot()} />}
      <M5Preflight paths={batchPaths} result={batchPreflight} combined={combinedBalance} daily={combinedDaily} inputRef={batchInputRef} onSelect={selectBatchFiles} onRemove={(path) => { setBatchPaths((current) => current.filter((item) => item !== path)); setBatchPreflight(null); setCombinedBalance(null); }} onClear={() => { setBatchPaths([]); setBatchPreflight(null); setCombinedBalance(null); }} onRun={() => void runBatchPreflight()} onCreate={() => void createCombinedBalance()} onDaily={() => void runCombinedDaily()} />
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
    {activePage === "advanced" && <section className="trl-page" aria-label="Advanced research">
      <header className="trl-page__header"><div><h3>Advanced research</h3><p>Optional, qualified studies. Results are research evidence, not trading recommendations.</p></div></header>
      <OptimisationEvidence path={optimisationPath} mode={optimisationMode} result={optimisationResult} filter={optimisationFilter} sort={optimisationSort} inputRef={optimisationInputRef} enabled={canRunOptimisation} onPathChange={setOptimisationPath} onModeChange={setOptimisationMode} onSelect={selectOptimisationFile} onRun={() => void runOptimisationIntake()} onFilterChange={setOptimisationFilter} onSortChange={setOptimisationSort} />
      <PairedForwardEvidence inPath={forwardInPath} forwardPath={forwardPath} inStart={forwardInStart} inEnd={forwardInEnd} forwardStart={forwardStart} forwardEnd={forwardEnd} mode={forwardMode} result={forwardResult} inRef={forwardInInputRef} forwardRef={forwardInputRef} onInPathChange={setForwardInPath} onForwardPathChange={setForwardPath} onInStartChange={setForwardInStart} onInEndChange={setForwardInEnd} onForwardStartChange={setForwardStart} onForwardEndChange={setForwardEnd} onModeChange={setForwardMode} onInSelect={selectForwardFile("in")} onForwardSelect={selectForwardFile("forward")} onRun={() => void runForwardPair()} />
      {(evidence || statistics) && <WhatIfAnalysis
      cost={fixedCost}
      error={fixedCostError}
      result={fixedCostScenario}
      enabled={closeEventAnalysis !== null}
      onCostChange={(value) => { setFixedCost(value); setFixedCostError(null); }}
      onRun={() => void runFixedCostScenario()}
    />}
      {(evidence || statistics) && <MonteCarloAnalysis
      seed={monteCarloSeed}
      pathCount={monteCarloPathCount}
      error={monteCarloError}
      result={monteCarloResult}
      enabled={closeEventAnalysis !== null}
      onSeedChange={(value) => { setMonteCarloSeed(value); setMonteCarloError(null); }}
      onPathCountChange={(value) => { setMonteCarloPathCount(value); setMonteCarloError(null); }}
      onRun={() => void runMonteCarlo()}
    />}
      {diagnostics && <Diagnostics diagnostics={diagnostics} />}
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
