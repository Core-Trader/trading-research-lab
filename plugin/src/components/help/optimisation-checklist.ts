import { LABEL_TEXT, SOURCES, type PointLabel, type WorkflowPoint } from "./research-workflow.ts";

/**
 * Content of the Help page's "Optimisation checklist" (owner-approved
 * 2026-09-24, option A). It follows the owner's MT5 EA optimisation tutorial
 * (C:\DEV\EA-DCA-V1.0\MT5_EA_OPTIMIZATION_TUTORIAL.md), mapped to TRL's tools
 * and the Research workflow steps, with the same labels and sources. Where the
 * tutorial differs from MT5's documentation or TRL's sources, this follows
 * the source; its rules of thumb are shown as the user's own thresholds.
 */

/** How much of a step TRL covers today. */
export type Coverage = "FULL" | "PARTIAL" | "OUTSIDE";

export type ChecklistStep = {
  number: number;
  title: string;
  question: string;
  tool: string;
  coverage: Coverage;
  /** Matching steps of the Research workflow guide. */
  workflowSteps: number[];
  points: WorkflowPoint[];
};

export const COVERAGE_TEXT: Record<Coverage, string> = {
  FULL: "In TRL",
  PARTIAL: "Partly in TRL",
  OUTSIDE: "Outside TRL (MT5 and your notes)",
};

export const CHECKLIST_INTRO = [
  "A seven-step checklist for tuning an EA's inputs without trusting one lucky backtest. It follows your MT5 optimisation tutorial, with each step mapped to the TRL tool that does it and to the matching Research workflow step.",
  "Where the tutorial's wording differs from MT5's documentation or TRL's sources, this version follows the source, and its rules of thumb are shown as your own thresholds.",
];

