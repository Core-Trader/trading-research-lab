export type WorkerSuccess<T> = {
  protocol: 1;
  request_id: string;
  success: true;
  engine_version: string;
  result: T;
};

export type WorkerFailure = {
  protocol: 1;
  request_id: string | null;
  success: false;
  engine_version: string;
  error: { code: string; message: string; details: Record<string, unknown> };
};

export type WorkerResponse<T> = WorkerSuccess<T> | WorkerFailure;

export type ImportResult = {
  dataset_ref: string;
  dataset_id: string;
  source_import_id: string;
  event_count: number;
  source: { filename: string; sha256: string; byte_count: number; worksheet_name: string };
};

export type DatasetEvidence = {
  dataset_ref: string;
  dataset_id: string;
  source_import_id: string;
  source_sha256: string;
  original_filename: string;
  raw_snapshot_path: string;
  raw_snapshot_status: string;
  byte_count: number;
  event_count: number;
  source_quality: string;
  warnings: string[];
  adapter: { adapter_id: string; adapter_version: string; intake_mode: string };
  core_version: string;
  canonical_schema_version: string;
  supplied_facts: { symbol: string | null; currency: string | null; period: string | null; initial_deposit: string | null; leverage: string | null };
  source_layout: { worksheet_name: string; section_name: string; adapter_schema_version: string };
  observed_price_scales: number[];
  artifacts: { events: string; manifest: string };
  limitations: string[];
};

export type IntakeResult = ImportResult & { intake_receipt: DatasetEvidence; intake_status: string };

export type StatisticsResult = {
  analysis_run_id: string;
  dataset_ref: string;
  dataset_id: string;
  source_import_id: string;
  core_version: string;
  calculation_version: string;
  currency: string | null;
  opening_balance: string;
  final_reported_balance: string;
  reported_balance_change: string;
  closed_position_event_count: number;
  balance_curve: { status: "VERIFIED"; points: Array<{ source_sequence: number; timestamp: string; balance: string }> };
  equity_curve: { status: "UNAVAILABLE"; reason: string; points: [] };
  limitations: string[];
};

export type MarkdownResult = {
  dataset_ref: string;
  dataset_id: string;
  source_import_id: string;
  analysis_run_id: string;
  core_version: string;
  markdown: string;
};

export type TradeMetrics = {
  count: number;
  net_pnl: string;
  gross_profit: string;
  gross_loss: string;
  win_count: number;
  loss_count: number;
  breakeven_count: number;
  win_rate: string | null;
  loss_rate: string | null;
  breakeven_rate: string | null;
};

export type TradeAnalysisResult = {
  analysis_id: string;
  analysis_basis: "VERIFIED_CLOSE_EVENTS" | "INFERRED_LIFECYCLES";
  calculation_version: string;
  dataset_ref: string;
  currency: string | null;
  eligible?: boolean;
  policy?: {
    policy_id: string;
    account_mode: string;
    account_mode_source: "USER_SUPPLIED";
    matching: string;
    partial_economics: string;
  };
  policy_configuration_hash?: string;
  summary: TradeMetrics;
  quality_counts: Record<"MT5_VERIFIED" | "INFERRED" | "UNPAIRED" | "AMBIGUOUS", number>;
  warnings: string[];
  artifacts: { table: string; manifest: string; table_sha256: string; manifest_sha256: string };
};

export type DailyDrawdownResult = {
  analysis_id: string;
  analysis_basis: "REALISED_BALANCE_ONLY";
  calculation_version: string;
  dataset_ref: string;
  currency: string | null;
  time_basis: "SOURCE_REPORTED_CLOCK";
  policy_id: string;
  configuration_hash: string;
  daily_row_count: number;
  worst_day: {
    date: string;
    daily_reference_balance: string;
    daily_closing_balance: string;
    daily_high_water_balance: string;
    maximum_drawdown: string;
    maximum_drawdown_percent: string | null;
    source_point_count: number;
    coverage: string;
  };
  warnings: string[];
  artifacts: { table: string; manifest: string; table_sha256: string; manifest_sha256: string };
};

export type EquityAvailabilityResult = {
  dataset_ref: string;
  status: "UNAVAILABLE";
  basis: "INTRATRADE_EQUITY";
  reason: string;
  required_evidence: string;
  warnings: string[];
};

export type PortfolioPreflightResult = {
  preflight_id: string;
  calculation_version: string;
  account_declaration: "USER_SUPPLIED_SINGLE_ACCOUNT";
  status: "ELIGIBLE" | "BLOCKED";
  members: Array<{ dataset_ref: string; dataset_id: string; source_sha256: string; filename: string; currency: string | null; first_timestamp: string; last_timestamp: string; opening_balance: string; final_reported_balance: string; event_count: number }>;
  findings: Array<{ severity: "BLOCKED" | "WARNING"; code: string; message: string; members?: Array<{ dataset_ref: string; filename: string }> }>;
  writes: "INDIVIDUAL_M1_INTAKE_ONLY; NO_COMBINED_ARTIFACT";
};

