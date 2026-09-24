# External Reference Register

**Status:** private internal register. External source remains outside Trading
Research Lab and is never included in product artifacts merely because it was
reviewed or permission to reuse was granted.

## Permission record

The project owner reports that each repository developer/owner has granted
direct code-reuse permission. The user retains the original correspondence. No
private correspondence, credentials, or unrelated conversation data is stored
in this repository.

**Permission status:** Direct code reuse approved by repository developer/owner.

**Condition:** At the end of development, provide a complete report identifying
the external code/components actually used in Trading Research Lab.

This record does not invent, replace, or resolve formal repository licence
terms. Every actual reuse remains subject to the mandatory provenance process in
[`EXTERNAL_CODE_USAGE_REGISTER.md`](EXTERNAL_CODE_USAGE_REGISTER.md).

| Reference | Journalit | Strategy Factory |
| --- | --- | --- |
| Repository URL | https://github.com/Cursivez/journalit | https://github.com/moyger/strategy_factory |
| Owner shown by URL | Cursivez | moyger |
| Clone path | C:\DEV\TRL_External_References\journalit | C:\DEV\TRL_External_References\strategy_factory |
| Default branch | main | main |
| Approved reference commit | `098d27747df1b3a5fb177ff3a147d9a5cfbe0dcb` | `31e778a78b465ce1a0e16e232f762ebe8ca80b52` |
| Review date | 2026-09-20 | 2026-09-20 |
| Working tree at review | Clean | Clean |
| Primary TRL role | Obsidian/plugin and trading-dashboard reference | Quantitative/research implementation reference |
| Licence / reuse status | Repository licensing terms remain as observed in the pinned review; direct reuse is approved by developer/owner under the recorded final-report condition. | No repository LICENSE file was found in the pinned review; direct reuse is approved by developer/owner under the recorded final-report condition. |
| Reference use | Approved | Approved |
| Direct code reuse | Approved by developer/owner | Approved by developer/owner |
| Condition | Full final usage report required | Full final usage report required |
| Actual code reuse in TRL | None recorded | None recorded |
| Analysis status | Complete, pinned review. | Complete, pinned review. |

## Analysis records

- [Journalit architecture map](JOURNALIT_ARCHITECTURE_MAP.md)
- Journalit import pipeline concept review (2026-09-23, pinned commit `098d277`; parsing is server-side, so there is no reusable local code; concepts only): see `../docs/MT5_AUTOMATION_AND_IMPORT_REVIEW.md` §2
- [Strategy Factory architecture map](STRATEGY_FACTORY_ARCHITECTURE_MAP.md)
- [Trading Research Lab comparison and findings](TRL_REFERENCE_FINDINGS.md)
- [Authoritative code-usage register](EXTERNAL_CODE_USAGE_REGISTER.md)
- [Future final external-code usage report](EXTERNAL_CODE_USAGE_FINAL_REPORT.md)

## Future-review rule

Do not pull, update, checkout, or silently replace these baselines. If later
work uses a newer source revision, the usage record must name that exact newer
commit. Do not assume a repository's current HEAD supplied the source.

Direct reuse may be technically justified, but is never automatic. Before and
with each reuse: identify the exact repository, commit, source path and symbol;
record the entry immediately; add a concise source comment where appropriate;
validate the TRL result; and record the product scope and any dependencies. No
untracked external code reuse is permitted.

## Prop-firm rule sources (data, not code; PROP-2)

Presets in `research-core/.../prop_presets.py` copy published rule values, not
code. Each preset records its source URL and retrieval date, and the user is
told to verify against the firm's current terms.

