import type { CloseEventDisplaySeries, Constraint, Objective, ParameterEvaluation, ParameterSchema, ParameterStudy, ParetoEvaluation, SingleTestAttachment, ForwardAttachment, SavedCombinationEntry, NeighbourhoodResult, NeighbourhoodRunAttachment, NeighbourhoodSet, NeighbourhoodSetWritten, NeighbourhoodSettings, PerformanceMetrics, PortfolioCombination, PortfolioExploration, RMultipleMetrics, CombinedBalanceResult, CombinedDailyResult, DailyDrawdownResult, DatasetEvidence, EquityAvailabilityResult, FixedCostScenarioResult, IntakeResult, MonteCarloResult, OptimisationGridResult, PairedForwardResult, PortfolioPreflightResult, StatisticsResult, TradeAnalysisResult } from "../types";
import type { ReportPayload } from "../research-documents";

/** The only worker capability the application layer depends on. */
export type WorkerTransport = {
  request<T>(method: string, params: Record<string, unknown>, timeoutMs?: number): Promise<T>;
};

export type PairedForwardRequest = {
  in_sample_path: string;
  forward_path: string;
  in_sample_start: string;
  in_sample_end: string;
  forward_start: string;
  forward_end: string;
  modelling_mode: string;
};

const LONG_RUNNING_MS = 60_000;

/**
 * Typed application boundary over the versioned JSON IPC. Views call these
 * methods instead of spelling worker method names; no calculation happens here.
 */
export class ResearchService {
  private readonly worker: WorkerTransport;

  constructor(worker: WorkerTransport) {
    this.worker = worker;
  }

  intakeMt5Excel(sourcePath: string): Promise<IntakeResult> {
    return this.worker.request("dataset.intake_mt5_excel", { source_path: sourcePath });
  }

  listRegistry(): Promise<{ entries: DatasetEvidence[] }> {
    return this.worker.request("dataset.list_registry", {});
  }

  verifyRawSnapshot(datasetRef: string): Promise<{ verified: boolean; expected_sha256: string; observed_sha256: string }> {
    return this.worker.request("dataset.verify_raw_snapshot", { dataset_ref: datasetRef });
  }

  basicStatistics(datasetRef: string): Promise<StatisticsResult> {
    return this.worker.request("analysis.basic_statistics", { dataset_ref: datasetRef });
  }

  closeEventSummary(datasetRef: string): Promise<TradeAnalysisResult> {
    return this.worker.request("analysis.close_event_summary", { dataset_ref: datasetRef });
  }

  closeEventDisplaySeries(datasetRef: string): Promise<CloseEventDisplaySeries> {
    return this.worker.request("analysis.close_event_display_series", { dataset_ref: datasetRef });
  }

  performanceMetrics(datasetRef: string): Promise<PerformanceMetrics> {
    return this.worker.request("analysis.performance_metrics", { dataset_ref: datasetRef });
  }

  rMultipleMetrics(datasetRef: string, source: "DECLARED" | "AVERAGE_LOSS", amount?: string): Promise<RMultipleMetrics> {
    return this.worker.request("analysis.r_multiple_metrics", source === "DECLARED" ? { dataset_ref: datasetRef, r_source: source, r_amount: amount } : { dataset_ref: datasetRef, r_source: source });
  }

  portfolioCombine(tracks: string[][], startingCapital: string, window: "UNION" | "COMMON"): Promise<PortfolioCombination> {
    return this.worker.request("portfolio.combine", { tracks, starting_capital: startingCapital, window }, LONG_RUNNING_MS);
  }

  /** Saves the setup only (never numbers); the Core recalculates on every list. */
  saveCombination(name: string, labels: string[], tracks: string[][], startingCapital: string, window: "UNION" | "COMMON"): Promise<SavedCombinationEntry> {
    return this.worker.request("portfolio.save_combination", { name, labels, tracks, starting_capital: startingCapital, window }, LONG_RUNNING_MS);
  }

  listSavedCombinations(): Promise<{ saved_version: string; entries: SavedCombinationEntry[] }> {
    return this.worker.request("portfolio.list_saved_combinations", {}, LONG_RUNNING_MS);
  }

  deleteSavedCombination(key: string): Promise<{ key: string; deleted: boolean }> {
    return this.worker.request("portfolio.delete_saved_combination", { key });
  }

  portfolioExplore(tracks: string[][], startingCapital: string, window: "UNION" | "COMMON"): Promise<PortfolioExploration> {
    return this.worker.request("portfolio.explore", { tracks, starting_capital: startingCapital, window }, LONG_RUNNING_MS);
  }

  paretoEvaluate(candidates: Array<{ id: string; values: Record<string, string | null> }>, objectives: Array<{ metric: string; direction: "MAX" | "MIN" }>): Promise<ParetoEvaluation> {
    return this.worker.request("analysis.pareto_evaluate", { candidates, objectives });
  }

  intakeParameterSchema(sourcePath: string): Promise<ParameterSchema> {
    return this.worker.request("exploration.intake_parameter_schema", { source_path: sourcePath });
  }

  createParameterStudy(optimisationRef: string, schemaRef: string | null): Promise<ParameterStudy> {
    return this.worker.request("exploration.create_study", schemaRef ? { optimisation_ref: optimisationRef, schema_ref: schemaRef } : { optimisation_ref: optimisationRef }, LONG_RUNNING_MS);
  }

  evaluateParameterStudy(studyRef: string, objectives: Objective[], constraints: Constraint[]): Promise<ParameterEvaluation> {
    return this.worker.request("exploration.evaluate", { study_ref: studyRef, objectives, constraints }, LONG_RUNNING_MS);
  }

