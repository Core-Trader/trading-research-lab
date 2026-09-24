# Proposal: significance statistics and a minimum-trade warning

**Status:** APPROVED and BUILT 2026-09-24 (the owner accepted G1–G7 as recommended and asked that interpretation and tips rest on verifiable sources).

**Built:**
- Core `significance.py` (`significance-1`): Student t via the regularised incomplete beta, the t-test, the interval, the runs test, and lag-1 autocorrelation; worker `analysis.significance` and `analysis.render_significance_note`.
- Plugin: the Analysis widget "Is the average trade distinguishable from zero?" with an interval strip and labelled, sourced guidance (`significance-model.ts`); the Overview trade-count line; the thresholds store (minimum trades, confidence) in the plugin settings and the settings tab; trade filters pre-filled on Windows, Symbol scan, and Parameters; Record to note.
- Added sources: NIST 1.3.5.2, 1.2.5.1, 1.3.5.13, 1.3.5.12, and the ASA statement (Wasserstein & Lazar 2016).

This is workflow gap 2 of 8 in the Research workflow guide's "Not in TRL yet"
list. The sources are in `internal/references/REFERENCE_REGISTER.md`.

## Why

A Profit Factor of 20 on 15 trades is not a stronger edge than 2 on 300. The
playbook, the Optimisation checklist, and the Research workflow all say to
read ratios next to the trade count. TRL shows the count but never says when
a result is too thin, or whether the average trade is distinguishable from
zero.

## What TRL would add

1. **"Is the average trade distinguishable from zero?"** A new widget on
   Analysis, with a one-line summary on the Overview's trade-count tile.
   - **t-statistic** of the mean close-event net P/L (commission and swap
     included, as SQN):
     - T = mean ÷ (s ÷ √N), with N − 1 degrees of freedom (NIST 1.3.5.2)
     - this equals the uncapped SQN TRL already shows (Tharp); the page
       says so, so the two numbers are not read as independent evidence
   - **One-sided p-value** for "the mean is above zero", and a
     **confidence interval** for the mean trade at the user's chosen
     confidence level (G2).
   - Both come from the Student t distribution, implemented in the Core
     without new dependencies, and tested against published table values.
2. **Randomness check next to it:**
   - a runs test on the sequence of wins and losses (NIST 1.3.5.13)
   - lag-1 autocorrelation of the trade results, shown as a descriptive
     number only (NIST 1.3.5.12 gives no cut-off)
   - if the runs test rejects randomness, the p-value and interval are shown
     as **"not valid for this report"**, because NIST 1.2.5.1 says the usual
     tests are then invalid
   - below the runs test's large-sample condition (fewer than 11 wins or 11
     losses), the check reads "too few trades to check"
3. **Standing caveats, always shown:**
   - "If this report is the best of many tested settings, the p-value
     overstates the evidence" (Bailey et al. 2014, qualitative).
   - "For DCA or grid EAs, trades within one basket depend on each other"
     (TRL suggestion).
4. **Minimum-trade warning:**
   - one number, **your minimum trades**, set in TRL's settings and empty
     by default, so the warning is off until you set it
   - where a result rests on fewer trades, TRL shows "Fewer trades than your
     minimum (N of M)" next to the ratios on the Overview, Analysis, Windows
     (per window), Symbol scan (per symbol), and Parameters (per candidate)
   - pages that already have a trade filter (Symbol scan, Parameters,
     Windows) pre-fill it from the setting, and it stays editable
5. **Record:** the widget can write "Significance checked" into the
   Experiment note through the Record-to picker.

## Not included

These are listed so they are not assumed:
- Deflated or Probabilistic Sharpe ratios: their papers were not re-read and
  no source is registered.
- Multiple-testing corrections with a number of trials: TRL does not know
  how many settings were tried before a single report.
- Any "significant / not significant" verdict at a fixed level.

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| G1 | Show the t-statistic, a one-sided p-value, and a confidence interval for the mean trade, on close-event net P/L | **Yes** |
| G2 | The confidence level is your choice (90 / 95 / 99 %); no level is presented as "the" standard | **Yes, 95 % preselected as your workflow choice** (a convention, not a sourced threshold) |
| G3 | A runs test gates validity: if randomness is rejected at your level, the p-value and interval read "not valid for this report"; lag-1 autocorrelation is descriptive only | **Yes** |
| G4 | Standing caveats for multiple testing (Bailey) and for dependent basket trades | **Yes** |
| G5 | A global "minimum trades" setting, empty by default (warning off); warnings on the Overview, Analysis, Windows, Symbol scan, and Parameters; existing trade filters pre-fill from it | **Yes** |
| G6 | Placement: an Analysis widget (movable with Customise layout) plus a one-line summary on the Overview trade-count tile | **Yes** |
| G7 | Record "Significance checked" to the Experiment note | **Yes** |

## Build order

1. The Core `significance.py`: the t distribution, the t-test, the
   confidence interval, the runs test, and autocorrelation, with tests
   against NIST and table values. Then the worker method
   `analysis.significance`.
2. The Analysis widget and the Overview line.
3. The minimum-trade setting and warnings across the pages.
4. Record to the note; the Help guides updated (remove the gap, and cite the
   NIST sources in steps 3 and 4 of the Research workflow and step 1 of the
   checklist).

## Remaining gaps, in the suggested order after this

1. Bootstrap Monte Carlo (resampling with replacement), which gives the
   "% ending negative" statistic.
2. Combining equity logs in Portfolio.
3. A cost breakdown view, and commissions charged when positions open.
4. Modelling spread, slippage, or execution delay (today: What-If's fixed
   cost).
5. A Research notes checklist that tracks steps 0–10.
6. Importing demo or live statements.
7. Rolling walk-forward optimisation (re-optimising for each window). This is
   the largest; it depends on MT5 runs per window.
