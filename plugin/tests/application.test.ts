import assert from "node:assert/strict";
import test from "node:test";
import { LatestRun } from "../src/application/latest-run.ts";
import { ResearchService, type WorkerTransport } from "../src/application/research-service.ts";

function recordingWorker(): { worker: WorkerTransport; calls: Array<{ method: string; params: Record<string, unknown>; timeoutMs?: number }> } {
  const calls: Array<{ method: string; params: Record<string, unknown>; timeoutMs?: number }> = [];
  return {
    calls,
    worker: {
      request<T>(method: string, params: Record<string, unknown>, timeoutMs?: number): Promise<T> {
        calls.push({ method, params, timeoutMs });
        return Promise.resolve({} as T);
      },
    },
  };
}

test("service maps application calls to the versioned worker method names and params", async () => {
  const { worker, calls } = recordingWorker();
  const service = new ResearchService(worker);
  await service.intakeMt5Excel("C:\\reports\\a.xlsx");
  await service.basicStatistics("ds-1");
  await service.closeEventSummary("ds-1");
  await service.reconstructLifecycles("ds-1", "HEDGING");
  await service.realisedBalanceDailyDrawdown("ds-1");
  await service.equityAvailability("ds-1");
  await service.fixedCostScenario("ds-1", "0.50");
  await service.monteCarloOrderPermutation("ds-1", "20260921", 1000);
  await service.verifyRawSnapshot("ds-1");
  await service.closeEventDisplaySeries("ds-1");
  await service.performanceMetrics("ds-1");
  await service.prepareReportPayload("ds-1", "run-1", "report-1");
  assert.deepEqual(calls.map((call) => call.method), [
    "dataset.intake_mt5_excel",
    "analysis.basic_statistics",
    "analysis.close_event_summary",
    "analysis.reconstruct_lifecycles",
    "analysis.realised_balance_daily_drawdown",
    "analysis.equity_availability",
    "scenario.fixed_close_event_cost",
    "scenario.monte_carlo_order_permutation",
    "dataset.verify_raw_snapshot",
    "analysis.close_event_display_series",
    "analysis.performance_metrics",
    "report.prepare_payload",
  ]);
  assert.deepEqual(calls[0]?.params, { source_path: "C:\\reports\\a.xlsx" });
  assert.deepEqual(calls[3]?.params, { dataset_ref: "ds-1", account_mode: "HEDGING" });
  assert.deepEqual(calls[6]?.params, { dataset_ref: "ds-1", additional_cost_per_close_event: "0.50" });
  // The seed stays a string so large seeds are never rounded by JavaScript numbers.
  assert.deepEqual(calls[7]?.params, { dataset_ref: "ds-1", seed: "20260921", path_count: 1000 });
  assert.equal(calls[7]?.timeoutMs, 60_000);
  assert.deepEqual(calls[9]?.params, { dataset_ref: "ds-1" });
  assert.deepEqual(calls[10]?.params, { dataset_ref: "ds-1" });
  assert.deepEqual(calls[11]?.params, { dataset_ref: "ds-1", analysis_run_id: "run-1", report_id: "report-1" });
});

test("R-multiple requests send an amount only for a declared 1R", async () => {
  const { worker, calls } = recordingWorker();
  const service = new ResearchService(worker);
  await service.rMultipleMetrics("ds-1", "AVERAGE_LOSS");
  await service.rMultipleMetrics("ds-1", "DECLARED", "100");
  assert.deepEqual(calls.map((call) => call.method), ["analysis.r_multiple_metrics", "analysis.r_multiple_metrics"]);
  assert.deepEqual(calls[0]?.params, { dataset_ref: "ds-1", r_source: "AVERAGE_LOSS" });
  assert.deepEqual(calls[1]?.params, { dataset_ref: "ds-1", r_source: "DECLARED", r_amount: "100" });
});

test("latest run rejects results from a superseded run", () => {
  const runs = new LatestRun();
  const first = runs.begin();
  assert.equal(runs.isCurrent(first), true);
  const second = runs.begin();
  assert.equal(runs.isCurrent(first), false);
  assert.equal(runs.isCurrent(second), true);
});
