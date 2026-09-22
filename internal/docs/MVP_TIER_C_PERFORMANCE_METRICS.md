# MVP Tier C — Performance Metrics Specification

**Status:** Approved 2026-09-22 — owner accepted all proposed defaults D1–D7.
Implementation of C1 is authorised.
**Track:** MVP Fast Track, tier C of `internal/references/DASHBOARD_UX_RESEARCH.md`.
**Depends on:** M2 verified close events (`trade_analysis.close_event_summary`),
M3 source-clock rules (`time_risk.py`), and the verified balance curve
(`analysis.basic_statistics`).
**External code:** none. The metric names are industry-standard; the
definitions below are TRL's own and are fixed by the fixtures in §8.

## 1. Purpose

Add a small set of standard performance metrics that traders expect on a
strategy dashboard, each with one written definition, one evidence basis, and
hand-computed fixtures. The Core computes every value; the plugin only displays
them.

## 2. Scope

**In scope (C1):**

| Metric | Basis |
| --- | --- |
| Whole-period maximum drawdown (amount and %), with peak, trough, and recovery points | Reported balance series |
| Drawdown (underwater) display series | Reported balance series |
| Longest stagnation (time and close events without a new balance high) | Reported balance series |
| Return / drawdown ratio | Reported balance series |
| Profit factor | Verified close events |
| Average win, average loss, payoff ratio | Verified close events |
| Expectancy (mean net P/L per close event) | Verified close events |
| Longest winning and losing streaks | Verified close events |

**Optional (C2, owner decision D5):** SQN and Z-score (runs test). They need
extra conventions (sample standard deviation, square root precision, and runs
definition) and can follow C1 without blocking it.

**Excluded:**

- Sharpe, Sortino, and CAGR. They need a return-series and annualisation policy
  that MT5 Strategy Tester reports do not settle.
- R-expectancy and R-multiples. Per-trade initial risk is not in the report.
- Equity drawdown. Intratrade equity is `UNAVAILABLE` (M3).
- StrategyQuant "stability". Its formula is proprietary.
- Any score, grade, threshold, or pass/fail verdict (deferred with selection).

## 3. Evidence bases

**Balance basis.** The `analysis.basic_statistics` balance points in
`source_sequence` order, starting with the single `OPENING_BALANCE` row. The
importer rejects any additional balance operation, so there are no deposits
or withdrawals inside a series. If a future adapter admits them, these metrics
must be blocked for that dataset until a separate cash-flow policy exists.
Rows that do not change the balance (position opens) are kept; they do not
change any result.

**Close-event basis.** The verified close events of
`close_event_summary`, with `net_pnl = profit + commission + swap`. Wins are
`net_pnl > 0`, losses `< 0`, and breakeven `= 0`. These match the M2 counts
exactly.

**Time basis.** `SOURCE_REPORTED_CLOCK` (report timestamps as supplied, no
timezone conversion), as in M3.

## 4. Definitions: balance basis

Let `B_0 … B_n` be the reported balances in source order, with `B_0` the opening
balance. Let `H_i = max(B_0 … B_i)` be the high-water mark.

**Drawdown at point i:** `D_i = H_i − B_i` (≥ 0).

**Maximum drawdown:** `MDD = max_i D_i`. The **trough** is the first `i`
achieving `MDD`. The **peak** is the first point `p ≤ trough` with `B_p = H_trough`.
If `MDD = 0`, peak, trough, and recovery are `null`.

**Maximum drawdown %:** `MDD / H_trough × 100`. It is `null` when
`H_trough ≤ 0`. This is relative to the high-water mark at the trough, not to
the opening balance.

**Recovery:** the first point `r > trough` with `B_r ≥ H_trough`. If none exists,
`recovery = null` and `recovery_status = "NOT_RECOVERED"`; otherwise
`"RECOVERED"`.

**Return / drawdown ratio:** `(B_n − B_0) / MDD`. It is `null` with reason
`NO_DRAWDOWN` when `MDD = 0`. It may be negative.

**Drawdown display series:** `{source_sequence, timestamp, drawdown, drawdown_percent}`
for every balance point (same length as the balance curve, which is already
returned in full). `drawdown_percent = D_i / H_i × 100`, or `null` when `H_i ≤ 0`.

**Stagnation.** A *new high* is a point with `B_i > H_{i−1}` (strictly
greater; equalling the previous high does not end stagnation, decision D1). A
stagnation period starts at a high-water point and ends at the next new high.
The final period, from the last new high to the last point, is included and
marked `ONGOING`.