export type CombinedBalanceResult = { batch_id: string; status: "CREATED"; analysis_basis: "COMBINED_REALISED_BALANCE"; currency: string | null; row_count: number; opening_balance: string; final_reported_balance: string; reported_balance_change: string; balance_points: Array<{ timestamp: string; balance: string }>; artifacts: { table: string; manifest: string; table_sha256: string } };
export type CombinedDailyResult = { currency: string | null; time_basis: string; worst_day: { date: string; maximum_drawdown: string; maximum_drawdown_percent: string | null }; warnings: string[] };

export type WhatIfScenarioMetrics = {
  count: number;
  net_pnl: string;
  gross_profit: string;
  gross_loss: string;
  win_count: number;
  loss_count: number;
  breakeven_count: number;
};

export type FixedCostScenarioResult = {
  analysis_id: string;
  analysis_basis: "MT5_VERIFIED_CLOSE_EVENTS";
  policy_id: "what-if-fixed-close-event-cost-v1";
  calculation_version: string;
  dataset_ref: string;
  currency: string;
  configuration: {
    input_artifact: string;
    input_basis: "MT5_VERIFIED_CLOSE_EVENTS";
    additional_cost_per_close_event: string;
    event_selection: string;
  };
  configuration_hash: string;
  source_summary: WhatIfScenarioMetrics;
  scenario_summary: WhatIfScenarioMetrics;
  net_pnl_delta: string;
  warnings: string[];
  artifacts: { table: string; manifest: string; table_sha256: string; manifest_sha256: string };
};

export type MonteCarloResult = {
  analysis_id: string;
  analysis_basis: "MT5_VERIFIED_CLOSE_EVENTS";
  policy_id: "monte-carlo-close-event-order-permutation-v1";
  calculation_version: string;
  dataset_ref: string;
  currency: string;
  configuration: {
    seed: string;
    path_count: number;
    prng: "PCG32-v1";
    sampling_method: "ORDER_PERMUTATION_WITHOUT_REPLACEMENT";
    input_artifact: string;
  };
  configuration_hash: string;
  population_count: number;
  source_total_close_event_pnl: string;
  invariant_final_pnl: string;
  drawdown_summary: { minimum: string; p05: string; p50: string; p95: string; maximum: string };
  drawdown_histogram: {
    binning: "EQUAL_WIDTH_V1";
    bin_count: number;
    buckets: Array<{ lower_bound: string; upper_bound: string; count: number }>;
  };
  drawdown_percentiles: Array<{ percentile: string; maximum_drawdown: string }>;
  path_fan: {
    sampling: "EVEN_INDEX_SAMPLE_V1";
    point_count: number;
    event_indices: number[];
    historical: string[];
    paths: Array<{ path_index: number; values: string[] }>;
  };
  least_drawdown_path: { path_index: number; maximum_drawdown: string };
  worst_drawdown_path: { path_index: number; maximum_drawdown: string };
  warnings: string[];
  artifacts: { table: string; manifest: string; table_sha256: string; manifest_sha256: string };
};

export type OptimisationGridResult = {
  optimisation_ref: string;
  optimisation_id: string;
  intake_status: string;
  table_type: "PARAMETER_GRID_IN_SAMPLE_OR_UNDECLARED";
  source: { filename: string; sha256: string; byte_count: number; raw_snapshot_path: string };
  adapter: { modelling_mode: string; modelling_mode_source: "USER_SUPPLIED" };
  report_metadata: Record<string, string>;
  headers: string[];
  parameter_columns: string[];
  metric_columns: string[];
  pass_count: number;
  rows: Array<Record<string, string>>;
  warnings: string[];
  artifacts: { table: string; manifest: string };
};

export type PairedForwardResult = {
  pair_ref: string;
  pair_count: number;
  parameter_columns: string[];
  metric_columns: string[];
  context: { in_sample_start: string; in_sample_end: string; forward_start: string; forward_end: string; modelling_mode: string; modelling_mode_source: "USER_SUPPLIED" };
  in_sample_source: { filename: string; sha256: string };
  forward_source: { filename: string; sha256: string };
  rows: Array<Record<string, string>>;
  warnings: string[];
  artifacts: { table: string; manifest: string };
};

export type PeriodPnl = { net_pnl: string; close_event_count: number; win_count: number; loss_count: number };

