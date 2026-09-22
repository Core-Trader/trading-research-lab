# Milestone 5 — Deterministic Implementation Plan

**Status:** Closed; preflight, explicit eligible-artifact creation, and
qualified source-clock daily drawdown were owner-validated on 2026-09-21.  
**Authority:** `MILESTONE_5_PORTFOLIO_REPLAY.md`,
`MILESTONE_5_FIXTURE_PLAN.md`, and
`MILESTONE_5_OWNER_REVIEW_CHECKLIST.md`.

## Implementation outcome

The bounded M5 increment adds a **batch preflight**, not automatic portfolio
analysis. It accepts a user-selected set of MT5 Excel reports, independently
intakes/reuses each one using M1, and returns a reviewable decision: eligible for a
sequential same-account combined realised-balance calculation, or blocked with
specific evidence findings. No Markdown research document is created by this
increment.

## Conservative v1 rules to implement

These implemented rules make the approved policy deterministic. They are
deliberately conservative and require final owner-panel review.

1. **Account label:** batch membership records
   `USER_SUPPLIED_SINGLE_ACCOUNT`; it is not source-verified unless a stable
   report fact later supports that claim.
2. **Order:** use source-reported chronological coverage; no manual reordering
   override in v1. Ties or indeterminate ordering block the batch.
3. **Repeated source:** identical source SHA-256 is rejected as a duplicate
   member, not silently reused twice.
4. **Overlap/duplicate evidence:** overlapping reported coverage or matching
   source timestamp-and-deal identifier pairs blocks a combined result. A reused
   deal number in non-overlapping event spans is a warning, not duplicate-event
   evidence. The preflight never deduplicates.
5. **Gaps:** a gap may be retained only as `GAP_UNDETERMINED`; the qualified
   daily result makes the gap explicit and does not claim continuous coverage.
6. **Capital continuity:** a continuous combined balance requires exact equality
   between the preceding report's final reported balance and the next report's
   opening reported balance. A mismatch blocks the continuous result; deposits,
   withdrawals, and corrections are never inferred.
7. **Compatibility:** one currency and `SOURCE_REPORTED_CLOCK` only in v1.
   Mixed currency or clock basis blocks a combined monetary/time-sensitive
   result. No conversion is attempted.
8. **Available output:** a qualified combined realised-balance series and
   its source-membership/continuity metadata may be produced. Intratrade equity
   and equity drawdown remain `UNAVAILABLE`. M3-style daily drawdown is available
   only for an eligible batch and never across an overlap. Gap limitation is
   retained in the result rather than inferred away.
9. **User gate:** the plugin must show the selected reports and all findings;
   an explicit confirmation is required before the Core writes a combined
   artifact. No strategy, experiment, or report note is created automatically.

## Increment sequence

### A. Data contracts and fixtures

- Implemented: Python dataclasses/schema for batch request, member receipt, finding,
  preflight result, availability state, and batch manifest.
- Implemented: deterministic coverage for the approved M5 fixture cases.
- Implemented: tests proving source datasets/snapshots are untouched.

### B. Core preflight

- Implemented: a versioned local IPC request for explicit source-path batch intake and
  preflight.
- M1 intake is reused per source; immutable evidence references are collected.
- Findings are calculated only in Python, using Decimal-safe source balance facts.
- The preflight returns a compact, quality-labelled result without writing a
  combined artifact.

### C. Plugin batch review

- Implemented: both one-at-a-time add-to-list selection and native multi-file selection,
  followed by a visible named member list with remove/clear controls before the
  preflight is submitted.
- The UI distinguishes `ELIGIBLE`, `BLOCKED`, and `GAP_UNDETERMINED` findings.
- It presents the user-supplied account declaration and unavailable metrics.
- No automatic document creation or TypeScript financial calculations are added.

### D. Confirmed artifact creation

- Implemented: a separate explicit confirmation action is available for an
  eligible batch only.
- Write versioned JSON manifest and Parquet derived table in the bounded Core
  workspace only after confirmation.
- Add deterministic rerun/no-write-or-reuse behaviour and integration coverage.

### E. Qualified daily drawdown

- Implemented: a separately invoked Core calculation returns source-clock
  realised-balance daily drawdown only after an eligible batch has an explicit
  combined artifact.
- The panel visibly retains the gap, equity, and prop-firm limitations.

## Acceptance gates

Each increment must pass Core tests, plugin tests/build, and its relevant manual
review before the next increment begins. An owner must manually review the
preflight member list, findings, result eligibility, and explicit confirmation
behaviour using representative reports before the first combined artifact is
accepted.
