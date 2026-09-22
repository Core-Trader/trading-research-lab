# 2026-09-22 — Batch feedback fixes; tier C2 Van Tharp metrics

## Sequential batch (M5) analysis and fixes

Full analysis: `internal/docs/M5_BATCH_FEEDBACK_ANALYSIS.md`. The owner's four
real reports overlap in time, so the sequential-only M5 feature blocks them
(`COVERAGE_OVERLAP`). The two consecutive 2026 reports alone are `ELIGIBLE` and
combine correctly (10000 → 10237.25). The expected FXOptimize-style behaviour
(EAs trading concurrently on one account) is a different, currently deferred
feature, drafted in `PORTFOLIO_CONCURRENT_COMBINATION.md` with owner decisions
P0–P8.

Fixes shipped:
- Core preflight `m5-sequential-batch-preflight-2`: every finding names its
  reports (`members`); every overlapping pair is reported, not just the first;
  deal-ID reuse is one consolidated warning; balance-discontinuity messages
  show both balances. Changing the version gives new batch identities for
  newly created combined artifacts; existing artifacts are untouched.
- Plugin batch panel: a scope explanation (sequential versus concurrent),
  status banner, coverage timeline (conflicts come from Core findings only),
  next-step guidance per finding code, in-panel busy and error states, KPI
  tiles for the combined result, and rounded percentages.
- Bug fix: stale combined daily drawdown was never cleared when the batch
  changed or was re-checked. All batch results now reset together.

## Tier C2 (owner accepted T1–T7)

- Core `r_metrics.py`, method `analysis.r_multiple_metrics(dataset_ref,
  r_source, r_amount?)`, version `mvp-r-multiple-metrics-1`. 1R is either
  DECLARED (`USER_SUPPLIED`) or AVERAGE_LOSS (`INFERRED`). Outputs: expectancy
  (R), sample stdev, SQN raw and capped at 100, largest win and loss in R,
  opportunity per 30 days, expectunity, top-5 winners' share, and a fixed
  0.5R histogram with underflow and overflow. No quality bands.
- `performance_metrics` v2 adds `standard_deviation`, `sqn`, and
  `sqn_capped_100` (scale-invariant, so no 1R is needed). Overview gets an
  "SQN (Van Tharp)" tile.
- Analysis page: a manual "R-multiples (Van Tharp)" panel, manual because the
  proxy 1R is inferred. It is reset on every import.
- Overview tiles: "Gross profit / loss" folded into the profit-factor detail,
  giving 12 tiles in two even rows.

## Validation

- Core 87/87 (R1–R8 plus opportunity, expectunity, top share, invalid
  configurations, worker; three new M5 member-identification tests).
- Plugin 40/40; build passes.
- Real data: the M5 preflight was run on the owner's four local snapshots in a
  temporary workspace. R metrics were checked on the synthetic 160-trade
  report: SQN is identical from R and from P/L (1.01765378), and the capped
  value equals raw × √(100/160).
- **Not validated in Obsidian.**