  addSingleTest(studyRef: string, datasetRef: string): Promise<SingleTestAttachment> {
    return this.worker.request("exploration.add_single_test", { study_ref: studyRef, dataset_ref: datasetRef }, LONG_RUNNING_MS);
  }

  /** Join a forward MT5 optimisation (already intaken) to the study by parameter signature. */
  attachForward(studyRef: string, forwardOptimisationRef: string): Promise<ForwardAttachment> {
    return this.worker.request("exploration.attach_forward", { study_ref: studyRef, forward_optimisation_ref: forwardOptimisationRef }, LONG_RUNNING_MS);
  }

  renderParameterChoice(studyRef: string, objectives: Objective[], constraints: Constraint[], candidateId: string, reason: string, neighbourhood?: NeighbourhoodSettings): Promise<{ evaluation_id: string; candidate_id: string; markdown: string }> {
    return this.worker.request("exploration.render_choice", { study_ref: studyRef, objectives, constraints, candidate_id: candidateId, reason, ...(neighbourhood ? { neighbourhood } : {}) }, LONG_RUNNING_MS);
  }

  neighbourhood(studyRef: string, candidateId: string, objectives: Objective[], settings: NeighbourhoodSettings, sliceAxes: [string, string] | null, sliceMetric: string | null): Promise<NeighbourhoodResult> {
    return this.worker.request("exploration.neighbourhood", { study_ref: studyRef, candidate_id: candidateId, objectives, roles: settings.roles, radius: settings.radius, slice_axes: sliceAxes, slice_metric: sliceMetric }, LONG_RUNNING_MS);
  }

  renderNeighbourhoodSet(studyRef: string, candidateId: string, settings: NeighbourhoodSettings): Promise<NeighbourhoodSet> {
    return this.worker.request("exploration.render_neighbourhood_set", { study_ref: studyRef, candidate_id: candidateId, roles: settings.roles, radius: settings.radius }, LONG_RUNNING_MS);
  }

  /** The Core writes a new file only; it refuses to overwrite. */
  writeNeighbourhoodSet(studyRef: string, candidateId: string, settings: NeighbourhoodSettings, targetPath: string): Promise<NeighbourhoodSetWritten> {
    return this.worker.request("exploration.write_neighbourhood_set", { study_ref: studyRef, candidate_id: candidateId, roles: settings.roles, radius: settings.radius, target_path: targetPath }, LONG_RUNNING_MS);
  }

  attachNeighbourhoodRun(studyRef: string, optimisationRef: string): Promise<NeighbourhoodRunAttachment> {
    return this.worker.request("exploration.attach_neighbourhood_run", { study_ref: studyRef, optimisation_ref: optimisationRef }, LONG_RUNNING_MS);
  }

  reconstructLifecycles(datasetRef: string, accountMode: string): Promise<TradeAnalysisResult> {
    return this.worker.request("analysis.reconstruct_lifecycles", { dataset_ref: datasetRef, account_mode: accountMode });
  }

  realisedBalanceDailyDrawdown(datasetRef: string): Promise<DailyDrawdownResult> {
    return this.worker.request("analysis.realised_balance_daily_drawdown", { dataset_ref: datasetRef });
  }

  equityAvailability(datasetRef: string): Promise<EquityAvailabilityResult> {
    return this.worker.request("analysis.equity_availability", { dataset_ref: datasetRef });
  }

  preflightBatch(sourcePaths: string[]): Promise<PortfolioPreflightResult> {
    return this.worker.request("portfolio.preflight_mt5_excel_batch", { source_paths: sourcePaths }, LONG_RUNNING_MS);
  }

  createCombinedRealisedBalance(sourcePaths: string[]): Promise<CombinedBalanceResult> {
    return this.worker.request("portfolio.create_combined_realised_balance", { source_paths: sourcePaths }, LONG_RUNNING_MS);
  }

  combinedDailyDrawdown(sourcePaths: string[]): Promise<CombinedDailyResult> {
    return this.worker.request("portfolio.combined_daily_drawdown", { source_paths: sourcePaths }, LONG_RUNNING_MS);
  }

  fixedCostScenario(datasetRef: string, additionalCost: string): Promise<FixedCostScenarioResult> {
    return this.worker.request("scenario.fixed_close_event_cost", { dataset_ref: datasetRef, additional_cost_per_close_event: additionalCost });
  }

  monteCarloOrderPermutation(datasetRef: string, seed: string, pathCount: number): Promise<MonteCarloResult> {
    return this.worker.request("scenario.monte_carlo_order_permutation", { dataset_ref: datasetRef, seed, path_count: pathCount }, LONG_RUNNING_MS);
  }

  intakeOptimisationGrid(sourcePath: string, modellingMode: string): Promise<OptimisationGridResult> {
    return this.worker.request("optimisation.intake_parameter_grid", { source_path: sourcePath, modelling_mode: modellingMode }, LONG_RUNNING_MS);
  }

  intakePairedForwardGrid(request: PairedForwardRequest): Promise<PairedForwardResult> {
    return this.worker.request("optimisation.intake_paired_forward_grid", { ...request }, LONG_RUNNING_MS);
  }

  prepareReportPayload(datasetRef: string, analysisRunId: string, reportId: string): Promise<ReportPayload> {
    return this.worker.request("report.prepare_payload", { dataset_ref: datasetRef, analysis_run_id: analysisRunId, report_id: reportId });
  }

  commitReportRevision(payload: ReportPayload, revision: number, priorConfigurationHash: string | null): Promise<unknown> {
    return this.worker.request("report.commit_revision_manifest", { payload, report_revision: revision, prior_configuration_hash: priorConfigurationHash });
  }
}
