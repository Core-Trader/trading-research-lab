# Milestone 3 — Time, Equity, and Risk Foundation Specification

**Status:** Closed, 2026-09-20. See `MILESTONE_3_CLOSURE_REPORT.md`.  
**Depends on:** `MILESTONE_2_CLOSURE_REPORT.md`  
**Purpose:** add explicit time context and qualified balance/equity/risk results
without converting an MT5 Deals export into unsupported mark-to-market or
prop-firm claims.

## Scope

M3 introduces source-reported-clock analysis by default, optional versioned
broker-time profiles, explicit result availability, and a generic
realised-balance daily-drawdown calculation. Python remains the calculation
authority. The plugin configures and renders policies and availability states;
it performs no financial calculation.

## Time profile boundary

MT5 report timestamps are source-clock text. They are not UTC and do not imply a
broker timezone. **Source-reported-clock analysis is the M3 default**: the Core
uses the timestamp text/order and calendar date exactly as supplied by the
report, without conversion or a claim about what timezone the source clock
represents. It supports generic report-clock daily grouping.

A broker-time profile is optional. It is required only when the user wants a
conversion, a broker-specific civil-day interpretation, or a future rule with a
specified reset calendar. The selectable profiles are:

- `SOURCE_REPORTED_CLOCK`: the default. Timestamp ordering, display, and daily
  grouping use report-clock values verbatim; output is labelled
  `SOURCE_REPORTED_CLOCK`, not UTC or broker-local time.
- `USER_SUPPLIED_FIXED_OFFSET`: a named offset with an explicit effective date
  range. It must not be presented as DST-aware.
- `USER_SUPPLIED_IANA_ZONE`: a named IANA zone with an explicit broker/server
  applicability statement and tzdata version recorded in the result manifest.

Every time-sensitive result returns its time basis, configuration identity, and
resolved daily boundary. Optional profiles additionally return profile source
(`USER_SUPPLIED`) and configuration hash. The M3 baseline does not hard-code
RoboForex, FTMO, or another broker/firm profile.

## Balance and equity availability

- Source-reported balance points remain `VERIFIED` source facts.
- A regular MT5 Deals export does not provide intratrade marks, open floating
  P/L, or a complete equity time series. M3 displays intratrade equity and
  equity-based drawdown as `UNAVAILABLE` for that input. What later evidence
  source can make equity drawdown available remains an open research decision.
- M3 may calculate only the explicitly named realised-balance series from the
  imported report. It must not label this series "equity" or an equity-based
  prop-firm maximum-loss result.
- Mark ingestion, price-series selection, conversion, and missing-mark policy
  are deferred. Their absence blocks the affected metric rather than triggering
  estimation.

## Generic daily-drawdown baseline

The proposed baseline is `generic-realised-balance-daily-drawdown-v1`:

- basis: source-reported realised balance only;
- calendar: report-clock calendar date by default; a selected optional profile
  may instead resolve one configured local civil day;
- daily reference: the first source-reported balance point in that resolved day;
- daily drawdown: the maximum decline from the running daily realised-balance
  high-water mark, reported as money and percentage of the daily reference;
- output: daily rows plus overall worst-day summary, all labelled
  `REALISED_BALANCE_ONLY`;
- precondition: source-reported balance points and either the default
  `SOURCE_REPORTED_CLOCK` basis or a selected optional profile.

This is a generic research metric, not a broker rule or prop-firm compliance
decision. A day containing no source balance point is not invented. A partial
first/last day is retained and labelled as partial coverage.

## Prop-firm overlays

Prop-firm analysis remains optional and out of M3 implementation. A future
overlay must be a separately versioned configuration containing firm, programme,
rule version/effective date, initial-balance reference, timezone/reset schedule,
equity/balance basis, realised/floating treatment, threshold, and evidence.

An FTMO swing-account configuration may later model the owner-provided 5% daily
and 10% overall equity-based limits, but it cannot be calculated from an MT5
Deals export alone. The M3 generic realised-balance baseline must never be
presented as FTMO compliance.

## Storage and IPC contract

The Core writes versioned optional time-profile, daily-balance, and
result-manifest JSON plus any high-volume derived daily table as Parquet in the
bounded dataset workspace. It adds version-1 methods:

- `time.validate_profile`
- `analysis.realised_balance_daily_drawdown`
- `analysis.equity_availability`

The plugin displays the selected time basis, optional profile/source, availability
status, series basis, partial-coverage warnings, configuration identity, and
unavailable reasons next to each relevant result.

## Out of scope

Automatic broker-time discovery, hard-coded broker schedules, intratrade marks,
equity reconstruction, FTMO/RoboForex or other firm rules, daily-loss breach
claims, portfolio replay, currency conversion, optimisation, Monte Carlo, and
changes to M1/M2 data evidence are out of scope.

## Owner decisions required

Approve or amend the remaining optional-profile model, generic realised-balance
definition, partial-day treatment, percentage denominator, M3 fixtures, and
manual review checklist before implementation starts. The source-reported-clock
default is already approved.
