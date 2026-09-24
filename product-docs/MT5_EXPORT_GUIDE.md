# Exporting from MetaTrader 5 for TRL

TRL reads the files MetaTrader 5's Strategy Tester already produces. It copies
each file unchanged and records its SHA-256 hash. It never edits your
originals.

| What you want to do in TRL | Export from MT5 | File |
| --- | --- | --- |
| Analyse one backtest; combine EAs in Portfolio Lab | Backtest report | `.xlsx` or `.html` |
| Parameter exploration | Optimisation results | `.xml` |
| Show your default settings and parameter ranges | EA inputs | `.set` |
| Place your default settings on the field | A single test of the default settings | `.xlsx` |
| Out-of-sample (forward) check | Forward optimisation results | `.xml` |
| Compare one EA across many symbols (Symbol scan) | Symbol sweep results | `.xml` (+ optional `.set`) |

## Backtest report (`.xlsx` or `.html`)

1. Run a single test in the Strategy Tester.
2. On the **Backtest** tab, right-click and save the report as an Excel
   (`.xlsx`) report or an HTML report. TRL reads both the same way. For HTML
   it also checks that the totals row at the end of the Deals table matches
   the deals.

Reports you no longer need can be **archived** in the report library. They
disappear from the lists but are not deleted, and anything that uses them
keeps working. Restore them any time from **Archived reports**.

**Delete…** removes TRL's copy of a report permanently. TRL first shows
everything that uses it (saved combinations, study attachments, linked notes)
and asks whether to keep those or delete them too. Deleted notes go to
Obsidian's trash. Your original report file on disk is never touched.

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

## Symbol sweep (`.xml`)

A symbol sweep runs one EA, with the same inputs, once on every symbol in
Market Watch.

1. In MT5's Market Watch, show the symbols you want to test.
2. In the Strategy Tester, choose optimisation **All symbols selected in
   Market Watch**, then run it.
3. On the **Optimization results** tab, right-click and choose the export to
   XML.
4. In TRL, open **Symbol scan**:
   - import the XML
   - declare the modelling mode (MT5 does not write it into the file)
   - optionally add the `.set` you used, so the inputs are recorded

   TRL cannot confirm those were the inputs, because the sweep file lists
   none.

On the Symbol scan page you can:
- filter symbols with your own thresholds
- see the trade-off frontier
- compare up to 6 EAs' sweeps on the same symbols side by side
- record a shortlist in your Experiment note
- delete a sweep from the library: TRL first lists the research notes that
  recorded a shortlist from it, and lets you keep them (the default) or move
  them to Obsidian's trash, which can be undone; your original `.xml` file is
  never touched

TRL does not rank symbols. A sweep has no individual trades, so re-test each
shortlisted symbol as a single test before the other analyses.

## EA inputs (`.set`)

On the **Inputs** tab, right-click and **Save** the inputs as a `.set` file.
Save them *before* you change anything for the optimisation, so the file holds
your default values together with the start, step, and stop ranges. TRL uses it
to:

- mark your default settings (★) on the parameter field
- show how much of the possible parameter grid was actually tested

## Checking a report against its .set

After importing a report on the **Data & import** page, you can add the `.set`
you meant to use. TRL compares it, input by input, with the inputs the report
says actually ran, because MT5 can silently fall back to the EA's defaults or
an old preset. Differences are listed; inputs that exist on only one side are
noted.

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

## Neighbourhood runs (is my chosen setting a lucky peak?)

MT5's genetic optimiser rarely tests the settings right next to a good
result. On TRL's Parameters page, select a setting, look at **Neighbourhood**,
and use **Prepare neighbourhood .set**. TRL writes a *new* `.set` file (it
never overwrites one) that varies only the chosen inputs by ±1 or ±2 steps
and holds everything else fixed.

1. In MT5, load that `.set` on the **Inputs** tab.
2. Choose the optimisation algorithm **Slow complete algorithm** so every
   setting in the small box is tested.
3. Use the same symbol, timeframe, dates, deposit, and modelling mode as the
   original optimisation.
4. Export the results to XML and use **Attach neighbourhood run (.xml)…**.

TRL refuses a run with different dates or market, or one that does not match
a `.set` it wrote for this study.

## What TRL does not know from MT5 reports

- **Floating (open-position) losses.** MT5 reports record closed trades and
  report-level drawdown figures, not the equity curve. For DCA, grid, or
  martingale EAs the real equity drawdown can be much larger than the
  closed-trade balance suggests.
- **Your intentions.** TRL marks trade-offs (the Pareto frontier) but never
  picks a "best" setting. You choose, and TRL records your reason.
