# Optimisation checklist: seven steps, mapped to TRL

<!-- Generated from plugin/src/components/help/optimisation-checklist.ts; edit that file, not this one. -->

A seven-step checklist for tuning an EA's inputs without trusting one lucky backtest. It follows your MT5 optimisation tutorial, with each step mapped to the TRL tool that does it and to the matching Research workflow step.

Where the tutorial's wording differs from MT5's documentation or TRL's sources, this version follows the source, and its rules of thumb are shown as your own thresholds.

**Labels:** **[S]** Sourced fact · **[W]** Your workflow choice · **[C]** TRL suggestion · **[U]** Your own threshold.

## 1. Baseline backtest

**Question:** Is there any edge at all?

**In TRL:** MT5 single test with "Every tick based on real ticks", then TRL Data & import (.set check), Overview and Analysis; the TRL equity logger for floating drawdown (In TRL)

**Research workflow:** step 0, 3

- **[S]** Before reading any number, confirm the report's own Settings show the symbol, dates and inputs you intended. TRL's .set check lists every input that differs. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** With real ticks the spread can change within a minute; generated ticks use one fixed spread per minute bar. *(Source: [MetaTrader 5 Help: Real and Generated Ticks](https://www.metatrader5.com/en/terminal/help/algotrading/tick_generation).)*
- **[S]** In "1 minute OHLC" and "Open prices only", stop loss, take profit and pending orders fill at exactly the requested price, so fast modes are a first screen only. *(Source: [MetaTrader 5 Help: Testing Features](https://www.metatrader5.com/en/terminal/help/algotrading/testing_features).)*
- **[S]** Profit Factor = gross profit ÷ gross loss; Recovery Factor = profit ÷ maximum drawdown. *(Source: [MetaTrader 5 Help: Testing Report](https://www.metatrader5.com/en/terminal/help/algotrading/testing_report).)*
- **[S]** Equity Drawdown Maximal is the drop from the highest local equity value to the next lowest equity value. It includes floating losses but is measured from an equity peak, so it is not simply the worst floating loss. *(Source: [MetaTrader 5 Help: Testing Report](https://www.metatrader5.com/en/terminal/help/algotrading/testing_report).)*
- **[S]** Balance moves only when trades close. An averaging, grid or DCA EA can show a calm balance curve while equity is deep underwater; compare the two drawdowns. TRL shows both once an equity log is attached. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[U]** The Profit Factor you treat as too fragile, and the minimum number of trades. The tutorial's rules of thumb have no published source; a higher bar rejects more noise but also more slow EAs.
- **[S]** On Analysis, "Is the average trade distinguishable from zero?" tests the average closed trade and shows its confidence interval; if the interval includes zero, the report cannot separate a small edge from none. *(Source: [NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.5.2 Confidence Limits for the Mean](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm).)*
- **[S]** The same section checks that wins and losses are in random order; if they are not, the usual statistical tests are invalid and TRL says so. *(Source: [NIST/SEMATECH e-Handbook of Statistical Methods, 1.2.5.1 Consequences of Non-Randomness](https://www.itl.nist.gov/div898/handbook/eda/section2/eda251.htm).)*

## 2. Optimise, then check for a cliff

**Question:** Which settings work, and is that a stable plateau or a lucky spike?

**In TRL:** MT5 optimisation, then TRL Parameters: the trade-off frontier, the neighbourhood check, and a neighbourhood .set to run a denser grid in MT5 and attach (In TRL)

**Research workflow:** step 5, 6

- **[S]** The slow complete algorithm tests every combination and is the most precise; the fast genetic algorithm is much faster and described by MetaQuotes as almost the same quality. MT5 switches to genetic automatically only for very large searches. *(Source: [MetaTrader 5 Help: Optimization Types](https://www.metatrader5.com/en/terminal/help/algotrading/optimization_types).)*
- **[S]** The more combinations you try, the more likely the best in-sample result is overfit, so optimise few inputs (qualitative; no number is taken from this source). *(Source: Bailey, Borwein, López de Prado, Zhu (2014), "Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest Overfitting on Out-of-Sample Performance", Notices of the AMS 61(5).)*
- **[S]** A strong optimum can sit right next to a poor one. Test a denser grid around it and confirm a stable plateau, not an isolated spike. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[C]** The neighbourhood check on Parameters shows what share of the tested neighbours were profitable and the worst neighbour's equity drawdown; this is the tutorial's count of losing combinations.
- **[W]** Compare candidates by Profit Factor or Recovery Factor, not by net profit alone.
- **[U]** How many losing neighbours, or how large a swing between neighbouring settings, you accept. A strict limit keeps only very flat regions; a loose one accepts sharper peaks.

## 3. Out-of-sample test

**Question:** Does it still work on data the optimiser never saw?

**In TRL:** An MT5 Forward period in the optimisation, paired on TRL Parameters; or an MT5 single test of the unchanged settings on the held-back dates, imported on Data & import (In TRL)

**Research workflow:** step 1, 5, 9

- **[S]** MT5 describes forward testing as a way to avoid fitting parameters to one part of the history. *(Source: [MetaTrader 5 Help: Strategy Testing](https://www.metatrader5.com/en/terminal/help/algotrading/testing).)*
- **[S]** A single in-sample window is not validation: a clean result can hide an adverse episode the window did not contain. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[W]** Run the chosen settings unchanged on the held-back dates. If the result collapses, do not re-optimise on all the data and call it fixed.
- **[C]** If your history allows, also test a period before the in-sample window. Settings that only work after the period they were tuned on may be fitted to one market regime.
- **[U]** How much history to hold back. More held-back data gives a fairer test but leaves less for optimising.

## 4. Same settings over time

**Question:** Does it hold in most periods, not only in total?

**In TRL:** TRL Analysis → "Same settings over time (windows)": split one long report, or compare separate window reports of the same settings (In TRL)

**Research workflow:** step 4

- **[S]** With fixed settings, look at the result in each window, not only the total. One losing window out of five is a different risk from none. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[S]** Walk-forward analysis re-optimises on each in-sample window and tests on the next unseen one. Running fixed settings through consecutive windows is a different check (stability over time); the tutorial calls it walk-forward. Rolling walk-forward optimisation is not in TRL yet. *(Source: Pardo, R. (2008), The Evaluation and Optimization of Trading Strategies, 2nd ed., Wiley.)*
- **[W]** Half-year windows.
- **[C]** For every losing window, find out what was different about the market before trusting the settings.
- **[U]** How many losing windows you accept. A strict rule rejects more EAs that are fine over the full period.

## 5. Monte Carlo

**Question:** How much of the result depends on the order the trades happened in?

**In TRL:** TRL Advanced → Monte Carlo: reorder the actual trades, resample them, or resample blocks of consecutive trades (In TRL)

**Research workflow:** step 7

- **[S]** Reshuffling trades measures ordering risk only, not total risk. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[C]** Reordering the same trades never changes the final total, only the path, because a sum does not depend on order. It gives the drawdown spread (median, 95th percentile, worst), not the chance of ending negative.
- **[S]** The chance of ending negative needs resampling with replacement (a bootstrap), where some trades are drawn more than once and others not at all. Choose "Resample" on the Monte Carlo panel. *(Source: [NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.3.4 Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm).)*
- **[S]** When trades depend on each other (streaks, DCA or grid baskets), "Resample in blocks" keeps consecutive trades together; the block length is your own choice. *(Source: [Künsch, H. R. (1989), "The Jackknife and the Bootstrap for General Stationary Observations", The Annals of Statistics 17(3), 1217–1241](https://doi.org/10.1214/aos/1176347265).)*
- **[S]** The bootstrap is least reliable in the tails, so read the 99th percentile and the worst path with care. *(Source: [NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.3.4 Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm).)*
- **[C]** Neither method can create a loss larger than the worst one in the data. For DCA or grid EAs, trades in one basket depend on each other, so treating them as independent can understate risk: read the result as a lower bound.
- **[C]** TRL's closed-trade P/L includes the commission and swap MT5 books on each closing deal; commissions charged when positions open are not yet included.
- **[U]** How many paths to run. More paths give steadier percentiles but take longer.

## 6. Combined portfolio

**Question:** Do the symbols diversify each other, or lose at the same time?

**In TRL:** TRL Portfolio: up to 10 reports as tracks over the same dates, combined into one realised balance (Partly in TRL)

**Research workflow:** step 3

- **[S]** A low correlation number is not enough: two symbols can still share an overlapping drawdown during one event. Build the combined curve and measure it. *(Source: MT5 Backtesting & Optimization Best Practices (TRL's internal playbook, written from confirmed MT5 failure cases).)*
- **[W]** Test every candidate symbol over the same dates, then check whether adding it makes the combined drawdown smaller or larger.
- **[C]** TRL combines realised balance only, so floating losses are not in the combined curve. Combining equity logs is not in TRL yet.
- **[C]** Each backtest ran with its own full deposit, so the combination does not show shared margin or a stop-out on one account.
- **[U]** How much the combined drawdown must improve for a symbol to earn its place.

## 7. Demo, then go live small

**Question:** Does it behave live as it did in the simulation?

**In TRL:** An MT5 demo account; record the comparison in your Experiment note (Outside TRL (MT5 and your notes))

**Research workflow:** step 9, 10

- **[W]** Run the final settings on a demo account and compare trade frequency, win rate, and behaviour around news, spread widening and weekend gaps with the backtest. Then start with less money than feels necessary.
- **[C]** Importing demo or live statements to compare them in TRL is not in TRL yet.
- **[U]** How long the demo runs and how closely it must match the backtest. Longer is more convincing but delays the decision.
