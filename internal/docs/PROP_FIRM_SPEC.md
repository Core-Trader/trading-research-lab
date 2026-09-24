# Prop-firm rule check: specification

**Status:** APPROVED 2026-09-24 (owner accepted P1–P10 as recommended).

Implementation notes:
- Core: `day_boundary.py` (shared; `equity_metrics` uses it) and
  `prop_check.py`, with `prop.list_profiles`, `prop.save_profile`,
  `prop.delete_profile`, and `prop.evaluate`. Tests are in
  `test_prop_check.py` (F1–F9).
- The IANA zones come from the `tzdata` package (Apache-2.0), because
  Windows has no system tz database. It is recorded in
  `THIRD_PARTY_LICENSES.md`.
- The report-clock zone is passed with each evaluation (the plugin
  remembers it per report), not stored on the report.
- An interval's low counts on the day of its `equity_min_time`.
- Trailing floors rise only from earlier samples: a peak and a trough in
  one interval are not combined in an unknown order.
- For portfolios, the logs' final balance can differ from Portfolio Lab's
  close-event total by opening-deal costs. This is reported as a NOTE, and
  the check uses the logs.
- F10 (2026-09-24): on the logged DCA V3 run with a 5%/10% sample profile,
  the worst daily loss (93.41) and the overall headroom (9 987.49) match an
  independent hand calculation from `equity.parquet`.

**PROP-2 amendment (2026-09-24):** firm presets are allowed. They are
editable, sourced, and dated; see `prop_presets.py` and
`REFERENCE_REGISTER.md`. The new profile options are:
- `trading_day_definition`
- `limit_touch_counts` (FTMO breaches only *below* a limit)
- `best_day_max_percent` (FTMO 1-Step: a best day of at most 50%)

The challenge pass point is now the first sample at which the target, the
minimum trading days, and the best-day share all hold together. Two new
outcomes cover the failures: `BEST_DAY_RULE_NOT_MET` and
`OBJECTIVES_NOT_MET_TOGETHER`.

**P8 rolling starts implemented (2026-09-24):** `prop_rolling.py` and
`prop.rolling_starts`:
- one start per day with data, shifted to the account size (not rescaled)
- each start is followed to its first decision: PASSED, BROKEN,
  POSSIBLY_BROKEN, OUT_OF_TIME, SURVIVED (profiles without a target, a
  30-day default horizon), or NOT_DECIDED
- the summary gives the success share of decided starts and the
  nearest-rank median days to pass or to breach
- starts overlap and share one history, so the share is descriptive, not a
  probability

**Chained phases (2026-09-24, PROP-4):** `prop.chain_starts` takes 2 or 3
profiles, in order. Every phase except the last needs a profit target, and
all phases use the same account size. Each phase after a pass starts on the
next day with data, shifted to the account size.
- Final outcomes: COMPLETED, FAILED (with the phase), POSSIBLY_FAILED, or
  NOT_DECIDED
- A final funded phase without a target counts "survived" as completing it

**Builds on:**
- M3-POL-003: broker and prop-firm rules are optional, versioned overlays,
  never hard-coded policy
- PL-006: equity evidence comes before this module; a realised-balance-only
  check is labelled an optimistic preview
- PL-008 / E6: the combined portfolio equity low is the sum of per-track
  interval minima, a conservative bound that prop checks use by default
- PL-005: no rescaling or weights
- `EQUITY_LOGGER_SPEC.md` §3.5, `PORTFOLIO_LAB_SPEC.md` §6, and the existing
  `analysis.equity_metrics` daily-loss output (`mvp-equity-metrics-2`)

## 1. Purpose and limits

The module answers one question: **would this backtest (one report, or a
Portfolio Lab combination) have broken the rules I enter, and if so when and
by how much?** It also shows how close it came when it did not break them
(the headroom).

It is descriptive, like the rest of TRL:
- It checks a past run against rules the user types in. It does not predict
  whether a live challenge will pass.
