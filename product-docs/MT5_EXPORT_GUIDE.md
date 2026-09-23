# Exporting from MetaTrader 5 for TRL

TRL reads the files MetaTrader 5's Strategy Tester already produces. It copies
each file unchanged and records its SHA-256 hash. It never edits your
originals.

| What you want to do in TRL | Export from MT5 | File |
| --- | --- | --- |
| Analyse one backtest; combine EAs in Portfolio Lab | Backtest report | `.xlsx` |
| Parameter exploration | Optimisation results | `.xml` |
| Show your default settings and parameter ranges | EA inputs | `.set` |
| Place your default settings on the field | A single test of the default settings | `.xlsx` |
| Out-of-sample (forward) check | Forward optimisation results | `.xml` |

## Backtest report (`.xlsx`)

1. Run a single test in the Strategy Tester.
2. On the **Backtest** tab, right-click and save the report as an Excel
   (`.xlsx`) report.

Use the same account currency for every report you plan to combine. Portfolio
Lab refuses to mix currencies.

## Optimisation results (`.xml`)

1. Run the optimisation.
2. On the **Optimization results** tab, right-click and choose the export to
   XML (Excel).

The export title contains the EA, symbol, timeframe, and dates. TRL uses the
title to check that exports belong together, so keep the default title.

MT5 does not write the **modelling mode** (for example "1-minute OHLC" or
"Every tick") into the XML. TRL asks you for it, so note it when you run the
optimisation.

## EA inputs (`.set`)

On the **Inputs** tab, right-click and **Save** the inputs as a `.set` file.
Save them *before* you change anything for the optimisation, so the file holds
your default values together with the start, step, and stop ranges. TRL uses it
to:

- mark your default settings (★) on the parameter field
- show how much of the possible parameter grid was actually tested

## Placing your default on the field

MT5's fast genetic optimisation tests only a sample of all combinations, so
your default settings are often not among the tested passes. To place the
default on the field anyway:

1. Run a single test with the default settings, using the same symbol,
   timeframe, dates, deposit, and modelling mode as the optimisation.
2. Save its `.xlsx` report.
3. On TRL's Parameters page, use **Attach a single-test report…**.

TRL checks every input in that report against your `.set` file.

## Forward (out-of-sample) results

Forward results show how each setting did on later data that was not used to
choose it.

**Recommended:** in the Strategy Tester settings, choose a **Forward** period
before you optimise. MT5 then re-tests the *same* settings on the forward
period. Export both the **Optimization results** and the **Forward results**
tabs to XML, and on the Parameters page use **Attach forward results
(.xml)…**. Every tested setting then gets a forward result.

**Two separate optimisations** (one on the in-sample dates, another on the
later dates) also work, but they pair poorly. The genetic optimiser picks
different settings in each run, so often only a small fraction of settings
appear in both.

TRL reads the dates from both export titles:

- It warns you when the forward period overlaps the in-sample period. Such
  results are **not** out-of-sample evidence.
- It refuses to pair exports for a different EA, symbol, or timeframe, or
  exports that vary different inputs.

## What TRL does not know from MT5 reports

- **Floating (open-position) losses.** MT5 reports record closed trades and
  report-level drawdown figures, not the equity curve. For DCA, grid, or
  martingale EAs the real equity drawdown can be much larger than the
  closed-trade balance suggests.
- **Your intentions.** TRL marks trade-offs (the Pareto frontier) but never
  picks a "best" setting. You choose, and TRL records your reason.
