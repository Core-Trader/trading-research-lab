# Open Decisions

No locked architecture decision is reopened. The following choices are either
spike validation items or genuinely require later owner input.

## Resolved during Milestone 0

- The local Python 3.14.7 virtual environment, Node/npm toolchain, plugin build,
  and vault junction were validated for development.
- The minimum Python/Parquet stack was validated locally; distribution review
  remains separate in `THIRD_PARTY_LICENSES.md`.
- Stdio NDJSON is viable for the M0/M1 local-worker path, with forced-crash and
  broad integration coverage deferred to later validation.
- Node's built-in test runner covers current plugin safety tests. No additional
  plugin test dependency was adopted in M0.

## Resolved during Milestone 1

- Managed SHA-verified raw snapshots are the intake default.
- Private local-path receipts and bounded JSON dataset registry/evidence views
  are approved for development-only workspaces.
- Intake does not infer account mode, broker timezone, or trade pairing.

## Resolved for Milestone 2 implementation

- Regular MT5 Excel reports may create optional `INFERRED` lifecycles only for a
  `USER_SUPPLIED` `HEDGING` declaration. Unknown and netting declarations stay
  event-level in M2.
- `mt5-excel-hedging-fifo-v1` is the approved chronological FIFO policy within
  identical symbol and direction.
- Partial closes use Decimal volume-proportional economics, with a deterministic
  final full-event allocation remainder. Verified close-event and inferred-
  lifecycle results remain quality-separated.

## Resolved during Milestone 2

- The M2 panel was manually accepted against a representative report. Verified
  close events, inferred lifecycles, account-mode labels, quality counts, and
  wrapping-safe presentation were confirmed.

## Resolved for Milestone 3 implementation

- Source-reported-clock analysis is the default; it uses MT5 report date/time
  exactly as supplied and makes no timezone claim.
- The basic M3 metric is `generic-realised-balance-daily-drawdown-v1`, with the
  first report balance in the day as percentage denominator and partial edge
  days labelled.
- Intratrade equity and equity-based drawdown stay `UNAVAILABLE` without marks
  and floating P/L. The later source of verified equity evidence remains open.
- Broker-time conversion and broker/prop-firm-specific rules remain optional
  future work, not M3 baseline behaviour.

## Resolved during Milestone 3

- The M3 panel was manually accepted against a representative report. Its
  source-clock basis, realised-balance-only label, unavailable equity state, and
  absence of broker/prop-firm claims were confirmed.

## Resolved for Milestone 4 implementation

- M4 document writes are explicit user actions in `Strategies/`, `Experiments/`,
  and `Reports/`; unrelated vault files are not scanned or modified.
- An M4 experiment has one explicit strategy, dataset, and analysis-run link.
- Reports use one exact generated block. Unchanged managed content/evidence/
  configuration produces `NO_CHANGES_DETECTED` with no write/revision; a changed
  generated block requires warning/confirmation and receives a revision manifest.

## Owner review required before Milestone 4 closure

- Validate the full explicit document flow in the development vault using the
  completed `MILESTONE_4_OWNER_REVIEW_CHECKLIST.md`.
- Confirm no-change detection makes no vault write and changed regeneration
  preserves user prose outside the marker block.

## Owner decision needed before public distribution, not Milestone 0

- Repository/product licence and ownership model.
- Whether any redacted fixture can be published; default is no proprietary data.
- Final Free/Pro capability and limit matrix.

## Milestone 6 — What-If scenario decisions

- The owner selected What-If scenarios as the first M6 workstream.
- Before implementation, approve the proposed fixed non-negative additional
  cost per verified close event, source-currency boundary, output metrics,
  deterministic fixtures, and manual review checklist in
  `MILESTONE_6_WHAT_IF_SCENARIO.md`.
- Money-management research remains deferred because regular MT5 reports lack
  sizing-risk evidence. Optimisation analysis is now in decision-package review;
  its policy is not approved. See
  `MILESTONE_6_MONEY_MANAGEMENT_DECISION_PACKAGE.md` and
  `MILESTONE_6_OPTIMISATION_ANALYSIS_DECISION_PACKAGE.md`.

## Milestone 6 — Monte Carlo decisions

- The owner selected Monte Carlo as the next M6 workstream.
- The owner approved the verified-close-event-only order-permutation policy,
  explicit seed/PCG32-v1 algorithm, path limits, money-only drawdown, quantile
  convention, fixtures, and manual review checklist in
  `MILESTONE_6_MONTE_CARLO.md`. Implementation is complete; owner-panel review
  remains pending.

## Deferred by design

Cloud features, mobile support, payments, accounts, telemetry, automatic
updating, SQLite, and future worker packaging are not decisions needed now.
