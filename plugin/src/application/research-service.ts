import type { CloseEventDisplaySeries, PerformanceMetrics, RMultipleMetrics, CombinedBalanceResult, CombinedDailyResult, DailyDrawdownResult, DatasetEvidence, EquityAvailabilityResult, FixedCostScenarioResult, IntakeResult, MonteCarloResult, OptimisationGridResult, PairedForwardResult, PortfolioPreflightResult, StatisticsResult, TradeAnalysisResult } from "../types";
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
