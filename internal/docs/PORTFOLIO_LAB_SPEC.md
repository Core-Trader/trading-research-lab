# Portfolio Lab (MVP-P) — Specification

**Status:** Approved scope 2026-09-22 (decisions PL-001 to PL-006 in
`DECISION_LOG.md`). This spec defines v1 and supersedes the draft
`PORTFOLIO_CONCURRENT_COMBINATION.md`.
**Intent:** import several EA backtests, compare them side by side, and see how
combinations traded **concurrently on one account** would have balanced return
against drawdown over the periods each was active. It is the foundation for a
later prop-firm rules module.
**Evidence rules:** verified close events and reported balances only; the
combined result is realised balance, never equity. No lot rescaling, weights,
margin, or currency conversion (PL-005). Nothing is ranked as "best" (PL-003).
**External code:** none. FXOptimize informs the workflow only.

## 1. Concepts

**Track.** One strategy's history: an ordered list of one or more imported
reports (`dataset_ref`s).
- One report: always valid.
- Two or more reports: must pass the M5 sequential preflight (`ELIGIBLE`), which
  means consecutive, non-overlapping, and balance-continuous. This is how one
  EA's split backtests become one track (PL-001).
- **Track id:** `stable_uuid("portfolio-track", *dataset_refs, TRACK_VERSION)`.
- **Active period:** from the first event timestamp of the first report to the
  last event timestamp of the last report (report clock).
- **Track close events:** the verified close events of every report in order,
  with `net_pnl = profit + commission + swap`.
- The label is user-supplied and presentation only; it never affects results.

**Combination.** A set of 1–10 tracks, a declared starting capital (PL-004),
and a window (PL-002).

## 2. Combination engine (`portfolio.combine`)

**Inputs:** `tracks` (list of track definitions, each an ordered list of
`dataset_ref`s, max 10), `starting_capital` (positive decimal string,
`USER_SUPPLIED`), `window` (`UNION` default, or `COMMON`), and `day_boundary`
(v1 accepts only `REPORT_CLOCK_MIDNIGHT`, a slot kept for the prop module).

**Eligibility (all structured errors, naming the tracks involved):**
- `E_PORTFOLIO_TRACK_INVALID`: a multi-report track whose M5 preflight is
  `BLOCKED` (its findings are passed through).
- `E_PORTFOLIO_CURRENCY_MISMATCH`: tracks with different source currencies.
- `E_PORTFOLIO_DUPLICATE_EVENTS`: a close event with identical `(timestamp,
  deal id, symbol, net P/L)` in two tracks, for example the same backtest
  imported twice. It is never silently deduplicated.
- `E_PORTFOLIO_NO_COMMON_WINDOW`: `COMMON` window with no overlap.
- `E_PORTFOLIO_CONFIG_INVALID`: more than 10 tracks, a repeated track, or an
  invalid capital, window, or day boundary.

**Window:**
- `UNION` (default): from the earliest track start to the latest track end.
  Each track contributes only its own events, so only during its active period.
- `COMMON`: from the latest track start to the earliest track end. Only events
  inside this interval (inclusive) count, for every track.

**Merge:** close events are ordered by timestamp, then by track order as given,
then by source order within the track.

**Combined balance:** point 0 is the starting capital at the window start. Each
merged close event adds its net P/L.

**Outputs:**
- `combination_id` = `stable_uuid` of the track ids, capital, window, day
  boundary, and version.
- `combined_balance`: the full point list `{index, timestamp, balance, track}`.
- `metrics`: the C1/C2 metric set computed on the combined series with the same
  definitions and code as `analysis.performance_metrics`: balance maximum
  drawdown with peak/trough/recovery, return/drawdown, stagnation, profit
  factor, expectancy, average win and loss, streaks, and SQN.
- `tracks[]`: for each track, id, reports, currency, active period, close
  events in the window, net P/L, share of combined net P/L (`null` if combined
  net is 0; it can be negative or above 100%), and **standalone maximum
  drawdown** (the same starting capital plus that track's in-window events
  alone).
- `drawdown_overlap`: combined maximum drawdown, the sum of standalone maximum
  drawdowns, and `offset = sum − combined`. Offset is ≥ 0 by construction and
  shown descriptively, not as a score.
- `correlation`: for each pair of tracks, Pearson correlation of daily net P/L
  (report-clock dates inside the window) over days where **either** track has
  a close event (the other contributes 0 that day). `null` with a reason below
  10 such days or with zero variance. The day count is returned per pair.
- `daily`: combined net P/L per report-clock date (for the calendar, and later
  prop-firm daily rules).
- `active_tracks`: each track's active-period span, for the band.
- `warnings`: realised balance only; lots as reported; each backtest ran on its
  own balance, so compounding and margin interaction between EAs is not
  modelled; high correlation expected for same-symbol tracks.