For each period, record `start` and `end` points, `duration_seconds` (report-
clock timestamp difference), and `close_events` (verified close events strictly
after `start` and up to and including `end`). The **longest stagnation** is the
period with the greatest `duration_seconds`, with the earliest start winning
ties. Also return the period with the most `close_events`, since the two can
differ (decision D2). `duration_days = duration_seconds / 86400`, quantised per §6.
The share of the whole report period is `duration_seconds / (t_n − t_0) × 100`,
or `null` if the report period is 0.

## 5. Definitions: close-event basis

Let `x_1 … x_N` be verified close-event `net_pnl` values in source order.
`GP = Σ x_k (x_k > 0)`, `GL = Σ x_k (x_k < 0)` (≤ 0), `W` = win count, and
`L` = loss count. These are the existing M2 values.

| Metric | Definition | Undefined case |
| --- | --- | --- |
| Profit factor | `GP / |GL|` | `null`, reason `NO_LOSSES` when `GL = 0` (never "infinity"); `null`, `NO_CLOSE_EVENTS` when `N = 0` |
| Average win | `GP / W` | `null` when `W = 0` |
| Average loss | `GL / L` (negative) | `null` when `L = 0` |
| Payoff ratio | `average win / |average loss|` | `null` if either is `null` |
| Expectancy | `Σ x_k / N` (mean net P/L per close event, breakeven included) | `null` when `N = 0` |
| Longest winning streak | Maximum run of consecutive `x_k > 0`, with its count, sum, and first/last `source_sequence` | `0` / `null` when no wins |
| Longest losing streak | Maximum run of consecutive `x_k < 0`, same fields | `0` / `null` when no losses |

A breakeven event (`x_k = 0`) **ends** both winning and losing streaks.

"Expectancy" here is only the arithmetic mean net P/L per verified close event.
It is equivalent to `win_rate × average_win + loss_rate × average_loss` and is
not an R-based or forward-looking estimate (decision D6).

## 6. Numeric representation and precision

- Monetary sums and differences (`MDD`, `D_i`, `GP`, `GL`, and streak sums) are
  exact `Decimal` values in source precision, as today.
- Quotients (percentages, ratios, averages, expectancy, and `duration_days`)
  are **quantised in the Core** (decision D4). Proposed: 8 decimal places,
  `ROUND_HALF_EVEN`, always rendered with exactly 8 decimal places, and recorded
  in the configuration as `"quotient_precision": "8dp ROUND_HALF_EVEN"`. The plugin keeps displaying
  2 decimal places with the exact Core string on hover.
- Existing M2/M3 fields (`win_rate`, `maximum_drawdown_percent`) are **not**
  changed by this package. Quantising them would change existing calculation
  versions and is a separate decision.

## 7. Core interface and storage

- New worker method `analysis.performance_metrics(dataset_ref)`, calculation
  version `mvp-performance-metrics-1`, policy `performance-metrics-v1`.
- The response contains `balance_metrics`, `close_event_metrics`,
  `drawdown_series`, `stagnation_periods` (bounded: the longest by time, the
  longest by events, and the `ONGOING` period, not every period), the
  configuration and its hash, `time_basis`, and warnings stating the bases and
  that equity is unavailable.
- Like `analysis.close_event_display_series`, no artifact is written: results
  are a deterministic function of the canonical dataset plus the calculation
  version. **Report embedding is out of scope**; including these metrics in a
  generated Report note is a later, separate change to `report.prepare_payload`.
- Structured errors: `E_DATASET_INVALID` for non-ISO timestamps or an unsorted,
  empty, or multi-opening-balance dataset. A dataset with zero close events
  returns balance metrics and `null` close-event metrics with reasons.

## 8. Fixtures (hand-computed; each becomes a pytest case)

Quotients below are written mathematically; the Core string always has exactly
8 decimal places (for example 42.5 is `42.50000000`, and 2.30769230… is
`2.30769231`). All fixtures use opening balance `1000` (except F9) and USD. Balances are the running sum
of close-event net P/L unless stated.