| Source | Use | Retrieved | Notes |
| --- | --- | --- | --- |
| https://ftmo.com/en/trading-objectives/ (FTMO, primary) | FTMO 2-Step (Challenge, Verification, Account) and 1-Step (Challenge, Account) values | 2026-09-24 | Authoritative. The values and definitions came from the 1-Step and 2-Step tabs: 00:00 CE(S)T reset, balance-at-reset daily reference, "drops below", position-opened trading day, 1-Step end-of-day trailing loss, and the best-day 50% rule. The cookie banner was not accepted. |
| https://propfirmmatch.com/ (aggregator, secondary) | Finding firms, programme names, and rule-change dates | 2026-09-24 | This is an affiliate site with discount codes. Its FTMO page listed programme structure, trading days, and the best-day rule, but no loss limits. Use it for discovery and cross-checks only; take the preset values from each firm's own rules page. Non-essential cookies were declined. |
| https://fundednext.com/cfd-challenge-terms (FundedNext, primary) and Help Center articles 8019811 (daily-loss formula) and 8394309 (reset at 00:00 server time, GMT+2 or GMT+3) | FundedNext Stellar 2-Step, 1-Step, Lite, and Evaluation presets | 2026-09-24 | The Terms §5.1–§5.4 give the DLL, MLL, minimum Trading Days, and Profit Targets. The DLL and MLL are a % of the initial size; the terms say "reaches or exceeds" (§7.1); a Trading Day is one on which a trade is opened and/or closed (§4.3). The cookie banner offers only accept, so it was left untouched. |
| https://the5ers.com/high-stakes/ (The5ers, primary) | Not used | 2026-09-24 | The page gives 5% daily, 10% max, and 10%/5% targets, but not the daily-loss reference or the reset time. It counts "profitable days" (at least 0.5% closed profit), which TRL does not model. No preset until those are confirmed. "Deny" was clicked on the cookie banner. |

## Research-workflow guide sources (proposal, 2026-09-24)

These are cited in the research-workflow proposal. The MT5 pages were read on
2026-09-24.

