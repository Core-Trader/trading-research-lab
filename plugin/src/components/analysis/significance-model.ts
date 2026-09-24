import type { SignificanceResult } from "../../types.ts";
import type { WorkflowPoint } from "../help/research-workflow.ts";
import { belowMinimum } from "../../application/research-settings.ts";

/**
 * How to read the significance check, and what to do next (G1–G5). Every point
 * carries the Research workflow's labels: S = sourced (with its source),
 * C = TRL suggestion, U = your own threshold. Numbers come from the Core; this
 * module only chooses and words them.
 */
export type SignificanceGuidance = { read: WorkflowPoint[]; tips: WorkflowPoint[]; flags: WorkflowPoint[] };

const level = (confidence: string): string => `${Math.round(Number(confidence) * 100)} %`;
const r = (value: string | null, places = 2): string => value === null ? "—" : Number(value).toFixed(places);

export function significanceGuidance(result: SignificanceResult, minTrades: number | null): SignificanceGuidance {
  const test = result.mean_test;
  const runs = result.runs_test;
  const ccy = result.currency ?? "";
  const read: WorkflowPoint[] = [];
  const tips: WorkflowPoint[] = [];
  const flags: WorkflowPoint[] = [];

  if (test.reason === "TOO_FEW_TRADES") read.push({ label: "S", source: "nistT", text: "The test needs at least 2 closed trades (it has N − 1 degrees of freedom)." });
  else if (test.reason === "NO_VARIATION") read.push({ label: "C", text: "Every closed trade had the same result, so there is no spread to test against." });
  else if (test.interval) {
    read.push({ label: "S", source: "nistT", text: `The average closed trade is ${r(test.mean)} ${ccy} over ${test.count} trades. t = average ÷ (standard deviation ÷ √N) = ${r(test.t_statistic)}, with ${test.degrees_of_freedom} degrees of freedom.` });
    read.push({ label: "C", text: "t is the same number as the uncapped SQN on the Overview: they are one piece of evidence, not two." });
    read.push({ label: "S", source: "asa2016", text: `One-sided p = ${r(test.p_value_one_sided, 4)}: if the true average trade were zero, an average at least this high would appear with that probability. It is not the probability that the EA has an edge, and it does not measure how large the edge is.` });
    read.push({ label: "S", source: "nistT", text: `${level(result.confidence)} confidence interval for the average trade: ${r(test.interval.low)} to ${r(test.interval.high)} ${ccy}. Intervals built this way contain the true average in ${level(result.confidence)} of repeated samples.` });
  }

  if (result.validity === "NOT_VALID") read.unshift({ label: "S", source: "nistRandomness", text: `Runs check: wins and losses are not in random order (Z = ${r(runs.z)}). When randomness fails, the usual statistical tests are invalid, so the p-value and interval do not apply to this report.` });
  else if (runs.status === "NOT_REJECTED") read.push({ label: "S", source: "nistRuns", text: `Runs check: ${runs.runs} runs of wins and losses against ${r(runs.expected_runs, 1)} expected if random (Z = ${r(runs.z)}), within ±${r(runs.critical_z)}: no sign of a pattern at your confidence level.` });
  else read.push({ label: "S", source: "nistRuns", text: `Runs check not possible: it needs more than 10 wins and more than 10 losses (here ${runs.wins} and ${runs.losses}). Read the p-value with extra caution.` });
  if (result.lag1_autocorrelation !== null) read.push({ label: "S", source: "nistAutocorrelation", text: `Lag-1 autocorrelation ${r(result.lag1_autocorrelation)}: how closely each trade's result follows the previous one (0 means no relation). Shown for information only.` });

  if (test.interval && result.validity !== "NOT_VALID") {
    if (Number(test.interval.low) <= 0) {
      tips.push({ label: "S", source: "nistT", text: "The interval includes zero: this report cannot separate a small edge from none. Its half-width is t × standard deviation ÷ √N, so about four times as many trades roughly halve it." });
      tips.push({ label: "C", text: "Before deciding, lengthen the test period or test the same settings on more symbols (Symbol scan), then check again." });
    } else {
      tips.push({ label: "C", text: `The whole interval is above zero. Its lower end is ${r(test.interval.low)} ${ccy} per trade: on Advanced → What-If, an extra cost of that much per trade would bring the lower end to zero, so compare it with your broker's realistic spread, commission and slippage.` });
    }
  }
  if (result.validity === "NOT_VALID" && runs.z !== null) {
    tips.push(Number(runs.z) < 0
      ? { label: "C", text: "Fewer runs than expected means wins and losses come in streaks, as when trades of one DCA or grid basket close together. Look at Same settings over time to see whether one period drives the result." }
      : { label: "C", text: "More runs than expected means wins and losses alternate more than chance would. Check whether the EA's logic ties each trade to the previous one (for example a recovery step after a loss)." });
  }
  tips.push({ label: "S", source: "asa2016", text: "Do not decide on whether p passes a threshold alone: read it with the interval, the drawdowns, and an out-of-sample test." });

  flags.push({ label: "S", source: "bailey2014", text: "If this report is the best of many settings you tried, the p-value overstates the evidence. Confirm on data the optimiser never saw (Optimisation checklist, step 3)." });
  flags.push({ label: "C", text: "For DCA or grid EAs, trades that close together in one basket depend on each other; the test treats them as independent, so read it as optimistic." });
  if (belowMinimum(test.count, minTrades)) flags.unshift({ label: "U", text: `This report has ${test.count} closed trades, fewer than your minimum of ${minTrades}.` });
  return { read, tips, flags };
}

/** Positions (0–100) of zero, the interval and the average on one axis, for the interval strip. */
export function intervalGeometry(result: SignificanceResult): { zero: number; low: number; high: number; mean: number } | null {
  const interval = result.mean_test.interval;
  if (!interval || result.mean_test.mean === null) return null;
  const low = Number(interval.low), high = Number(interval.high), mean = Number(result.mean_test.mean);
  const minimum = Math.min(low, 0), maximum = Math.max(high, 0);
  const pad = (maximum - minimum) * 0.08 || 1;
  const from = minimum - pad, span = maximum + pad - from;
  const at = (value: number): number => ((value - from) / span) * 100;
  return { zero: at(0), low: at(low), high: at(high), mean: at(mean) };
}