| ID | Close-event net P/L sequence (timestamps) | Expected results |
| --- | --- | --- |
| F1 basic | +100, −50, −80, +200 (daily from 2026-01-05) | Balances 1100, 1050, 970, 1170. MDD 130 at 970; peak 1100; % = 11.81818182; recovered at 1170. Return/DD = 170/130 = 1.30769231. PF = 300/130 = 2.30769231. Avg win 150, avg loss −65, payoff 2.30769231. Expectancy 42.5. Win streak 1 (twice; first chosen), loss streak 2 (−130). |
| F2 no losses | +10, +20, +30 | MDD 0 (peak/trough/recovery null). Return/DD null `NO_DRAWDOWN`. PF null `NO_LOSSES`. Avg loss null; payoff null. Win streak 3 (+60). |
| F3 never recovers | +50, −100, +20 | MDD 100 (1050 → 950), `NOT_RECOVERED`. Final stagnation `ONGOING` from the 1050 point to the last point. |
| F4 equal high | +50, −50, +50, +10 | Returning to 1050 does **not** end stagnation (D1); the period ends at 1060. MDD 50. |
| F5 ties | +50, −50, +50, −50 | Balances 1050, 1000, 1050, 1000. MDD 50; the trough is the **first** 1000 point (source order) and recovery is the second 1050 point. Only one new high (the first 1050), so there is one stagnation period from it to the end, marked `ONGOING`. |
| F6 breakeven | +10, 0, +10, −5, 0, −5 | Breakeven counts in N (6) and in expectancy (10/6 = 1.66666667) and breaks streaks: longest win streak 1, longest loss streak 1. |
| F7 opens interleaved | F1 with a `POSITION_OPEN` row (balance unchanged) before each close | Identical results to F1. |
| F8 single close | −20 | MDD 20, `NOT_RECOVERED`. PF = 0 / 20 = `0.00000000` (a loss exists, so it is defined). Avg win null; payoff null. Expectancy `-20.00000000`. Loss streak 1. |
| F9 non-positive high | Opening balance 0, then −10 | MDD 10; MDD % null (high-water ≤ 0). |
| F10 stagnation time vs events | Two stagnation periods: one spans 30 days with 2 close events, the other 3 days with 8 close events | Longest-by-time and longest-by-events are different periods and both are returned. |
| F11 precision | P/L producing repeating quotients (for example 100/3) | Quotients quantised to 8 dp `ROUND_HALF_EVEN`; sums stay exact. |
| F12 determinism and immutability | F1 twice in fresh workspaces | Byte-identical JSON; canonical dataset unchanged. |
| F13 reconciliation | Any fixture | `expectancy × N` equals `net_pnl` within the quantisation step; `GP + GL = net_pnl`; the last drawdown point equals `H_n − B_n`. |

## 9. Owner decisions required

| ID | Question | Proposed default |
| --- | --- | --- |
| D1 | Does reaching the previous high exactly end a stagnation period? | **No**: only a strictly higher balance ends it. |
| D2 | Stagnation length: time, close events, or both? | **Both**, with longest-by-time as the headline. |
| D3 | Profit factor with no losing close events | `null` with reason `NO_LOSSES` (shown as "No losses"), never infinity. |
| D4 | Precision of Core quotients | 8 dp `ROUND_HALF_EVEN` in the Core; the plugin shows 2 dp. |
| D5 | Include SQN and Z-score now (C2) or later? | **Later**: C1 first. |
| D6 | Label for mean P/L per close event | "Expectancy (avg per close event)", with the definition on hover. |
| D7 | MDD % denominator | High-water mark at the trough (industry convention), not the opening balance. |

## 10. Plugin presentation (after Core acceptance)

- KPI tiles: Max drawdown (amount and %, peak→trough dates), Profit factor,
  Expectancy, Avg win / avg loss, Longest stagnation (days and close events,
  `ONGOING` flagged), and Return / drawdown.
- A drawdown (underwater) chart directly under the balance curve on the same
  x-axis, plus a shaded band on the balance curve for the longest stagnation.
- Streaks shown in the close-event P/L card.
- Every tile states its basis ("balance" vs "close events"). Undefined values
  show their reason ("No losses", "No drawdown"), never 0 or ∞.

## 11. Acceptance criteria

1. Every fixture in §8 passes as a pytest case with exact expected strings.
2. Results are byte-identical for the same dataset and calculation version.
3. The canonical dataset and existing artifacts are unchanged.
4. Existing M2/M3/M6 outputs are unchanged (full suite passes, version pins hold).
5. The plugin performs no calculation; plugin tests cover the undefined-value
   presentation.
6. Owner visual review in Obsidian with a representative report.