| Source | Used for | Status |
| --- | --- | --- |
| MT5 Help, "Real and Generated Ticks": https://www.metatrader5.com/en/terminal/help/algotrading/tick_generation | Real ticks let the spread change within a minute; generated ticks use one fixed spread per minute bar; "1 minute OHLC" generates only 4 prices per minute | Read |
| MT5 Help, "Testing Features": https://www.metatrader5.com/en/terminal/help/algotrading/testing_features | In "Open prices only" and "1 minute OHLC", pending orders, SL, and TP fill at the requested price; in the accurate modes, market orders fill at current Bid/Ask (slippage possible) | Read |
| MT5 Help, "Strategy Testing": https://www.metatrader5.com/en/terminal/help/algotrading/testing | Forward testing (1/2, 1/3, 1/4, custom; the forward part is always the latest) "allows you to avoid parameters fitting"; only symbols in Market Watch can be tested; custom commissions and "Use predefined commissions"; visual testing is unavailable when optimising | Read |
| MT5 Help, "Optimization Types": https://www.metatrader5.com/en/terminal/help/algotrading/optimization_types | Slow complete vs fast genetic; genetic run count = population (64–256) × generations; the optimisation criteria | Read |
| MT5 Help, "Testing Report": https://www.metatrader5.com/en/terminal/help/algotrading/testing_report | Definitions of Profit Factor, Recovery Factor, Expected Payoff, balance and equity drawdown, and History Quality; MT5's own Sharpe bands (<0, 0–1, ≥1, ≥3) | Read |
| MT5 Help, "Platform Start": https://www.metatrader5.com/en/terminal/help/start_advanced/start | `ExecutionMode` (0 normal, -1 random delay, >0 fixed delay in ms), `ForwardMode`/`ForwardDate`, `Optimization=3` (all Market Watch symbols) | Read |
| Bailey, Borwein, López de Prado, Zhu (2014), "Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest Overfitting on Out-of-Sample Performance", *Notices of the AMS* 61(5) | Qualitative only: the more configurations tried, the more likely the best in-sample result is overfit; out-of-sample evidence is needed | **Not re-read this session.** The AMS link downloads a PDF and SSRN showed a bot check, which was not bypassed. No numbers from it are used. |
| Pardo, R. (2008), *The Evaluation and Optimization of Trading Strategies*, 2nd ed., Wiley | Qualitative only: walk-forward analysis (optimise in-sample, test on the next unseen window, roll forward) | Published book, not re-read this session; no numbers used. |
| Van K. Tharp, SQN and R-multiples (already cited in `MVP_TIER_C2_VAN_THARP_METRICS.md`) | SQN = √N × mean(R) / stdev(R) | Existing project source |
| NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.5.2 "Confidence Limits for the Mean": https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm | One-sample t: T = (Ȳ − μ₀)/(s/√N), N − 1 degrees of freedom; one- and two-sided rejection regions | Read 2026-09-24 |
| NIST/SEMATECH e-Handbook, 1.2.5.1 "Consequences of Non-Randomness": https://www.itl.nist.gov/div898/handbook/eda/section2/eda251.htm | If the randomness assumption fails, "all of the usual statistical tests are invalid" and calculated uncertainties become meaningless | Read 2026-09-24 |
| NIST/SEMATECH e-Handbook, 1.3.5.13 "Runs Test for Detecting Non-randomness": https://www.itl.nist.gov/div898/handbook/eda/section3/eda35d.htm | Z = (R − R̄)/s_R with R̄ = 2n₁n₂/(n₁+n₂) + 1 and the stated variance; reject randomness if abs(Z) > z₁₋α/₂; the normal approximation is for n₁, n₂ > 10 | Read 2026-09-24 |
| NIST/SEMATECH e-Handbook, 1.3.5.12 "Autocorrelation": https://www.itl.nist.gov/div898/handbook/eda/section3/eda35c.htm | Lag-k autocorrelation formula (no cut-off stated on that page) | Read 2026-09-24 |
| Wasserstein, R. L. & Lazar, N. A. (2016), "The ASA's Statement on p-Values: Context, Process, and Purpose", *The American Statistician* 70(2), 129–133, https://doi.org/10.1080/00031305.2016.1154108 | Six principles: a p-value indicates incompatibility of the data with a model; it does not measure the probability that the hypothesis is true; decisions should not rest only on passing a threshold; full reporting; it does not measure effect size or importance; by itself it is not a good measure of evidence | Principles read 2026-09-24 in the ASA release as reprinted by ScienceDaily (https://www.sciencedaily.com/releases/2016/03/160307092305.htm); the journal page returned 403 and the ASA PDF text could not be extracted |
| Efron, B. (1979), "Bootstrap Methods: Another Look at the Jackknife", *The Annals of Statistics* 7(1), 1–26, https://doi.org/10.1214/aos/1176344552 | The bootstrap estimates the sampling distribution of a statistic from the observed data by resampling | Abstract read 2026-09-24 (Project Euclid) |
| NIST/SEMATECH e-Handbook, 1.3.3.4 "Bootstrap Plot": https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm | Subsamples drawn with replacement (a point may appear several times or not at all); estimates the uncertainty of a statistic; caution: "not appropriate for all distributions and statistics", notably statistics heavily dependent on the tails | Read 2026-09-24 |
| Künsch, H. R. (1989), "The Jackknife and the Bootstrap for General Stationary Observations", *The Annals of Statistics* 17(3), 1217–1241, https://doi.org/10.1214/aos/1176347265 | Moving-block bootstrap for dependent observations: blocks of l consecutive observations resampled with replacement; consistency needs l → ∞ with l/n → 0 (no numeric block length) | Abstract read 2026-09-24 (Project Euclid). Politis & Romano (1994) was not reachable (403) and is not used |
| `internal/playbooks/MT5_BACKTESTING_BEST_PRACTICES.md` (owner-supplied) | .set verification, Model 4 for intrabar exits, a single window is not validation, balance vs equity, parameter cliffs, fixed-parameter walk-forward, Monte Carlo measures ordering risk, verifying each report three ways | Owner source in the repository |