export const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    number: 1, title: "Baseline backtest", question: "Is there any edge at all?",
    tool: "MT5 single test with \"Every tick based on real ticks\", then TRL Data & import (.set check), Overview and Analysis; the TRL equity logger for floating drawdown",
    coverage: "FULL", workflowSteps: [0, 3],
    points: [
      { label: "S", source: "playbook", text: "Before reading any number, confirm the report's own Settings show the symbol, dates and inputs you intended. TRL's .set check lists every input that differs." },
      { label: "S", source: "mt5Ticks", text: "With real ticks the spread can change within a minute; generated ticks use one fixed spread per minute bar." },
      { label: "S", source: "mt5Features", text: "In \"1 minute OHLC\" and \"Open prices only\", stop loss, take profit and pending orders fill at exactly the requested price, so fast modes are a first screen only." },
      { label: "S", source: "mt5Report", text: "Profit Factor = gross profit ÷ gross loss; Recovery Factor = profit ÷ maximum drawdown." },
      { label: "S", source: "mt5Report", text: "Equity Drawdown Maximal is the drop from the highest local equity value to the next lowest equity value. It includes floating losses but is measured from an equity peak, so it is not simply the worst floating loss." },
      { label: "S", source: "playbook", text: "Balance moves only when trades close. An averaging, grid or DCA EA can show a calm balance curve while equity is deep underwater; compare the two drawdowns. TRL shows both once an equity log is attached." },
      { label: "U", text: "The Profit Factor you treat as too fragile, and the minimum number of trades. The tutorial's rules of thumb have no published source; a higher bar rejects more noise but also more slow EAs." },
    ],
  },
  {
    number: 2, title: "Optimise, then check for a cliff", question: "Which settings work, and is that a stable plateau or a lucky spike?",
    tool: "MT5 optimisation, then TRL Parameters: the trade-off frontier, the neighbourhood check, and a neighbourhood .set to run a denser grid in MT5 and attach",
    coverage: "FULL", workflowSteps: [5, 6],
    points: [
      { label: "S", source: "mt5Optimisation", text: "The slow complete algorithm tests every combination and is the most precise; the fast genetic algorithm is much faster and described by MetaQuotes as almost the same quality. MT5 switches to genetic automatically only for very large searches." },
      { label: "S", source: "bailey2014", text: "The more combinations you try, the more likely the best in-sample result is overfit, so optimise few inputs (qualitative; no number is taken from this source)." },
      { label: "S", source: "playbook", text: "A strong optimum can sit right next to a poor one. Test a denser grid around it and confirm a stable plateau, not an isolated spike." },
      { label: "C", text: "The neighbourhood check on Parameters shows what share of the tested neighbours were profitable and the worst neighbour's equity drawdown; this is the tutorial's count of losing combinations." },
      { label: "W", text: "Compare candidates by Profit Factor or Recovery Factor, not by net profit alone." },
      { label: "U", text: "How many losing neighbours, or how large a swing between neighbouring settings, you accept. A strict limit keeps only very flat regions; a loose one accepts sharper peaks." },
    ],
  },
  {
    number: 3, title: "Out-of-sample test", question: "Does it still work on data the optimiser never saw?",
    tool: "An MT5 Forward period in the optimisation, paired on TRL Parameters; or an MT5 single test of the unchanged settings on the held-back dates, imported on Data & import",
    coverage: "FULL", workflowSteps: [1, 5, 9],
    points: [
      { label: "S", source: "mt5Testing", text: "MT5 describes forward testing as a way to avoid fitting parameters to one part of the history." },
      { label: "S", source: "playbook", text: "A single in-sample window is not validation: a clean result can hide an adverse episode the window did not contain." },
      { label: "W", text: "Run the chosen settings unchanged on the held-back dates. If the result collapses, do not re-optimise on all the data and call it fixed." },
      { label: "C", text: "If your history allows, also test a period before the in-sample window. Settings that only work after the period they were tuned on may be fitted to one market regime." },
      { label: "U", text: "How much history to hold back. More held-back data gives a fairer test but leaves less for optimising." },
    ],
  },
  {
    number: 4, title: "Same settings over time", question: "Does it hold in most periods, not only in total?",
    tool: "TRL Analysis → \"Same settings over time (windows)\": split one long report, or compare separate window reports of the same settings",
    coverage: "FULL", workflowSteps: [4],
    points: [
      { label: "S", source: "playbook", text: "With fixed settings, look at the result in each window, not only the total. One losing window out of five is a different risk from none." },
      { label: "S", source: "pardo2008", text: "Walk-forward analysis re-optimises on each in-sample window and tests on the next unseen one. Running fixed settings through consecutive windows is a different check (stability over time); the tutorial calls it walk-forward. Rolling walk-forward optimisation is not in TRL yet." },
      { label: "W", text: "Half-year windows." },
      { label: "C", text: "For every losing window, find out what was different about the market before trusting the settings." },
      { label: "U", text: "How many losing windows you accept. A strict rule rejects more EAs that are fine over the full period." },
    ],
  },
  {
    number: 5, title: "Monte Carlo", question: "How much of the result depends on the order the trades happened in?",
    tool: "TRL Advanced → Monte Carlo (reorders the actual trades)",
    coverage: "PARTIAL", workflowSteps: [7],
    points: [
      { label: "S", source: "playbook", text: "Reshuffling trades measures ordering risk only, not total risk." },
      { label: "C", text: "Reordering the same trades never changes the final total, only the path, because a sum does not depend on order. It gives the drawdown spread (median, 95th percentile, worst), not the chance of ending negative." },
      { label: "C", text: "The chance of ending negative needs resampling with replacement (a bootstrap), where some trades are drawn more than once and others not at all. That is not in TRL yet." },
      { label: "C", text: "Neither method can create a loss larger than the worst one in the data. For DCA or grid EAs, trades in one basket depend on each other, so treating them as independent can understate risk: read the result as a lower bound." },
      { label: "C", text: "TRL's closed-trade P/L includes the commission and swap MT5 books on each closing deal; commissions charged when positions open are not yet included." },
      { label: "U", text: "How many paths to run. More paths give steadier percentiles but take longer." },
    ],
  },
  {
    number: 6, title: "Combined portfolio", question: "Do the symbols diversify each other, or lose at the same time?",
    tool: "TRL Portfolio: up to 10 reports as tracks over the same dates, combined into one realised balance",
    coverage: "PARTIAL", workflowSteps: [3],
    points: [
      { label: "S", source: "playbook", text: "A low correlation number is not enough: two symbols can still share an overlapping drawdown during one event. Build the combined curve and measure it." },
      { label: "W", text: "Test every candidate symbol over the same dates, then check whether adding it makes the combined drawdown smaller or larger." },
      { label: "C", text: "TRL combines realised balance only, so floating losses are not in the combined curve. Combining equity logs is not in TRL yet." },
      { label: "C", text: "Each backtest ran with its own full deposit, so the combination does not show shared margin or a stop-out on one account." },
      { label: "U", text: "How much the combined drawdown must improve for a symbol to earn its place." },
    ],
  },
  {
    number: 7, title: "Demo, then go live small", question: "Does it behave live as it did in the simulation?",
    tool: "An MT5 demo account; record the comparison in your Experiment note",
    coverage: "OUTSIDE", workflowSteps: [9, 10],
    points: [
      { label: "W", text: "Run the final settings on a demo account and compare trade frequency, win rate, and behaviour around news, spread widening and weekend gaps with the backtest. Then start with less money than feels necessary." },
      { label: "C", text: "Importing demo or live statements to compare them in TRL is not in TRL yet." },
      { label: "U", text: "How long the demo runs and how closely it must match the backtest. Longer is more convincing but delays the decision." },
    ],
  },
];

/** The shipped checklist (product-docs/OPTIMISATION_CHECKLIST.md), generated from the same content as the Help page. */
export function checklistMarkdown(): string {
  const lines = ["# Optimisation checklist: seven steps, mapped to TRL", "", "<!-- Generated from plugin/src/components/help/optimisation-checklist.ts; edit that file, not this one. -->", ""];
  for (const line of CHECKLIST_INTRO) lines.push(line, "");
  lines.push("**Labels:** " + (Object.keys(LABEL_TEXT) as PointLabel[]).map((key) => `**[${key}]** ${LABEL_TEXT[key]}`).join(" · ") + ".", "");
  for (const step of CHECKLIST_STEPS) {
    lines.push(`## ${step.number}. ${step.title}`, "", `**Question:** ${step.question}`, "", `**In TRL:** ${step.tool} (${COVERAGE_TEXT[step.coverage]})`, "", `**Research workflow:** step ${step.workflowSteps.join(", ")}`, "");
    for (const point of step.points) {
      const source = point.source ? SOURCES[point.source] : null;
      const cite = source ? ` *(Source: ${source.url ? `[${source.title}](${source.url})` : source.title}.)*` : "";
      lines.push(`- **[${point.label}]** ${point.text}${cite}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
