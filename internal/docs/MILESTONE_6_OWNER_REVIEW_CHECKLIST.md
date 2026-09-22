# Milestone 6 — Owner Review Checklist

**Status:** What-If and Monte Carlo accepted. Do not begin a remaining
workstream until its applicable policy is approved.

- [x] **First workstream:** What-If scenarios, selected by the owner on
      2026-09-21. The detailed proposed first slice is
      `MILESTONE_6_WHAT_IF_SCENARIO.md`.
- [x] **Next workstream:** Monte Carlo, selected by the owner on 2026-09-21.
      Detailed policy approval remains required in
      `MILESTONE_6_MONTE_CARLO.md`.
- [x] **Monte Carlo policy:** approved the verified-close-event-only population,
      order permutation without replacement, explicit uint64 seed, PCG32-v1,
      deterministic Fisher–Yates shuffle, path limits, drawdown definition,
      and quantile convention in `MILESTONE_6_MONTE_CARLO.md`, after the
      recorded Strategy Factory comparison.
- [x] **Monte Carlo panel validation:** confirmed visible seed/path inputs,
      invariant final P/L, money-only drawdown summaries/limitations,
      same-seed deterministic rerun, changed-seed distinct identity, inline
      invalid-input feedback, and no-document boundary.
- [x] **What-If policy:** approved verified-close-event-only input boundary,
      fixed non-negative additional cost per close event, source-currency rule,
      metrics, and exclusions in `MILESTONE_6_WHAT_IF_SCENARIO.md`.
- [x] **Input basis:** approved `MT5_VERIFIED_CLOSE_EVENTS` only; inferred,
      mixed-quality, balance, and equity inputs block this slice.
- [x] **Configuration:** approved non-negative Decimal fixed cost in source
      currency, source-order all-event selection, source-precision preservation,
      and distinct result identity per configuration.
- [x] **Stochastic policy:** approved generator, explicit seed, sampling method,
      replacement policy, path/run count, no-capital-floor first-slice boundary,
      and statistics/quantiles for the accepted order-permutation slice.
- [ ] **Sizing policy:** if money management is selected, approve sizing
      formula, initial balance/reference, minimum-size/rounding rules, and
      missing-input blocking rules.
      Current recommendation: defer; see
      `MILESTONE_6_MONEY_MANAGEMENT_DECISION_PACKAGE.md`.
- [ ] **Optimisation provenance:** if optimisation analysis is selected,
      approve source format, required metadata, in/out-of-sample labeling,
      selection boundary, and unavailable claims.
- [x] **Parameter-selection decision:** automatic selection is deferred by the
      owner on 2026-09-22. The paired-forward viewer remains evidence-only;
      see `MILESTONE_6_PARAMETER_SELECTION_DECISION_PACKAGE.md`.
- [x] **Optimisation evidence-viewer policy:** approved MT5 XML SpreadsheetML
      parameter-grid import, `USER_SUPPLIED` modelling mode, inspection-only
      sorting/filtering, and no selection/recommendation/portfolio scope.
- [x] **Optimisation evidence-viewer panel validation:** owner confirmed the
      162-pass representative export, source/parameter retention, declared
      modelling mode, inspection-only safeguards, warnings, and no-document
      boundary on 2026-09-22. See
      `MILESTONE_6_OPTIMISATION_ANALYSIS_DECISION_PACKAGE.md`.
- [x] **Paired forward-analysis policy:** approved strict signature pairing,
      user-supplied period/modelling context, evidence-only display, exclusions,
      fixtures, and manual review package in
      `MILESTONE_6_PAIRED_FORWARD_ANALYSIS_POLICY.md`.
- [x] **Paired forward-analysis panel validation:** owner confirmed the 170-pair
      import, declared context, side-by-side source columns, explicit
      limitations, and no-document/no-selection boundary on 2026-09-21.
- [x] **Presentation:** approved visible labels for data quality, input
      identity, configuration, warnings, and research-only status.
- [x] **Fixtures:** approved the applicable deterministic fixture cases in
      `MILESTONE_6_FIXTURE_PLAN.md`.
- [x] **Scope boundary:** confirmed exclusion of live trading, advice, broker
  or prop-firm claims, hidden randomness, currency conversion, and
  intratrade equity reconstruction.
- [x] **What-If panel validation:** confirmed `0.00` baseline equivalence,
      positive-cost sensitivity, visible warnings/no-document boundary, and
      the inline error for negative input. Closure evidence is in
      `MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md`.
