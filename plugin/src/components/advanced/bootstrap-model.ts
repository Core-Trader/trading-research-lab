import type { BootstrapResult } from "../../types.ts";
import type { WorkflowPoint } from "../help/research-workflow.ts";

/**
 * How to read a resampling run, and what to do next (PROPOSAL_BOOTSTRAP.md B3,
 * B4, B6). Points carry the Research workflow's labels: S = sourced, C = TRL
 * suggestion, U = your own threshold. Tail values (99th percentile, extremes)
 * are described but never used for a tip (NIST 1.3.3.4). Numbers come from the
 * Core; this module only chooses and words them.
 */
export type BootstrapGuidance = { read: WorkflowPoint[]; tips: WorkflowPoint[]; flags: WorkflowPoint[] };

const r = (value: string | null): string => value === null ? "—" : Number(value).toFixed(2);

export function bootstrapGuidance(result: BootstrapResult, streaky: boolean): BootstrapGuidance {
  const ccy = result.currency;
  const final = result.final_summary;
  const drawdown = result.drawdown_summary;
  const below = Number(result.below_zero.percent);
  const blocks = result.method === "BLOCK_RESAMPLE";
  const read: WorkflowPoint[] = [];
  const tips: WorkflowPoint[] = [];
  const flags: WorkflowPoint[] = [];

  read.push(blocks
    ? { label: "S", source: "kunsch1989", text: `Each of the ${result.configuration.path_count} paths joins blocks of ${result.configuration.block_length} consecutive trades from this report, drawn with replacement, so trades that follow each other stay together.` }
    : { label: "S", source: "nistBootstrap", text: `Each of the ${result.configuration.path_count} paths draws ${result.population_count} closed trades from this report with replacement: a trade can appear several times or not at all.` });
  read.push({ label: "S", source: "efron1979", text: `The spread of the paths estimates how much the result depends on which trades happened to occur. Median final result ${r(final.p50)} ${ccy}; 90 % of paths ended between ${r(final.p05)} and ${r(final.p95)} ${ccy} (your report: ${r(result.historical.final)} ${ccy}).` });
  read.push({ label: "C", text: `${r(result.below_zero.percent)} % of paths ended below zero: in that share of resamples of these trades, the total was a loss. It describes this report's trades, not future markets.` });
  read.push({ label: "C", text: `Drawdown on closed-trade P/L: median ${r(drawdown.p50)} ${ccy}, 95th percentile ${r(drawdown.p95)} ${ccy}; your report's own drawdown was ${r(result.historical.maximum_drawdown)} ${ccy}.` });
  read.push({ label: "S", source: "nistBootstrap", text: `The worst path (${r(drawdown.maximum)} ${ccy}) and the 99th percentile depend on the tails, where the bootstrap is least reliable; TRL does not base tips on them.` });
  if (result.over_limit) read.push({ label: "U", text: `${r(result.over_limit.percent)} % of paths had a drawdown above your limit of ${r(result.over_limit.limit)} ${ccy}.` });

  if (streaky && !blocks) tips.push({ label: "S", source: "kunsch1989", text: "The significance check found your wins and losses come in streaks. Resampling single trades breaks streaks up and can understate drawdowns; use \"Resample in blocks\", which keeps consecutive trades together." });
  tips.push(below > 0
    ? { label: "C", text: "Some paths end in a loss. Read this with the significance check on Analysis: if its interval includes zero, lengthen the test or test more symbols before deciding." }
    : { label: "C", text: "No path ended below zero, but every path reuses only these trades. Confirm on data the optimiser never saw (Optimisation checklist, step 3)." });
  if (blocks) tips.push({ label: "C", text: "Run it again with a few different block lengths. If the results change a lot with the length, treat them with caution." });
  if (!result.over_limit) tips.push({ label: "U", text: "Enter your own drawdown limit (for example a prop firm's maximum loss) to see how many paths exceed it." });

  flags.push({ label: "C", text: "Drawdown here is measured on closed-trade P/L from zero; floating losses inside open trades are not included (see Equity on Analysis)." });
  flags.push({ label: "S", source: "bailey2014", text: "If this report is the best of many settings you tried, every path inherits that selection; resampling cannot remove it." });
  return { read, tips, flags };
}

/** Why "Resample in blocks" is disabled, or null when the block length is usable (B4). */
export function blockLengthProblem(text: string, trades: number | null): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return "Enter your own block length to use this method.";
  if (!/^\d+$/.test(trimmed)) return "The block length must be a whole number.";
  const value = Number(trimmed);
  if (value < 2) return "The block length must be at least 2.";
  if (trades !== null && value >= trades) return `The block length must be less than the report's ${trades} closed trades.`;
  return null;
}
