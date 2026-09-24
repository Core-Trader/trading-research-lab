# Research workflow: from symbol scan to go-live

<!-- Generated from plugin/src/components/help/research-workflow.ts; edit that file, not this one. -->

This guide takes an MT5 Expert Advisor from a broad symbol scan to a go-live decision. MT5 runs every test; TRL checks the reports, compares them, and stresses the results. TRL never picks a winner for you.

Every point is labelled: a sourced fact (with its source), your own workflow choice, a TRL suggestion, or a threshold you set yourself. Where no reliable source gives a number, TRL does not invent one.

**Labels:** **[S]** Sourced fact · **[W]** Your workflow choice · **[C]** TRL suggestion · **[U]** Your own threshold.

## 0. Set up and check the inputs

**Purpose:** Make sure every report is the test you think it is.

**Where:** MT5, then TRL Data & import (companion .set check)

**Inputs:** The EA, its .set file, the report

**Checks:**

- **[S]** The report's own Settings show the symbol, dates and input values you intended. MT5 can silently run stale presets or the EA's compiled defaults, so check every report. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** The .set you meant to use matches the inputs the report ran with. TRL's .set check lists every difference. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** History Quality is MT5's share of correct one-minute data. Intervals below 50% are drawn in red in the report. *(Source: [MetaTrader 5 Help: Testing Report](https://www.metatrader5.com/en/terminal/help/algotrading/testing_report).)*
- **[U]** The minimum History Quality you accept. Higher is safer but may shorten the usable history, for example where a broker's real-tick data starts late.

## 1. Plan your data split before any test

**Purpose:** Keep some data that none of your choices has touched.

**Where:** Your notes (TRL Research notes)

**Inputs:** Dates

**Checks:**

- **[W]** A 2-year scan window that ends 6 months ago; the 6 months before it for the extended test; the last 6 months as forward data.
- **[C]** Do not use the last 6 months in any ranking or optimisation, only in step 9. Once a choice has been made with them, they are no longer unseen.
- **[S]** A single in-sample window is not validation: a clean result can hide an adverse episode the window did not contain. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** The more configurations you try, the more likely the best in-sample result is overfit, so out-of-sample evidence is needed (qualitative; no number is taken from this source). *(Source: Bailey, Borwein, López de Prado, Zhu (2014), "Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest Overfitting on Out-of-Sample Performance", Notices of the AMS 61(5).)*
- **[S]** MT5 describes forward testing as a way to avoid fitting parameters to one part of the history. *(Source: [MetaTrader 5 Help: Strategy Testing](https://www.metatrader5.com/en/terminal/help/algotrading/testing).)*

## 2. Broad scan

**Purpose:** Find symbols worth a closer look.

**Where:** MT5: optimisation mode "All symbols selected in Market Watch" (Optimization=3), a fixed .set, the scan window only; then TRL Symbol scan (import the exported XML, filter, compare EAs, shortlist)

**Inputs:** A baseline .set (attach it on import to record the inputs)

**Checks:**

- **[W]** "1 minute OHLC" when testing many symbols; "Every tick based on real ticks" when few.
- **[S]** In "1 minute OHLC" and "Open prices only", stop loss, take profit and pending orders fill at exactly the requested price. The scan is optimistic for stop-based EAs, so treat it as a screen only. *(Source: [MetaTrader 5 Help: Testing Features](https://www.metatrader5.com/en/terminal/help/algotrading/testing_features).)*
- **[S]** Profit Factor = gross profit ÷ gross loss; Recovery Factor = profit ÷ maximum drawdown. Both are MT5's definitions. *(Source: [MetaTrader 5 Help: Testing Report](https://www.metatrader5.com/en/terminal/help/algotrading/testing_report).)*
- **[U]** Your cut-offs for profit factor, recovery factor, drawdown and trade count. Tight cut-offs keep few symbols and may discard slow but steady ones; loose ones pass noise to the next steps.
- **[C]** On Symbol scan, set your own filters, look at the trade-off frontier, compare up to 6 EAs on the same symbols, and record the shortlist in your Experiment note. TRL does not rank symbols for you.

## 3. Check the shortlist realistically

**Purpose:** Re-test each shortlisted symbol with realistic prices and costs.

**Where:** MT5 single tests, then TRL Data & import, Overview, and Portfolio (up to 10 reports side by side as tracks)

**Inputs:** The scan window; "Every tick based on real ticks"; "Use predefined commissions"; optionally a random execution delay (ExecutionMode=-1); the TRL equity logger for averaging, grid or DCA EAs

**Checks:**

- **[S]** With real ticks the spread can change within a minute; generated ticks use one fixed spread per minute bar. *(Source: [MetaTrader 5 Help: Real and Generated Ticks](https://www.metatrader5.com/en/terminal/help/algotrading/tick_generation).)*
- **[S]** Use real ticks for any EA with intrabar exit logic; a coarser mode can produce a different trade history. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** ExecutionMode: 0 normal, -1 a random delay on every trade, or a fixed delay in milliseconds. *(Source: [MetaTrader 5 Help: Platform Start (tester .ini settings)](https://www.metatrader5.com/en/terminal/help/start_advanced/start).)*
- **[S]** Balance only moves when trades close. Compare equity drawdown with balance drawdown: TRL shows the ratio and flags when equity was much deeper. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** SQN = √N × mean(R) ÷ standard deviation(R); TRL shows it on the Overview. It grows with consistency and with the number of trades. *(Source: Van K. Tharp: SQN and R-multiples (e.g. Trade Your Way to Financial Freedom).)*
- **[U]** The minimum number of trades. Fewer trades make every metric noisier; requiring many excludes slow EAs and short windows. Sources do not agree on one number.

## 4. Test the same settings over time

**Purpose:** Check the result does not depend on one lucky period.

**Where:** MT5 single tests for each window (the 6 months before, and the scan window split into windows), then TRL (compare the reports; the sequential batch checks they are consecutive and chains their balance)

**Inputs:** The same fixed .set

**Checks:**

- **[S]** Walk-forward with fixed settings: look at the result in each window, not only the total. One losing window out of five is a different risk from none. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[C]** Half-year windows, as in the playbook's example.
- **[U]** How many losing windows you accept, and how deep. Stricter rules reject more EAs that are fine over the full period.

## 5. Optimise with an internal forward period

**Purpose:** Tune a few inputs without spending the last 6 months.

**Where:** MT5 fast genetic optimisation with a custom Forward date inside the scan window, then TRL Parameters (optimisation XML, forward XML and .set)

**Inputs:** The scan window only

**Checks:**

- **[W]** Optimise 1 to 3 inputs, for the best symbols only.
- **[S]** Fewer inputs means fewer combinations tried, which lowers the chance that the best one is a fluke (qualitative). *(Source: Bailey, Borwein, López de Prado, Zhu (2014), "Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest Overfitting on Out-of-Sample Performance", Notices of the AMS 61(5).)*
- **[S]** MT5 forward options: 1/2, 1/3 or 1/4 of the period, or a custom start date (ForwardMode / ForwardDate). The forward part is always the latest one. *(Source: [MetaTrader 5 Help: Platform Start (tester .ini settings)](https://www.metatrader5.com/en/terminal/help/start_advanced/start).)*
- **[S]** The fast genetic algorithm tests only part of all combinations. TRL shows how much of the grid was tested. *(Source: [MetaTrader 5 Help: Optimization Types](https://www.metatrader5.com/en/terminal/help/algotrading/optimization_types).)*
- **[C]** Choose from TRL's trade-off frontier, then check each candidate's forward result. TRL never picks for you.
- **[U]** Your constraints (minimum trades, maximum equity drawdown %) and the forward share. A longer forward part gives better evidence but leaves less data to tune on.

## 6. Look for a plateau, not a peak

**Purpose:** Avoid a setting that sits next to a cliff.

**Where:** TRL Parameters → Neighbourhood, then MT5 "Slow complete algorithm" on TRL's neighbourhood .set, then attach that run in TRL

**Inputs:** The chosen candidate

**Checks:**

- **[S]** A strong optimum can sit right next to a catastrophic one. Test a denser grid around it and confirm a stable plateau, not an isolated spike. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** The slow complete algorithm tests every combination in the small neighbourhood box. *(Source: [MetaTrader 5 Help: Optimization Types](https://www.metatrader5.com/en/terminal/help/algotrading/optimization_types).)*
- **[C]** TRL shows neighbourhood statistics only once at least 4 neighbours are tested. This is TRL's own display rule, not a published threshold.
- **[U]** How much worse the neighbours may be. A tight limit keeps only very flat regions; a loose one accepts sharper peaks.

## 7. Stress costs and trade order

**Purpose:** See how thin the edge is.

**Where:** TRL Advanced: What-If and Monte Carlo

**Inputs:** What-If: an extra cost per trade; Monte Carlo: a seed and the number of paths

**Checks:**

- **[U]** The extra cost per trade, for example your broker's typical spread plus slippage. Higher costs are more pessimistic; the right value depends on your broker and symbol.
- **[S]** Reshuffling trades measures ordering risk only, not total risk. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[U]** The worst drawdown you accept at the 95th percentile of reshuffles: your risk budget.

## 8. Prop-firm rules (if you trade a challenge)

**Purpose:** Check the firm's actual rules.

**Where:** TRL Prop-firm check, with the equity log attached

**Inputs:** A firm preset or your own profile; the report's server time zone

**Checks:**

- **[S]** No breach on the full run under the firm's rules. *(Source: The firm's own rules page (FTMO and FundedNext pages are listed with each preset).)*
- **[C]** Also run Rolling start dates, and a phase chain for two-step challenges. The pass share describes this history, not a probability.
- **[U]** The pass share you require. A higher bar picks EAs that pass from most start days; a lower one accepts more timing luck.

## 9. Final test on the held-out months

**Purpose:** Get honest evidence on data you have never looked at.

**Where:** MT5 single test on the last 6 months with the final .set (real ticks, commissions, delay), then TRL

**Inputs:** The frozen .set

**Checks:**

- **[C]** Do not change anything after seeing this result. If you do, these months are no longer out-of-sample, and a new unseen period is needed.
- **[S]** Walk-forward analysis tests each choice on the next unseen window (qualitative). *(Source: Pardo, R. (2008), The Evaluation and Optimization of Trading Strategies, 2nd ed., Wiley.)*
- **[U]** How close to steps 3–5 the result must be. Six months can be noisy, so a strict match may reject good EAs, and a loose one may miss a real change.

## 10. Visual check and decision

**Purpose:** Check the EA behaves as designed, then decide.

**Where:** MT5 visual mode, then TRL Research notes (record the decision and why)

**Inputs:** The candidate

**Checks:**

- **[S]** Visual testing is not available while optimising: run it as a single test. *(Source: [MetaTrader 5 Help: Strategy Testing](https://www.metatrader5.com/en/terminal/help/algotrading/testing).)*
- **[C]** Run a demo forward period before going live.
- **[U]** How long the demo period lasts. Longer is more evidence, at the cost of time.

## Not in TRL yet

- A per-window comparison table for step 4.
- Rolling walk-forward optimisation (re-optimising for each window).
- Significance statistics and a minimum-trade warning.
- Modelling spread, slippage or execution delay inside TRL (today: What-If's fixed cost per trade).
- Bootstrap Monte Carlo (resampling with replacement); today TRL reorders the actual trades.
- Importing demo or live account statements to track real forward results.
- A checklist in Research notes that tracks steps 0–10.
- A cost breakdown view; TRL's closed-trade figures also leave out commissions charged when positions open.
