# MVP Tier C2 — Van K. Tharp Concepts (R-multiples, Expectancy, SQN)

**Status:** DRAFT for owner review, 2026-09-22. No implementation is authorised
until decisions T1–T7 (§8) are answered.
**Depends on:** `MVP_TIER_C_PERFORMANCE_METRICS.md` (C1): the same close-event
basis, precision rule (8 dp `ROUND_HALF_EVEN`), and presentation rules.
**External code:** none. The concepts come from Van K. Tharp's published work
(for example *Trade Your Way to Financial Freedom*, *The Definitive Guide to
Position Sizing*, and the SQN® concept). The definitions below are TRL's own;
"SQN" is used descriptively. Owner decision T7 covers naming.

## 1. Concepts and TRL position

| Tharp concept | What it is | TRL position |
| --- | --- | --- |
| **R** (initial risk) | The amount risked on a trade: entry-to-stop distance × position value | Needs a 1R source; see §3 |
| **R-multiple** | Trade result ÷ 1R | In scope with a declared or inferred 1R |
| **R-multiple distribution** | The system described as a distribution of R-multiples | In scope: Core-binned histogram |
| **Expectancy (R)** | Mean R-multiple per trade | In scope |
| **SQN** | `√N × mean(R) / stdev(R)`; later versions cap N at 100 | In scope; see §4 on scale invariance |
| **Opportunity / "expectunity"** | Expectancy × number of trades per period | In scope as a descriptive rate (T5) |
| **SQN quality bands** ("poor" … "holy grail") | A verdict on the system | **Excluded**: no scoring or verdicts (selection deferral) |
| **Position sizing to objectives**, risk of ruin | Money-management simulation | **DEFERRED — POST-MVP** (money management is deferred) |
| **Monte Carlo on the R-distribution** | Resampling R-multiples | Later M6 method (resampling is not yet approved) |

## 2. Evidence constraints (verified against a real report, 2026-09-22)

- MT5 Strategy Tester Excel reports contain an **Orders** table with `S / L`
  and `T / P` columns, and **Deals** carry an `Order` reference. TRL currently
  imports Deals only.
- Stop levels are **prices**. Converting a stop distance to money needs tick
  value and contract size, which are **not** in the report. They could only be
  inferred from closing deals (profit ÷ price move ÷ volume), which is an
  `INFERRED` derivation.
- Stops can be absent (`0`), moved after entry (only the order's S/L is shown),
  or shared across multiple entries (DCA/grid systems such as the reviewed
  report). A single close event is then not one planned-risk trade.

Therefore **no MT5-verified 1R exists today**. Every R value must carry the
quality label of its 1R source.

## 3. 1R sources

| Source | Definition | Quality label | Status |
| --- | --- | --- | --- |
| **A. Declared fixed risk** | The user states one currency amount per close event (for example 100 USD), like the What-If cost | `USER_SUPPLIED` | Proposed for C2 |
| **B. Average-loss proxy** | `1R = |average loss|` of verified close events (Tharp's suggestion when stops are unknown) | `INFERRED` | Proposed for C2 |
| **C. Per-trade stop from Orders** | `(|entry − S/L|) × volume × inferred tick value`, linked via `Order` | `INFERRED` (tick value and linkage) | **Later**: needs an Orders adapter spec, order↔deal linkage rules, and DCA handling |

The R-multiple of close event k is `R_k = net_pnl_k / 1R`. With sources A and B,
1R is a constant.

## 4. Definitions

Using `R_1 … R_N` (close-event basis, source order):

- **Expectancy (R)** = `mean(R)`; `null` if `N = 0`.
- **Standard deviation (R)** = sample standard deviation (`N − 1`, T3); `null`
  if `N < 2`.
- **SQN** = `√N × mean(R) / stdev(R)`; `null` if `N < 2` or `stdev = 0`.
- **SQN (N capped at 100)** = `√min(N, 100) × mean(R) / stdev(R)` (T1).
- **Scale invariance:** with a constant 1R (sources A and B), `mean/stdev` is the
  same in R or in currency, so **SQN does not depend on the 1R choice** and can
  be computed from close-event P/L alone. TRL returns SQN whenever N ≥ 2 and
  states this invariance.
- **R histogram:** fixed bins of 0.5R from −3R to +5R, with underflow (< −3R)
  and overflow (≥ +5R) buckets; bin edges are lower-inclusive (T4). Counts only.
- **Opportunity** = close events per 30 report-clock days
  (`N / (t_last − t_first in days) × 30`); `null` if the span is 0 (T5).
- **Expectunity** = `expectancy (R) × opportunity` (R per 30 days); `null` if
  either is `null`.
- **Largest win / loss in R** and the **share of total P/L from the top 5
  close events** (a fragility indicator, descriptive only).

`√` uses Python `Decimal.sqrt` at the default 28-digit context, then quantises
to 8 dp. Monetary inputs stay exact.

## 5. Interface

- Extend `analysis.performance_metrics` (C1) with an `r_metrics` block, or add a
  sibling method `analysis.r_multiple_metrics(dataset_ref, r_source, r_amount?)`.
  **Proposed:** a sibling method, so C1 stays independent of the R choice.
  Calculation version `mvp-r-multiple-metrics-1`.
- Once C2 is approved, `sqn` and `sqn_capped_100` may also be added to the C1
  method (as a new calculation version), because they need no R parameter. C1
  as approved does not include them.
- Configuration records `r_source`, the amount (A) or the derived proxy (B)
  with its quality label, the histogram policy, and the precision rule.

## 6. Presentation

- Tiles: SQN (with "N = …" and "no quality band is assigned"), Expectancy (R)
  with the 1R source badge (`USER_SUPPLIED` / `INFERRED`), and Expectunity.
- The R-multiple histogram as the main visual, with a zero line and the
  expectancy marker.
- Changing the 1R source or amount reruns the Core; the plugin never rescales
  values.

## 7. Fixtures (to finalise after decisions)

| ID | Input | Expected |
| --- | --- | --- |
| R1 | P/L +200, −100, −100, +300, −100; declared 1R = 100 | R = 2, −1, −1, 3, −1; expectancy `0.40000000`; stdev `1.94935887`; SQN `0.45883147` (capped SQN identical, N < 100) |
| R2 | Same P/L, 1R = 50 | R doubles and expectancy is 0.8, **SQN identical to R1** (invariance) |
| R3 | Same P/L, proxy source | 1R = 100 (avg loss); label `INFERRED` |
| R4 | No losses, proxy source | Blocked: `E_R_SOURCE_UNAVAILABLE` (no average loss) |
| R5 | N = 1 | stdev and SQN `null` |
| R6 | N = 150, identical distribution | SQN uses √150; capped SQN uses √100 |
| R7 | Values on bin edges (−3R, 0R, +5R) | Lower-inclusive placement; +5R goes to overflow |
| R8 | Span 0 days | Opportunity and expectunity `null` |

## 8. Owner decisions

| ID | Question | Proposed default |
| --- | --- | --- |
| T1 | SQN: raw N, capped at 100, or both? | **Both**, capped shown as headline. |
| T2 | Which 1R sources in C2? | **A (declared) and B (avg-loss proxy)**; C later with an Orders spec. |
| T3 | Standard deviation convention | **Sample (N − 1)**. |
| T4 | R histogram binning | **0.5R bins from −3R to +5R** plus underflow and overflow. |
| T5 | Opportunity period | **Per 30 report-clock days**. |
| T6 | Include "share of P/L from top 5 close events"? | **Yes**, descriptive only. |
| T7 | Naming | Label "SQN (Van Tharp)" with a definition tooltip; no quality bands. |
