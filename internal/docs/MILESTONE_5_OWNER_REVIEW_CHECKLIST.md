# Milestone 5 — Owner Review Checklist

**Status:** Approved and owner-reviewed on 2026-09-21. M5 is closed; see
`MILESTONE_5_CLOSURE_REPORT.md`.

- [x] **Initial scope:** limit M5 to sequential reports from one account;
      defer multi-account and shared-capital aggregation.
- [x] **Account declaration:** use `USER_SUPPLIED` when normal MT5 reports do
      not establish stable account identity; do not infer same-account status.
- [x] **Order:** define the permitted ordering rule and whether a user override
      is allowed.
- [x] **Overlap/duplicate safety:** block a combined result on any overlap or
      unresolved duplicate finding unless a separately approved rule applies.
- [x] **Gaps:** define whether gaps block continuity or permit a visibly
      `GAP_QUALIFIED` result.
- [x] **Capital continuity:** define the opening/final-balance reconciliation
      rule and treatment of deposits, withdrawals, and discrepancies.
- [x] **Compatibility:** initially require one currency and one report-clock
      basis; block conversion or mixed-basis outputs.
- [x] **Outputs:** approve the first combined realised-balance and qualified
      daily-risk outputs; retain `UNAVAILABLE` for intratrade equity.
- [x] **Workflow:** approve an explicit selected-batch review before any
      combined artifact or research document is written.
- [x] **Fixtures:** approve the draft fixture plan in
      `MILESTONE_5_FIXTURE_PLAN.md`.
- [x] **Scope boundary:** confirm M5 excludes shared-capital, multi-account,
      currency conversion, prop-firm compliance, and live execution.
