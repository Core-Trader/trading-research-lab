# 2026-09-24: prop-firm rule check and display precision policy

The owner accepted P1–P10 of `internal/docs/PROP_FIRM_SPEC.md` as
recommended (PROP-1).

## UI fixes before the spec (commit 4db1a65)

- **Sidebar:** the buttons stay left-aligned when pressed, focused, or
  active.
- **Close-event P/L bars:** hover now uses the bar slot under the cursor
  (`slotIndex`) rather than the nearest point.
- **Monte Carlo fan:** the individual paths show by default. The middle-90%
  band is an optional shading.

## Core (commit a5f39d0)

- **`day_boundary.py`:** the shared day definition, used by
  `equity_metrics` and the prop check:
  - report-clock midnight, or a firm reset time in an IANA zone
  - the report clock's zone is declared by the user (IANA name or
    `UTC±HH:MM`)
  - DST gaps and overlaps resolve to `fold=0` and are counted as findings
  - `tzdata` (Apache-2.0) was added, because Windows has no tz database; it
    is recorded in `THIRD_PARTY_LICENSES.md`
- **`prop_check.py`:**
  - content-addressed, never-overwritten profiles
  - `prop.evaluate` for a report or a saved-combination setup
  - portfolio combined equity (E6): a conservative bound (the sum of each
    track's interval lows) and an optimistic bound (the sum of each track's
    last sampled equity), checked against a brute-force sum
- **Tests:** F1–F9 in `test_prop_check.py`; the Core total is 242.
- **F10 (real data):** the logged DCA V3 run with a 5%/10% sample profile.
  The worst daily loss (93.41 USD) and the overall headroom (9 987.49 USD)
  match a hand calculation from `equity.parquet`.
- **Dev vault finding:** the registry entry for that report no longer has
  its `equity` block, although `datasets/<sha>/equity/` still exists (it was
  probably re-imported after the attach). The check was run on a scratch
  copy, with the log re-attached there. The owner may need to re-attach the
  log in the dev vault.

## Plugin (commits 81b2925, b20091d)

- **Prop-firm check page** (sidebar → Research):
  - a profile editor with plain labels and placeholder examples only
  - a report or saved-combination picker, preselecting the current report
  - a report-clock zone field, shown only for firm reset times and
    remembered per report on this device (localStorage, a convenience only)
- **Results view:**
  - a verdict banner worded by evidence level
  - rule tiles showing the headroom or the first breach
  - an equity-vs-floor chart with breach markers and a "zoom to balance and
    equity" toggle, because the floor otherwise flattens the equity
  - a daily-loss chart whose bar height comes from the Core's headroom %
  - guidance built only from Core fields, and the audit trail
- The Monte Carlo prop flag now points to this page.

## Display precision policy (owner request, UIX-2)

- 2 decimals: money, percentages, ratios, and MT5 metrics.
- 5 decimals: prices.
- Whole counts stay whole. EA parameter values and user-entered rule values
  are shown as entered.
- The helpers `money`, `num`, `pct`, and `price` are in `display-format.ts`,
  with tests.
- About 20 raw renders were fixed: balances, calendar and monthly P/L,
  drawdown tooltips, portfolio tables, scatter cards and axes, the
  neighbourhood table and heatmap, compare-table metrics, histogram labels,
  and the equity chart.
- A runtime scan of the rendered harness pages found no number with more
  than 5 decimals.

**Tests:** plugin 87, Core 242; the build is clean.

## Follow-up: FTMO presets, Parameters tooltip, rolling starts (PROP-2, P8)

### FTMO presets (commit 8cd97e6)

- **Sources:** the owner asked for firm presets and suggested PropFirmMatch.
  - PropFirmMatch is an affiliate aggregator. It listed FTMO's programmes,
    trading days, and the best-day rule, but no loss limits.
  - The values were therefore taken from FTMO's own trading-objectives page.
  - Both sources are recorded in `REFERENCE_REGISTER.md`. The FTMO cookie
    banner was not accepted; PropFirmMatch's non-essential cookies were
    declined.
- **Five presets:** 2-Step Challenge, Verification, and Account; 1-Step
  Challenge and Account. Each carries its source URL, retrieval date, and a
  list of what TRL cannot check.
- **New profile options**, needed to match FTMO:
  - `trading_day_definition`: FTMO counts days on which a position is
    opened
  - `limit_touch_counts`: FTMO breaches only when equity drops *below* the
    limit
  - `best_day_max_percent`: the 1-Step best-day rule, 50%
- **Pass point:** now the first moment at which the target, the minimum
  days, and the best-day share hold together (`prop-check-2`).
- **Tests** use FTMO's own worked examples:
  - the daily limit of 97 000 on day 2
  - the 1-Step end-of-day trailing floor of 94 000
  - the best day at 62.5% (not met), then at 38.46% after one more day (pass)
- Profiles saved before this change still load, with the defaults filled in.

### Parameters tooltip (commit 1307f95)

The scatter card always shows net profit, equity drawdown %, profit factor,
recovery factor, and trades, skipping any already on an axis.

### Rolling start dates (commit bfaebdc; `prop-rolling-1`)

- **What it does:** every day with data is a challenge start, followed to
  its first decision:
  - passed
  - broken, or possibly broken (portfolio, conservative bound only)
  - out of time (the maximum calendar days are reached)
  - survived, for profiles without a target (default 30 days)
  - not decided (the data ended)
- **How a start works:** each start shifts the run to begin at the account
  size. P/L is not rescaled (P6), and starts that inherit open positions
  are counted.
- **Speed:** a day-level fast path skips days in which no breach or pass is
  possible. It is tested against a full scan on 40 random runs. The first
  start matches `prop.evaluate` (the pass time and the first-breach time).
- **Real DCA V3 run (FTMO presets, report clock `Europe/Athens`):** about
  0.2 s per call.
  - All 161 starts are "not decided" for the 2-Step and 1-Step challenges.
    The run makes about +0.2% in a year, so it never reaches the 10% or 5%
    targets.
  - The 2-Step funded account survives 30 days from every decided start
    (144).
  - 122 of the 161 starts inherit open DCA positions.
- **Tests:** Core 254, plugin 90; the build is clean.