No artifact is written in v1. The result is a deterministic function of the
canonical datasets, the configuration, and the version.

## 3. Side-by-side comparison (tracks and combinations)

- **Tracks table:** each track's standalone metrics (the existing C1/C2 set on
  its own reports), overlaid cumulative P/L curves on a shared time axis, and
  active-period bars. This needs no new Core method for single-report tracks.
- **Combinations:** the user builds named combinations (a set of tracks,
  capital, and window). Each runs `portfolio.combine`. They are compared in one
  table (net P/L, maximum drawdown, maximum drawdown %, return/drawdown, profit
  factor, SQN, and stagnation), on a **return-versus-drawdown scatter**, and as
  overlaid combined balance curves. v1 keeps combinations for the session;
  saving them to plugin data is a follow-up.

## 4. Combination explorer (`portfolio.explore`, PL-003)

- **Inputs:** 2–10 tracks, capital, and window, as for `combine`.
- **Output:** for every non-empty subset (≤ 1,023), in bitmask order: members,
  net P/L, maximum drawdown, maximum drawdown %, return/drawdown, and close
  events. Plus a `pareto` flag: the subset is **not dominated**, meaning no
  other subset has net P/L ≥ **and** maximum drawdown ≤ with at least one
  strictly better. Subsets with identical values are all flagged.
- **Presentation:** all subsets on the scatter; the non-dominated ones may be
  outlined when the user turns the overlay on. Clicking a point opens it as a
  combination. No "best", "recommended", or score label anywhere.

## 5. Fixtures

Tracks A and B, USD, capital `1000`, `UNION` window. Day `dN` means
2026-01-0N at 12:00; each report opens at `d0` (2026-01-01 00:00).

- **A:** d1 +100, d3 −50, d5 +30.
- **B:** d2 +50, d3 +40, d4 −60, d6 +20.

| ID | Case | Expected |
| --- | --- | --- |
| P1 | Merge order | d1 A, d2 B, d3 A (−50) **before** d3 B (+40) (track order), d4 B, d5 A, d6 B |
| P2 | Combined balance | 1000, 1100, 1150, 1100, 1140, 1080, 1110, 1130 |
| P3 | Combined metrics | Maximum drawdown 70 (1150 → 1080); `NOT_RECOVERED`; net 130; return/drawdown `1.85714286` |
| P4 | Standalone drawdowns | A 50 (1100 → 1050), B 60 (1090 → 1030); sum 110; offset 40 |
| P5 | Contribution | A net 80, share `61.53846154`; B net 50, share `38.46153846` |
| P6 | Correlation bound | 6 active days < 10, so `null` with reason `INSUFFICIENT_DAYS` |
| P7 | Correlation values | 10 days: A +1/−1 alternating and B the mirror gives `-1.00000000`; B identical to A gives `1.00000000` |
| P8 | Common window | A active d0–d5, B active d0–d6 (last event); COMMON = d0–d5 excludes B's d6 event; net 110 |
| P9 | No common window | A in January, C in March: `E_PORTFOLIO_NO_COMMON_WINDOW` with COMMON; valid with UNION |
| P10 | Duplicate guard | The same report as two tracks: `E_PORTFOLIO_DUPLICATE_EVENTS` naming both |
| P11 | Currency | USD plus EUR track: `E_PORTFOLIO_CURRENCY_MISMATCH` |
| P12 | Chained track | Two consecutive balance-continuous reports form one track; a blocked chain gives `E_PORTFOLIO_TRACK_INVALID` with findings |
| P13 | Single track | A combination of A alone equals A's standalone metrics on the same capital |
| P14 | Explorer | {A}: (80, 50); {B}: (50, 60); {A,B}: (130, 70). Pareto flags: A yes, B no (dominated by A), A+B yes |
| P15 | Determinism | Same inputs give byte-identical JSON; member datasets are unchanged |
| P16 | Subadditivity | For random seeded fixtures, combined maximum drawdown ≤ sum of standalone maximum drawdowns |

## 6. Prop-firm readiness (constraints for later)

- `daily` and the merged event stream are keyed by `day_boundary`. The prop
  module adds reset-time and timezone profiles there instead of re-deriving.
- `combination_id` is stable, so a prop evaluation can cite exactly what it
  tested.
- A per-track equity input channel is reserved for the PL-006 equity logger.
  Balance is never relabelled as equity.

## 7. Delivery slices

1. Core `portfolio.combine` plus fixtures P1–P13, P15, and P16.
2. Plugin **Portfolio** section: track builder (single report or chain), track
   comparison table and curves, combined dashboard (curve with active band,
   metrics tiles, contribution, drawdown overlap, correlation matrix).
3. Named combinations with a comparison table and return-versus-drawdown
   scatter.
4. Core `portfolio.explore` (P14) plus the explorer scatter with an optional
   Pareto overlay.
5. Equity-logger specification (PL-006), then the prop-firm module.