- TRL ships **no firm-named presets** (P1). Firms change their rules, and a
  preset that looks official but is out of date would mislead. The user
  enters the numbers from their firm's current terms, and each profile shows
  "values entered by you on <date>".
- Rules that need data TRL does not have are out of scope: news-trading
  windows, lot or exposure caps, copy-trading or hedging bans, and IP or
  device rules.

## 2. Rule profile (user-supplied, versioned JSON)

A profile is a small JSON document in the worker workspace
(`prop-profiles/<profile_id>.json`), content-hashed like other
configurations. Every evaluation cites the profile id and hash.

| Field | Values | Notes |
| --- | --- | --- |
| `name` | text | the user's label, e.g. "My 100k two-step, phase 1" |
| `account_size` | decimal | must equal the report's opening balance or the combination's declared capital (P6) |
| `daily_loss_limit` | amount or % | optional |
| `daily_loss_basis` | `INITIAL_BALANCE` \| `START_OF_DAY_REFERENCE` | what the % applies to |
| `start_of_day_reference` | `BALANCE` \| `HIGHER_OF_BALANCE_AND_EQUITY` \| `EQUITY` | the value at reset that the day's loss is measured from |
| `overall_loss_limit` | amount or % of `account_size` | optional |
| `overall_loss_mode` | `FIXED` \| `TRAILING` \| `TRAILING_LOCKS_AT_START` | fixed: floor = start − limit; trailing: floor follows the high-water mark; lock: trailing until the floor reaches the starting balance, then fixed |
| `trailing_reference` | `BALANCE_HIGH` \| `EQUITY_HIGH` \| `END_OF_DAY_BALANCE_HIGH` | only for trailing modes |
| `profit_target` | amount or % | optional |
| `minimum_trading_days` | integer | a trading day = a day with at least one deal (P7) |
| `maximum_calendar_days` | integer or none | optional |
| `reset` | time + IANA zone, or `REPORT_CLOCK_MIDNIGHT` | §3 |
| `breach_on` | `EQUITY_TOUCH` (default) \| `BALANCE_CLOSE` | whether touching the limit on floating equity counts |

Each rule is optional, so the same structure covers a challenge phase, a
verification phase, or a funded account. A multi-phase challenge is a set
of profiles evaluated one at a time (P8).

## 3. The day boundary (reset time)

MT5 tester times are **broker server time** (the report clock). Firms reset
at their own time, which is often midnight in a named zone.

- **Default:** `REPORT_CLOCK_MIDNIGHT`, which is what TRL already uses. It is
  labelled "day = report clock midnight; check that this matches your
  firm's reset".
- **Firm reset (P3):** the profile gives a time and an IANA zone (for
  example 00:00 Europe/Prague). To map report times onto that, the report
  needs a declared **report-clock zone**: an IANA zone or a fixed offset,
  entered once per report (for example "EET with EU daylight saving",
  common for MT5 servers). This reuses the optional broker-time profile slot
  from M3-POL-001; the report itself is never changed. Conversion is exact
  and uses the tz database shipped with Python. Ambiguous or missing local
  times at daylight-saving changes are resolved deterministically and
  reported as a finding.
- Without a declared report-clock zone, a firm-reset profile is refused
  with `E_PROP_CLOCK_UNDECLARED` rather than guessed.

`portfolio_lab.DAY_BOUNDARIES` and `equity_log.equity_metrics` gain the same
boundary parameter, so every daily number in TRL uses one definition.

## 4. Evidence levels and verdict wording

The same rules are evaluated on whichever series exists. The evidence level
decides the wording, and it is always shown next to the verdict.

| Evidence | Series used | Verdict wording |
| --- | --- | --- |
| **Equity log** (LINKED_VERIFIED) | each interval's tick-level `equity_min` for losses; balance and `equity_close` for references | "Broken on …" / "Not broken in the logged evidence" |
| **Portfolio, all tracks logged (E6)** | conservative low = combined balance + the sum of each track's floating minimum per interval | a breach only under the conservative low is **"Possibly broken"**, with the optimistic figure beside it (P5) |
| **Realised balance only** | closed-deal balance | "Optimistic preview (closed trades only): …" in every heading, as PL-006 requires |

