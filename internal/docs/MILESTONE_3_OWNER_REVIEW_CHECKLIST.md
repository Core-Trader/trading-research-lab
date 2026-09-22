# Milestone 3 — Owner Review Checklist

Approved and manually accepted by the owner on 2026-09-20. Keep this checklist
with the M3 closure evidence.

- [x] **Time source:** use `SOURCE_REPORTED_CLOCK` by default, based on the
      timestamp/date exactly as supplied in a regular MT5 Excel report. Do not
      infer a broker/server timezone.
- [x] **Optional profile types:** allow fixed-offset profiles only with effective ranges,
      and IANA-zone profiles only with the zone and tzdata identity recorded.
- [x] **Generic baseline:** approve
      `generic-realised-balance-daily-drawdown-v1` as a research metric based on
      source-reported realised balances and a local civil day.
- [x] **Daily reference:** approve the first source-reported balance in the day
      as the percentage denominator, with partial first/last days labelled.
- [x] **Equity boundary:** approve `UNAVAILABLE` for intratrade equity and all
      equity-based drawdown when marks/floating P/L are absent; leave the future
      evidence source for verified equity drawdown open.
- [x] **Prop-firm boundary:** keep firm-specific rules as optional future
      overlays; do not present generic realised-balance results as FTMO or other
      firm compliance.
- [x] **Fixtures and acceptance:** approve the synthetic fixture plan and
      manual checklist in `MILESTONE_3_FIXTURE_PLAN.md`.
- [x] **Scope boundary:** confirm M3 excludes time auto-discovery, mark ingestion,
      currency conversion, portfolio replay, optimisation, Monte Carlo, and
      changes to immutable source evidence.
