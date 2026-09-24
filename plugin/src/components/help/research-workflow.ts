/**
 * Content of the Help page's "Research workflow" guide (owner-approved
 * 2026-09-24). Every point carries a label:
 *   S = sourced fact (with a `source` key into SOURCES),
 *   W = the owner's own workflow choice,
 *   C = TRL's suggestion (with its reasoning in the text),
 *   U = a user-defined threshold (no reliable source gives a number; the
 *       text states the trade-off).
 * Sources are recorded in internal/references/REFERENCE_REGISTER.md.
 */

export type PointLabel = "S" | "W" | "C" | "U";
export type WorkflowPoint = { label: PointLabel; text: string; source?: SourceKey };
export type WorkflowStep = { number: number; title: string; purpose: string; where: string; inputs: string; checks: WorkflowPoint[] };

export const LABEL_TEXT: Record<PointLabel, string> = {
  S: "Sourced fact",
  W: "Your workflow choice",
  C: "TRL suggestion",
  U: "Your own threshold",
};

export const SOURCES = {
  mt5Ticks: { title: "MetaTrader 5 Help: Real and Generated Ticks", url: "https://www.metatrader5.com/en/terminal/help/algotrading/tick_generation" },
  mt5Features: { title: "MetaTrader 5 Help: Testing Features", url: "https://www.metatrader5.com/en/terminal/help/algotrading/testing_features" },
  mt5Testing: { title: "MetaTrader 5 Help: Strategy Testing", url: "https://www.metatrader5.com/en/terminal/help/algotrading/testing" },
  mt5Optimisation: { title: "MetaTrader 5 Help: Optimization Types", url: "https://www.metatrader5.com/en/terminal/help/algotrading/optimization_types" },
  mt5Report: { title: "MetaTrader 5 Help: Testing Report", url: "https://www.metatrader5.com/en/terminal/help/algotrading/testing_report" },
  mt5Start: { title: "MetaTrader 5 Help: Platform Start (tester .ini settings)", url: "https://www.metatrader5.com/en/terminal/help/start_advanced/start" },
  bailey2014: { title: "Bailey, Borwein, López de Prado, Zhu (2014), \"Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest Overfitting on Out-of-Sample Performance\", Notices of the AMS 61(5)", url: null },
  pardo2008: { title: "Pardo, R. (2008), The Evaluation and Optimization of Trading Strategies, 2nd ed., Wiley", url: null },
  tharp: { title: "Van K. Tharp: SQN and R-multiples (e.g. Trade Your Way to Financial Freedom)", url: null },
  playbook: { title: "MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases)", url: null },
  nistT: { title: "NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.5.2 Confidence Limits for the Mean", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm" },
  nistRandomness: { title: "NIST/SEMATECH e-Handbook of Statistical Methods, 1.2.5.1 Consequences of Non-Randomness", url: "https://www.itl.nist.gov/div898/handbook/eda/section2/eda251.htm" },
  nistRuns: { title: "NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.5.13 Runs Test for Detecting Non-randomness", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda35d.htm" },
  nistAutocorrelation: { title: "NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.5.12 Autocorrelation", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda35c.htm" },
  asa2016: { title: "Wasserstein, R. L. & Lazar, N. A. (2016), \"The ASA's Statement on p-Values: Context, Process, and Purpose\", The American Statistician 70(2), 129–133", url: "https://doi.org/10.1080/00031305.2016.1154108" },
  firmRules: { title: "The firm's own rules page (FTMO and FundedNext pages are listed with each preset)", url: null },
} as const;
export type SourceKey = keyof typeof SOURCES;

export const WORKFLOW_INTRO = [
  "This guide takes an MT5 Expert Advisor from a broad symbol scan to a go-live decision. MT5 runs every test; TRL checks the reports, compares them, and stresses the results. TRL never picks a winner for you.",
  "Every point is labelled: a sourced fact (with its source), your own workflow choice, a TRL suggestion, or a threshold you set yourself. Where no reliable source gives a number, TRL does not invent one.",
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: 0, title: "Set up and check the inputs", purpose: "Make sure every report is the test you think it is.",
    where: "MT5, then TRL Data & import (companion .set check)", inputs: "The EA, its .set file, the report",
    checks: [
      { label: "S", source: "playbook", text: "The report's own Settings show the symbol, dates and input values you intended. MT5 can silently run stale presets or the EA's compiled defaults, so check every report." },
      { label: "S", source: "playbook", text: "The .set you meant to use matches the inputs the report ran with. TRL's .set check lists every difference." },
      { label: "S", source: "mt5Report", text: "History Quality is MT5's share of correct one-minute data. Intervals below 50% are drawn in red in the report." },
      { label: "U", text: "The minimum History Quality you accept. Higher is safer but may shorten the usable history, for example where a broker's real-tick data starts late." },
    ],
  },
  {
    number: 1, title: "Plan your data split before any test", purpose: "Keep some data that none of your choices has touched.",
    where: "Your notes (TRL Research notes)", inputs: "Dates",
    checks: [
      { label: "W", text: "A 2-year scan window that ends 6 months ago; the 6 months before it for the extended test; the last 6 months as forward data." },
      { label: "C", text: "Do not use the last 6 months in any ranking or optimisation, only in step 9. Once a choice has been made with them, they are no longer unseen." },
      { label: "S", source: "playbook", text: "A single in-sample window is not validation: a clean result can hide an adverse episode the window did not contain." },
      { label: "S", source: "bailey2014", text: "The more configurations you try, the more likely the best in-sample result is overfit, so out-of-sample evidence is needed (qualitative; no number is taken from this source)." },
      { label: "S", source: "mt5Testing", text: "MT5 describes forward testing as a way to avoid fitting parameters to one part of the history." },
    ],
  },
  {
    number: 2, title: "Broad scan", purpose: "Find symbols worth a closer look.",
    where: "MT5: optimisation mode \"All symbols selected in Market Watch\" (Optimization=3), a fixed .set, the scan window only; then TRL Symbol scan (import the exported XML, filter, compare EAs, shortlist)", inputs: "A baseline .set (attach it on import to record the inputs)",
    checks: [
      { label: "W", text: "\"1 minute OHLC\" when testing many symbols; \"Every tick based on real ticks\" when few." },
      { label: "S", source: "mt5Features", text: "In \"1 minute OHLC\" and \"Open prices only\", stop loss, take profit and pending orders fill at exactly the requested price. The scan is optimistic for stop-based EAs, so treat it as a screen only." },
      { label: "S", source: "mt5Report", text: "Profit Factor = gross profit ÷ gross loss; Recovery Factor = profit ÷ maximum drawdown. Both are MT5's definitions." },
      { label: "U", text: "Your cut-offs for profit factor, recovery factor, drawdown and trade count. Tight cut-offs keep few symbols and may discard slow but steady ones; loose ones pass noise to the next steps." },
      { label: "C", text: "On Symbol scan, set your own filters, look at the trade-off frontier, compare up to 6 EAs on the same symbols, and record the shortlist in your Experiment note. TRL does not rank symbols for you." },
    ],
  },
  {
    number: 3, title: "Check the shortlist realistically", purpose: "Re-test each shortlisted symbol with realistic prices and costs.",
    where: "MT5 single tests, then TRL Data & import, Overview, and Portfolio (up to 10 reports side by side as tracks)", inputs: "The scan window; \"Every tick based on real ticks\"; \"Use predefined commissions\"; optionally a random execution delay (ExecutionMode=-1); the TRL equity logger for averaging, grid or DCA EAs",
    checks: [
      { label: "S", source: "mt5Ticks", text: "With real ticks the spread can change within a minute; generated ticks use one fixed spread per minute bar." },
      { label: "S", source: "playbook", text: "Use real ticks for any EA with intrabar exit logic; a coarser mode can produce a different trade history." },
      { label: "S", source: "mt5Start", text: "ExecutionMode: 0 normal, -1 a random delay on every trade, or a fixed delay in milliseconds." },
      { label: "S", source: "playbook", text: "Balance only moves when trades close. Compare equity drawdown with balance drawdown: TRL shows the ratio and flags when equity was much deeper." },
      { label: "S", source: "tharp", text: "SQN = √N × mean(R) ÷ standard deviation(R); TRL shows it on the Overview. It grows with consistency and with the number of trades." },
      { label: "U", text: "The minimum number of trades. Fewer trades make every metric noisier; requiring many excludes slow EAs and short windows. Sources do not agree on one number." },
      { label: "S", source: "nistT", text: "Analysis → \"Is the average trade distinguishable from zero?\" gives a confidence interval for the average closed trade; its width shrinks with √N, so few trades leave it wide." },
      { label: "C", text: "Set your minimum trades once in TRL's settings (or on that Analysis section): TRL then warns on the Overview, Analysis, Windows, Symbol scan and Parameters wherever a result rests on fewer trades." },
    ],
  },
  {
    number: 4, title: "Test the same settings over time", purpose: "Check the result does not depend on one lucky period.",
    where: "TRL Analysis → \"Same settings over time (windows)\": split one long report into N-month windows, or compare separate MT5 window reports of the same settings", inputs: "The same fixed .set (one long test is enough when you split it)",
    checks: [
      { label: "S", source: "playbook", text: "Walk-forward with fixed settings: look at the result in each window, not only the total. One losing window out of five is a different risk from none." },
      { label: "C", text: "Half-year windows, as in the playbook's example." },
      { label: "U", text: "How many losing windows you accept, and how deep. Stricter rules reject more EAs that are fine over the full period." },
    ],
  },
  {
    number: 5, title: "Optimise with an internal forward period", purpose: "Tune a few inputs without spending the last 6 months.",
    where: "MT5 fast genetic optimisation with a custom Forward date inside the scan window, then TRL Parameters (optimisation XML, forward XML and .set)", inputs: "The scan window only",
    checks: [
      { label: "W", text: "Optimise 1 to 3 inputs, for the best symbols only." },
      { label: "S", source: "bailey2014", text: "Fewer inputs means fewer combinations tried, which lowers the chance that the best one is a fluke (qualitative)." },
      { label: "S", source: "mt5Start", text: "MT5 forward options: 1/2, 1/3 or 1/4 of the period, or a custom start date (ForwardMode / ForwardDate). The forward part is always the latest one." },
      { label: "S", source: "mt5Optimisation", text: "The fast genetic algorithm tests only part of all combinations. TRL shows how much of the grid was tested." },
      { label: "C", text: "Choose from TRL's trade-off frontier, then check each candidate's forward result. TRL never picks for you." },
      { label: "U", text: "Your constraints (minimum trades, maximum equity drawdown %) and the forward share. A longer forward part gives better evidence but leaves less data to tune on." },
    ],
  },
  {
    number: 6, title: "Look for a plateau, not a peak", purpose: "Avoid a setting that sits next to a cliff.",
    where: "TRL Parameters → Neighbourhood, then MT5 \"Slow complete algorithm\" on TRL's neighbourhood .set, then attach that run in TRL", inputs: "The chosen candidate",
    checks: [
      { label: "S", source: "playbook", text: "A strong optimum can sit right next to a catastrophic one. Test a denser grid around it and confirm a stable plateau, not an isolated spike." },
      { label: "S", source: "mt5Optimisation", text: "The slow complete algorithm tests every combination in the small neighbourhood box." },
      { label: "C", text: "TRL shows neighbourhood statistics only once at least 4 neighbours are tested. This is TRL's own display rule, not a published threshold." },
      { label: "U", text: "How much worse the neighbours may be. A tight limit keeps only very flat regions; a loose one accepts sharper peaks." },
    ],
  },
  {
    number: 7, title: "Stress costs and trade order", purpose: "See how thin the edge is.",
    where: "TRL Advanced: What-If and Monte Carlo", inputs: "What-If: an extra cost per trade; Monte Carlo: a seed and the number of paths",
    checks: [
      { label: "U", text: "The extra cost per trade, for example your broker's typical spread plus slippage. Higher costs are more pessimistic; the right value depends on your broker and symbol." },
      { label: "S", source: "playbook", text: "Reshuffling trades measures ordering risk only, not total risk." },
      { label: "U", text: "The worst drawdown you accept at the 95th percentile of reshuffles: your risk budget." },
    ],
  },
  {
    number: 8, title: "Prop-firm rules (if you trade a challenge)", purpose: "Check the firm's actual rules.",
    where: "TRL Prop-firm check, with the equity log attached", inputs: "A firm preset or your own profile; the report's server time zone",
    checks: [
      { label: "S", source: "firmRules", text: "No breach on the full run under the firm's rules." },
      { label: "C", text: "Also run Rolling start dates, and a phase chain for two-step challenges. The pass share describes this history, not a probability." },
      { label: "U", text: "The pass share you require. A higher bar picks EAs that pass from most start days; a lower one accepts more timing luck." },
    ],
  },
  {
    number: 9, title: "Final test on the held-out months", purpose: "Get honest evidence on data you have never looked at.",
    where: "MT5 single test on the last 6 months with the final .set (real ticks, commissions, delay), then TRL", inputs: "The frozen .set",
    checks: [
      { label: "C", text: "Do not change anything after seeing this result. If you do, these months are no longer out-of-sample, and a new unseen period is needed." },
      { label: "S", source: "pardo2008", text: "Walk-forward analysis tests each choice on the next unseen window (qualitative)." },
      { label: "U", text: "How close to steps 3–5 the result must be. Six months can be noisy, so a strict match may reject good EAs, and a loose one may miss a real change." },
    ],
  },
  {
    number: 10, title: "Visual check and decision", purpose: "Check the EA behaves as designed, then decide.",
    where: "MT5 visual mode, then TRL Research notes (record the decision and why)", inputs: "The candidate",
    checks: [
      { label: "S", source: "mt5Testing", text: "Visual testing is not available while optimising: run it as a single test." },
      { label: "C", text: "Run a demo forward period before going live." },
      { label: "U", text: "How long the demo period lasts. Longer is more evidence, at the cost of time." },
    ],
  },
];

export const WORKFLOW_GAPS = [
  "Rolling walk-forward optimisation (re-optimising for each window).",
  "Modelling spread, slippage or execution delay inside TRL (today: What-If's fixed cost per trade).",
  "Bootstrap Monte Carlo (resampling with replacement); today TRL reorders the actual trades.",
  "Importing demo or live account statements to track real forward results.",
  "Combining equity logs in Portfolio; today it combines realised balance only.",
  "A checklist in Research notes that tracks steps 0–10.",
  "A cost breakdown view; TRL's closed-trade figures also leave out commissions charged when positions open.",
];

/** The shipped guide (product-docs/RESEARCH_WORKFLOW.md), generated from the same content as the Help page. */
export function workflowMarkdown(): string {
  const lines = ["# Research workflow: from symbol scan to go-live", "", "<!-- Generated from plugin/src/components/help/research-workflow.ts; edit that file, not this one. -->", ""];
  for (const line of WORKFLOW_INTRO) lines.push(line, "");
  lines.push("**Labels:** " + (Object.keys(LABEL_TEXT) as PointLabel[]).map((key) => `**[${key}]** ${LABEL_TEXT[key]}`).join(" · ") + ".", "");
  for (const step of WORKFLOW_STEPS) {
    lines.push(`## ${step.number}. ${step.title}`, "", `**Purpose:** ${step.purpose}`, "", `**Where:** ${step.where}`, "", `**Inputs:** ${step.inputs}`, "", "**Checks:**", "");
    for (const point of step.checks) {
      const source = point.source ? SOURCES[point.source] : null;
      const cite = source ? ` *(Source: ${source.url ? `[${source.title}](${source.url})` : source.title}.)*` : "";
      lines.push(`- **[${point.label}]** ${point.text}${cite}`);
    }
    lines.push("");
  }
  lines.push("## Not in TRL yet", "", ...WORKFLOW_GAPS.map((gap) => `- ${gap}`), "");
  return lines.join("\n");
}