- For a portfolio, TRL also computes an **optimistic combined equity** per
  interval (combined balance + the sum of each track's `equity_close`
  floating value). A breach under both bounds is "Broken"; under the
  conservative bound only, "Possibly broken"; under neither, "Not broken in
  the logged evidence".
- A combination where any track lacks a log is realised-only for the whole
  combination (E6).
- The equity log's modelling mode is shown. A mode other than "Every tick
  based on real ticks" adds a warning that the tick-level lows come from
  synthetic ticks.

## 5. Calculation rules (Core, Decimal, 8 dp half-even)

For each day *d* (by the chosen boundary):
- `reference_d` = the chosen start-of-day reference at the last sample
  before the boundary (the first row for day 1).
- `daily_limit_d` = the limit in currency (a fixed amount, % of the account
  size, or % of `reference_d`).
- `lowest_d` = the lowest series value inside *d* and when it happened.
- **Daily rule broken** when `reference_d − lowest_d ≥ daily_limit_d`
  (touching the limit counts as a breach, P9). The first breaching sample
  and its time are reported.
- **Headroom** `daily_limit_d − (reference_d − lowest_d)` in currency and as
  a % of the limit. The tightest day is shown.

Overall rule:
- `floor_t` = `account_size − limit` (FIXED), or
  `high_water_t − limit` (TRAILING), where `high_water_t` follows the chosen
  trailing reference and only rises. For `TRAILING_LOCKS_AT_START` the floor
  stops rising at `account_size`.
- **Broken** at the first sample where the series low ≤ `floor_t`.
- The floor over time is returned for the chart, and the minimum headroom is
  reported.

Target, days, and time:
- The **target** is reached at the first sample where balance (closed
  results; firms count closed P/L) ≥ `account_size + target`. The report
  gives its date, trading days so far, and whether any rule was already
  broken by then.
- **Minimum trading days**: the count of report days with ≥ 1 deal, using
  the same boundary.
- **Maximum calendar days**: whether the target came within the allowed
  period.

**After a breach** the run is not truncated. The check reports the first
breach and keeps counting, so the user sees "broken on day 12; the run
later went on to +8%". The overall verdict is set by the first breach.

## 6. Outputs (`prop.evaluate`)

```
{ calculation_version: "prop-check-1", profile: {id, hash, name},
  target: {kind: "DATASET"|"COMBINATION", ref, combination_id?},
  evidence_level: "EQUITY_LOGGED"|"PORTFOLIO_CONSERVATIVE"|"REALISED_ONLY",
  day_boundary: {...}, verdict: "BROKEN"|"POSSIBLY_BROKEN"|"NOT_BROKEN",
  rules: [{rule, limit, verdict, first_breach: {time, value, limit}|null,
           tightest: {date|time, headroom, headroom_percent}}],
  target_reached: {time, trading_days, clean_until_then}|null,
  daily: [{date, reference, lowest, lowest_at, loss, limit, headroom}],
  floor_series: [...display points...], warnings: [...] }
```

Worker methods: `prop.list_profiles`, `prop.save_profile` (never overwrites;
an edit makes a new version), `prop.delete_profile`, and `prop.evaluate`.
Results are recalculated on demand and not stored, like saved combinations
(PL-007). An Experiment note may cite a profile id, hash, and verdict.

## 7. Plugin (no calculations; hard rule UIX-1)

- A **Prop-firm check** page in the sidebar's Analysis group, plus a
  "Check against a prop profile" action on the report card and on saved
  combinations.
- A profile editor (a form with the §2 fields, plain labels, and an example
  filled with obviously fake round numbers) that notes "enter your firm's
  current rules; TRL does not know them".