export type CloseEventDisplaySeries = {
  analysis_basis: "VERIFIED_CLOSE_EVENTS";
  policy_id: string;
  calculation_version: string;
  dataset_ref: string;
  currency: string | null;
  time_basis: "SOURCE_REPORTED_CLOCK";
  configuration_hash: string;
  close_event_count: number;
  events: Array<{ source_sequence: number; timestamp: string; symbol: string; net_pnl: string }> | null;
  events_omitted_reason: string | null;
  daily: Array<PeriodPnl & { date: string }>;
  weekly: Array<PeriodPnl & { iso_year: number; iso_week: number }>;
  monthly: Array<PeriodPnl & { month: string }>;
  yearly: Array<PeriodPnl & { year: number }>;
  warnings: string[];
};

export type BalancePointRef = { source_sequence: number; timestamp: string; balance: string };
export type StagnationPeriod = {
  start: BalancePointRef;
  end: BalancePointRef;
  status: "ONGOING" | "ENDED_BY_NEW_HIGH";
  duration_seconds: number;
  duration_days: string;
  share_of_report_period_percent: string | null;
  close_events: number;
};
export type Streak = { count: number; net_pnl: string | null; first_source_sequence: number | null; last_source_sequence: number | null };

export type PerformanceMetrics = {
  analysis_basis: string;
  policy_id: string;
  calculation_version: string;
  dataset_ref: string;
  currency: string | null;
  time_basis: "SOURCE_REPORTED_CLOCK";
  configuration_hash: string;
  balance_metrics: {
    opening_balance: string;
    final_balance: string;
    balance_change: string;
    maximum_drawdown: string;
    maximum_drawdown_percent: string | null;
    peak: BalancePointRef | null;
    trough: BalancePointRef | null;
    recovery: BalancePointRef | null;
    recovery_status: "RECOVERED" | "NOT_RECOVERED" | null;
    return_to_drawdown: string | null;
    return_to_drawdown_reason: "NO_DRAWDOWN" | null;
  };
  drawdown_series: Array<{ source_sequence: number; timestamp: string; drawdown: string; drawdown_percent: string | null }>;
  stagnation: { period_count: number; longest_by_time: StagnationPeriod; longest_by_close_events: StagnationPeriod; ongoing: StagnationPeriod };
  close_event_metrics: {
    close_event_count: number;
    net_pnl: string;
    gross_profit: string;
    gross_loss: string;
    profit_factor: string | null;
    profit_factor_reason: "NO_LOSSES" | "NO_CLOSE_EVENTS" | null;
    average_win: string | null;
    average_loss: string | null;
    payoff_ratio: string | null;
    expectancy: string | null;
    standard_deviation: string | null;
    sqn: string | null;
    sqn_capped_100: string | null;
    longest_winning_streak: Streak;
    longest_losing_streak: Streak;
  };
  warnings: string[];
};

export type RMultipleMetrics = {
  analysis_basis: string;
  calculation_version: string;
  dataset_ref: string;
  currency: string | null;
  one_r: string;
  r_quality: "USER_SUPPLIED" | "INFERRED";
  close_event_count: number;
  expectancy_r: string | null;
  standard_deviation_r: string | null;
  sqn: string | null;
  sqn_capped_100: string | null;
  largest_win_r: string | null;
  largest_loss_r: string | null;
  opportunity_per_30_days: string | null;
  expectunity_r_per_30_days: string | null;
  top_events_share_percent: { value: string | null; reason: "NON_POSITIVE_NET" | null; event_count: number };
  histogram: { binning: "FIXED_HALF_R_V1"; underflow_count: number; overflow_count: number; buckets: Array<{ lower_r: string; upper_r: string; count: number }> };
  warnings: string[];
};

export type PortfolioTrackResult = {
  track_id: string;
  index: number;
  dataset_refs: string[];
  filenames: string[];
  currency: string | null;
  active_start: string;
  active_end: string;
  close_events_in_window: number;
  net_pnl: string;
  share_of_combined_net_percent: string | null;
  standalone_maximum_drawdown: string;
  standalone_metrics: PerformanceMetrics["close_event_metrics"] & { maximum_drawdown_percent: string | null; return_to_drawdown: string | null };
};

export type PortfolioCombination = {
  combination_id: string;
  calculation_version: string;
  analysis_basis: string;
  configuration: { track_ids: string[]; starting_capital: string; starting_capital_source: "USER_SUPPLIED"; window: "UNION" | "COMMON"; day_boundary: string; sizing: "AS_REPORTED" };
  currency: string | null;
  window_start: string;
  window_end: string;
  close_event_count: number;
  net_pnl: string;
  combined_balance: Array<{ index: number; timestamp: string; balance: string; track_index: number | null }>;
  metrics: Pick<PerformanceMetrics, "balance_metrics" | "stagnation" | "close_event_metrics">;
  drawdown_series: PerformanceMetrics["drawdown_series"];
  tracks: PortfolioTrackResult[];
  drawdown_overlap: { combined_maximum_drawdown: string; sum_of_standalone_maximum_drawdowns: string; offset: string };
  correlation: Array<{ left_index: number; right_index: number; days: number; pearson: string | null; reason: string | null }>;
  daily: Array<{ date: string; net_pnl: string; close_event_count: number }>;
  active_tracks: Array<{ index: number; track_id: string; start: string; end: string }>;
  warnings: string[];
};

