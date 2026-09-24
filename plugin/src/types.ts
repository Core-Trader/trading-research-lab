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
  /** Companion evidence recorded on the registry entry. */
  source_checks?: string[];
  equity?: EquityEvidence;
  set_check?: { schema_ref: string; set_filename: string; status: "MATCH" | "DIFFERS"; compared: number; difference_count: number };
  archived?: boolean;
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

export type EquityEvidence = { log_sha256: string; status: "LINKED_VERIFIED"; equity_source: "MT5_TESTER_LOGGED"; modelling_mode: string; row_count: number; maximum_equity_drawdown: string; mt5_reported_equity_drawdown: string | null; interval: string | null; findings: string[] };
export type EquityAvailabilityResult =
  | { dataset_ref: string; status: "UNAVAILABLE"; basis: "INTRATRADE_EQUITY"; reason: string; required_evidence: string; warnings: string[] }
  | { dataset_ref: string; status: "AVAILABLE"; basis: "INTRATRADE_EQUITY"; source: "MT5_TESTER_LOGGED"; equity: EquityEvidence; warnings: string[] };
export type EquityLogAttachment = { dataset_ref: string; status: "LINKED_VERIFIED" | "BLOCKED"; findings: Array<{ severity: "BLOCKED" | "WARNING" | "NOTE"; code: string; message: string }>; maximum_equity_drawdown: string; mt5_reported_equity_drawdown: string | null; row_count: number };
export type EquityMetrics = {
  dataset_ref: string;
  calculation_version: string;
  initial_balance: string;
  maximum_equity_drawdown: string;
  maximum_equity_drawdown_percent: string | null;
  balance_maximum_drawdown: string;
  equity_to_balance_drawdown_ratio: string | null;
  equity_deeper_than_balance: boolean;
  worst_day: { date: string; start_of_day_reference: string; lowest_equity: string; lowest_at: string; loss: string; loss_percent_of_initial: string | null };
  daily: Array<{ date: string; loss: string; loss_percent_of_initial: string | null }>;
  row_count: number;
  display_series: Array<{ time: string; balance: string; equity_close: string; equity_min: string; equity_max: string }>;
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
  historical: { maximum_drawdown: string; rank_percent: string; vs_median: "DEEPER" | "SHALLOWER" | "EQUAL" };
  fan_bands: { p05: string[]; p50: string[]; p95: string[]; event_indices: number[]; widest_band: string; widest_at_event: number };
  account: { opening_balance: string | null; p50_percent_of_opening: string | null; p95_percent_of_opening: string | null };
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

export type DatasetDeletionPreview = { dataset_ref: string; dataset_id: string | null; original_filename: string; archived: boolean; bytes: number; dependents: Array<{ kind: "SAVED_COMBINATION" | "PARAMETER_STUDY_SINGLE_TEST" | "SEQUENTIAL_BATCH" | "REPORT_REVISIONS"; name: string }>; notes: string[] };
export type DatasetDeletionResult = { dataset_ref: string; dataset_id: string | null; dependents_mode: "DELETE" | "KEEP"; dependents: Array<{ kind: string; name: string }>; kept_dependents: Array<{ kind: string; name: string }>; removed: string[]; deleted_at_utc: string };
/** A .set compared with the inputs the report actually ran with (playbook §3.2). */
export type SetCheckResult = { dataset_ref: string; schema_ref: string; set_filename: string; status: "MATCH" | "DIFFERS"; compared: number; differences: Array<{ name: string; report_value: string; set_value: string }>; only_in_set: string[]; only_in_report: string[]; notes: string[] };
export type DatasetArchiveResult = { dataset_ref: string; archived: boolean; used_by: Array<{ kind: "SAVED_COMBINATION" | "PARAMETER_STUDY_SINGLE_TEST"; name: string }> };
/** A saved combination setup; its result is always recalculated by the Core. */
export type SavedCombinationEntry = {
  saved: { key: string; name: string; labels: string[]; tracks: string[][]; starting_capital: string; window: "UNION" | "COMMON"; day_boundary: string; saved_calculation_version: string; saved_version: string };
  combination: PortfolioCombination | null;
  error: { code: string; message: string } | null;
  recalculated: boolean;
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
/** Core frontier steps for one gain (MAX) and one cost (MIN) objective. */
export type FrontierSteps = { gain_metric: string; cost_metric: string; points: string[]; steps: Array<{ from_id: string; to_id: string; step_gain: string; step_cost: string; ratio: string | null; diminishing: boolean | null }> };
export type ParetoEvaluation = {
  calculation_version: string;
  configuration_hash: string;
  candidate_count: number;
  counts: Record<ParetoStatus, number>;
  front_count: number;
  frontier_steps?: FrontierSteps | null;
  candidates: ParetoCandidateResult[];
};

export type PortfolioExploration = {
  calculation_version: string;
  configuration_hash: string;
  currency: string | null;
  subset_count: number;
  counts: Record<ParetoStatus, number>;
  front_count: number;
  frontier_steps?: FrontierSteps | null;
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
export type NeighbourhoodRole = "ORDINAL" | "CATEGORICAL" | "HELD_FIXED";
export type NeighbourhoodSettings = { roles: Record<string, NeighbourhoodRole>; radius: 1 | 2 };
export type NeighbourPoint = { id: string; label: string; source: "OPTIMISATION" | "SINGLE_TEST" | "NEIGHBOURHOOD_RUN"; distance: number; differs: Record<string, string>; metrics: Record<string, string | null>; forward: { pass: string | null; metrics: Record<string, string | null> } | null };
export type NeighbourhoodStatistic = { direction: "MAX" | "MIN"; count: number; median?: string; q1?: string; q3?: string; iqr?: string; candidate_value?: string | null; candidate_better_than?: number | null; best_neighbour?: string; margin_over_best?: string | null };
export type NeighbourhoodSlice = { axes: [string, string]; metric: string; x_values: string[]; y_values: string[]; cells: Array<Array<{ value: string | null; tested: boolean; id: string | null; is_candidate: boolean }>>; windowed: boolean };
/** Neighbourhood of one candidate (PARAMETER_NEIGHBOURHOOD_SPEC.md); every value is Core output. */
export type NeighbourhoodResult = {
  neighbourhood_id: string;
  calculation_version: string;
  configuration_hash: string;
  candidate: { id: string; label: string; source: string; parameters: Record<string, string>; metrics: Record<string, string | null> };
  roles: Record<string, NeighbourhoodRole>;
  radius: number;
  coverage: { possible: number; tested: number; minimum_for_statistics: number; sufficient: boolean; by_source: Record<string, number>; held_equal: string[] };
  boundaries: Array<{ name: string; steps_below: number; steps_above: number }>;
  neighbours: NeighbourPoint[];
  nearest: NeighbourPoint[];
  statistics: Record<string, NeighbourhoodStatistic> | null;
  context: { profit_positive_share: string | null; worst_equity_drawdown_pct: string | null } | null;
  isolated_peak: { assessed: boolean; flag: boolean; rule: string } | null;
  slice: NeighbourhoodSlice | null;
  warnings: string[];
};
export type NeighbourhoodSet = { box_id: string; runs: number; varied: Record<string, { start: string; step: string; stop: string }>; fixed: Record<string, string>; set_text: string; suggested_filename: string };
export type NeighbourhoodSetWritten = { box_id: string; runs: number; path: string; bytes: number; sha256: string; filename: string };
export type NeighbourhoodRunAttachment = { optimisation_ref: string; box_id: string | null; candidate_id: string | null; run_count: number; findings: StudyFinding[]; status: "READY" | "BLOCKED" };
/** Forward (out-of-sample) MT5 optimisation joined to a study by parameter signature. */
export type ForwardSummary = {
  forward_optimisation_ref: string;
  forward_title: string | null;
  /** From the two export titles, or MT5's built-in forward split (whole range only; the split date is not exported). */
  period: { in_sample: [string, string]; forward: [string, string]; source: "MT5_TITLE" } | { in_sample: null; forward: null; whole_range: [string, string]; source: "MT5_BUILT_IN_FORWARD" } | null;
  metrics: StudyMetric[];
  matched_count: number;
  in_sample_only_count: number;
  forward_only_count: number;
  findings: StudyFinding[];
};
export type ForwardAttachment = ForwardSummary & { status: "READY" | "BLOCKED" };
export type SingleTestAttachment = { dataset_ref: string; candidate_id: string; label: string; parameters: Record<string, string>; metrics: Record<string, string | null>; is_default: boolean; findings: StudyFinding[]; status: "READY" | "BLOCKED"; notes: string[] };

/** Prop-firm rule check (PROP_FIRM_SPEC.md). All values are Core strings. */
export type PropLimit = { kind: "AMOUNT" | "PERCENT"; value: string };
export type PropReset = { kind: "REPORT_CLOCK_MIDNIGHT" } | { kind: "FIRM_RESET"; time: string; zone: string };
export type PropRules = {
  name: string;
  account_size: string;
  daily_loss_limit: PropLimit | null;
  daily_loss_basis: "INITIAL_BALANCE" | "START_OF_DAY_REFERENCE";
  start_of_day_reference: "BALANCE" | "HIGHER_OF_BALANCE_AND_EQUITY" | "EQUITY";
  overall_loss_limit: PropLimit | null;
  overall_loss_mode: "FIXED" | "TRAILING" | "TRAILING_LOCKS_AT_START";
  trailing_reference: "BALANCE_HIGH" | "EQUITY_HIGH" | "END_OF_DAY_BALANCE_HIGH" | null;
  profit_target: PropLimit | null;
  minimum_trading_days: number | null;
  maximum_calendar_days: number | null;
  reset: PropReset;
  breach_on: "EQUITY_TOUCH" | "BALANCE_CLOSE";
};
export type PropProfile = { profile_version: string; profile_id: string; profile_hash: string; saved_at: string; supersedes: string | null; values_source: string; rules: PropRules };
export type PropVerdict = "BROKEN" | "POSSIBLY_BROKEN" | "NOT_BROKEN";
export type PropEvidenceLevel = "EQUITY_LOGGED" | "PORTFOLIO_CONSERVATIVE" | "REALISED_ONLY";
export type PropBreach = { time: string; day: string; value: string; limit_level: string; limit: string; loss?: string };
export type PropTightest = { date?: string; time: string | null; headroom: string; headroom_percent_of_limit: string; loss?: string; limit?: string; floor?: string };
export type PropRuleResult = {
  rule: "DAILY_LOSS" | "OVERALL_LOSS";
  verdict: PropVerdict;
  limit: PropLimit;
  basis?: string;
  limit_amount?: string;
  mode?: string;
  trailing_reference?: string | null;
  first_breach: PropBreach | null;
  tightest: PropTightest | null;
  optimistic?: { first_breach: PropBreach | null; tightest: PropTightest | null };
};
export type PropDailyRow = { date: string; reference: string; lowest: string; lowest_at: string | null; loss: string; limit: string; headroom: string; headroom_percent_of_limit: string; broken: boolean };
export type PropChallengeOutcome = "PASSED" | "TARGET_NOT_REACHED" | "MINIMUM_DAYS_NOT_REACHED" | "TOO_SLOW" | "BROKEN_BEFORE_PASS" | "POSSIBLY_BROKEN_BEFORE_PASS";
export type PropEvaluation = {
  calculation_version: string;
  profile: { profile_id: string; profile_hash: string; name: string; saved_at: string; values_source: string; rules: PropRules };
  target: { kind: "DATASET"; dataset_ref: string } | { kind: "COMBINATION"; combination_id: string; tracks: string[][]; starting_capital: string };
  currency: string | null;
  evidence_level: PropEvidenceLevel;
  day_boundary: { version: string; kind: string; time?: string; zone?: string; report_clock_zone: string | null; day_label: string };
  account_size: string;
  verdict: PropVerdict;
  rules: PropRuleResult[];
  profit_target: { target: PropLimit; amount: string; level: string; reached: boolean; time: string | null; day: string | null; trading_days: number | null; calendar_days: number | null; basis: string } | null;
  trading_days: { total: number; definition: string };
  challenge: {
    outcome: PropChallengeOutcome;
    pass_time: string | null;
    minimum_trading_days: { required: number | null; total: number; met: boolean };
    maximum_calendar_days: { allowed: number | null; days_to_pass: number | null; met: boolean | null };
  } | null;
  daily: PropDailyRow[];
  series: Array<{ time: string; balance: string; equity: string; low: string; floor: string | null }>;
  breach_markers: Array<{ rule: string; time: string }>;
  findings: Array<{ severity: string; code: string; message: string }>;
  warnings: string[];
};
export type PropTarget = { kind: "DATASET"; dataset_ref: string } | { kind: "COMBINATION"; tracks: string[][]; starting_capital?: string };