- A results view:
  - a verdict banner with the evidence level
  - KPI tiles for each rule (limit, worst value, headroom, first breach)
  - an equity/balance chart in `ChartFrame` with the overall floor line and
    breach markers
  - a daily-loss bar chart with the daily limit line (slot hover)
  - guidance text built only from Core fields (`prop-guidance.ts`)
  - the audit trail (profile hash, boundary, evidence, versions)
- The Monte Carlo guidance's "prop-firm limit comparison" flag is replaced by
  a link to this page, not by an in-panel estimate (P10).

## 8. Tests and fixtures (Core; full fixture plan after approval)

| ID | Case |
| --- | --- |
| F1 | Daily loss, fixed %, with a hand-built equity series: a breach exactly at the limit (touch counts) and one cent short (no breach) |
| F2 | Start-of-day reference variants: BALANCE vs HIGHER_OF vs EQUITY with open floating P/L across midnight |
| F3 | Overall FIXED vs TRAILING vs TRAILING_LOCKS_AT_START on one series with a new high then a drop |
| F4 | Reset time: the same series with report-clock midnight vs 00:00 Europe/Prague and an EET report clock, including both DST changes |
| F5 | Portfolio: conservative vs optimistic bounds giving BROKEN / POSSIBLY_BROKEN / NOT_BROKEN, compared with a brute-force per-interval sum |
| F6 | Realised-only evidence gives the preview wording and never "Not broken in the logged evidence" |
| F7 | Target reached, trading days, calendar limit, and a breach before the target (`clean_until_then` false) |
| F8 | Profile validation: missing zone, a negative limit, an account-size mismatch (P6), unknown fields |
| F9 | Determinism: same inputs give byte-identical JSON; profiles are never overwritten |
| F10 | Real corpus: the logged DCA V3 run against a sample profile, with results checked by hand from `equity.parquet` |

## 9. Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| P1 | Ship no firm-named presets; the user enters their firm's numbers into generic profiles. | **Yes** |
| P2 | Rules in v1: daily loss, overall loss (fixed / trailing / trailing that locks at the start balance), profit target, minimum trading days, and maximum calendar days. Consistency rules, weekend holding, and news windows are deferred. | **Yes** |
| P3 | Firm reset times need a declared report-clock zone per report; without one, only report-clock midnight is allowed (no guessing). | **Yes** |
| P4 | Touching the limit on floating equity is a breach by default (`EQUITY_TOUCH`); `BALANCE_CLOSE` is available per profile. | **Yes** |
| P5 | Portfolios use two bounds: "Broken" when both break the rule, "Possibly broken" when only the conservative bound does. | **Yes** |
| P6 | No rescaling (PL-005): the profile's account size must equal the report's opening balance or the combination's declared capital; otherwise the check is refused with an explanation. | **Yes** (a rescaled "what if my account were X" view would need its own decision) |
| P7 | A trading day is a day, by the chosen boundary, with at least one deal (open or close). | **Yes** |
| P8 | Evaluate one profile over the whole run in v1. Chained phases (phase 2 starting after phase 1's target) and rolling start dates ("if the challenge had started on each day, how many starts pass") are the next increment. | **Yes, rolling starts next** |
| P9 | The run is not cut at the first breach; the first breach sets the verdict and later results are still shown. | **Yes** |
| P10 | No Monte Carlo breach probability in v1: Monte Carlo reshuffles closed trades only, so it would be a realised-only estimate. Revisit after rolling starts. | **Yes** |

## 10. Delivery slices (after approval)

1. The Core day-boundary module (report-clock zone plus firm reset) shared
   with `equity_metrics` and `portfolio_lab` (F4).
2. Portfolio combined equity series (E6): conservative and optimistic
   bounds per interval (F5).
3. Core `prop` profiles and `prop.evaluate` (F1–F3, F6–F10).
4. The plugin Prop-firm check page, profile editor, charts, and guidance.
5. Owner review in Obsidian.