export type ParetoStatus = "PARETO" | "DOMINATED" | "CONSTRAINED" | "INCOMPLETE";
export type ParetoCandidateResult = {
  id: string;
  status: ParetoStatus;
  rank: number | null;
  dominated_by_count: number;
  dominated_by_example: string | null;
  violations: Array<{ metric: string; operator: string; threshold: string; value: string | null; reason: "NOT_SATISFIED" | "MISSING_VALUE" }>;
};
export type ParetoEvaluation = {
  calculation_version: string;
  configuration_hash: string;
  candidate_count: number;
  counts: Record<ParetoStatus, number>;
  front_count: number;
  candidates: ParetoCandidateResult[];
};

export type PortfolioExploration = {
  calculation_version: string;
  configuration_hash: string;
  currency: string | null;
  subset_count: number;
  counts: Record<ParetoStatus, number>;
  front_count: number;
  subsets: Array<{
    id: string;
    members: number[];
    track_ids: string[];
    window_start: string | null;
    window_end: string | null;
    reason: "NO_COMMON_WINDOW" | null;
    net_pnl: string | null;
    maximum_drawdown: string | null;
    maximum_drawdown_percent: string | null;
    return_to_drawdown: string | null;
    close_event_count: string | null;
    pareto: Omit<ParetoCandidateResult, "id">;
  }>;
  warnings: string[];
};

export type StudyMetric = { id: string; column: string; label: string; default_direction: "MAX" | "MIN" | null; unit: string; basis: "MT5_REPORTED" };
export type StudyParameter = { name: string; kind: string; ordinal: boolean | null; in_schema: boolean | null; tested_values: string[]; default?: string; start?: string | null; step?: string | null; stop?: string | null; value_count?: number | null };
export type StudyFinding = { severity: "BLOCKED" | "WARNING" | "NOTE"; code: string; message: string; subjects: string[] };
export type ParameterSchema = { schema_ref: string; source: { filename: string; sha256: string; encoding: string }; parameter_count: number; optimised_parameters: string[]; full_grid_size: string | null; intake_status: string };
export type ParameterStudy = {
  study_ref: string;
  status: "READY" | "BLOCKED";
  optimisation_ref: string;
  schema_ref: string | null;
  context: { title: string | null; deposit: string | null; modelling_mode: string | null; source_filename: string | null };
  pass_count: number;
  full_grid_size: string | null;
  parameters: StudyParameter[];
  metrics: StudyMetric[];
  default: { signature: Record<string, string> | null; pass_id: string | null; status: "IN_OPTIMISATION" | "NOT_TESTED" | "NO_SCHEMA" | "SINGLE_TEST" };
  findings: StudyFinding[];
};
export type Objective = { metric: string; direction: "MAX" | "MIN" };
export type Constraint = { metric: string; operator: ">=" | "<="; threshold: string };
export type ParameterEvaluation = {
  evaluation_id: string;
  configuration_hash: string;
  study: Pick<ParameterStudy, "study_ref" | "context" | "pass_count" | "full_grid_size" | "parameters" | "metrics" | "default" | "findings">;
  counts: Record<ParetoStatus, number>;
  front_count: number;
  forward?: ForwardSummary | null;
  single_tests?: Array<{ candidate_id: string; label: string; is_default: boolean; findings: StudyFinding[]; notes: string[] }>;
  candidates: Array<{ id: string; pass: string | null; label?: string; source?: "OPTIMISATION" | "SINGLE_TEST"; parameters: Record<string, string>; metrics: Record<string, string | null>; is_default: boolean; forward?: { pass: string | null; metrics: Record<string, string | null> } | null; pareto: Omit<ParetoCandidateResult, "id"> }>;
  warnings: string[];
};
/** Forward (out-of-sample) MT5 optimisation joined to a study by parameter signature. */
export type ForwardSummary = {
  forward_optimisation_ref: string;
  forward_title: string | null;
  period: { in_sample: [string, string]; forward: [string, string]; source: "MT5_TITLE" } | null;
  metrics: StudyMetric[];
  matched_count: number;
  in_sample_only_count: number;
  forward_only_count: number;
  findings: StudyFinding[];
};
export type ForwardAttachment = ForwardSummary & { status: "READY" | "BLOCKED" };
export type SingleTestAttachment = { dataset_ref: string; candidate_id: string; label: string; parameters: Record<string, string>; metrics: Record<string, string | null>; is_default: boolean; findings: StudyFinding[]; status: "READY" | "BLOCKED"; notes: string[] };
