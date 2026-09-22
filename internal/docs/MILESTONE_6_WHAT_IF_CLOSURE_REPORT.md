# Milestone 6 — Fixed-Cost What-If Increment Closure Report

**Status:** Accepted, 2026-09-21  
**Scope:** A deterministic, user-supplied fixed additional cost applied to each
M2 verified close event in one selected source-currency dataset.

## Delivered

- Python-owned `scenario.fixed_close_event_cost` IPC method.
- Bounded Parquet scenario table and JSON manifest with input artifact identity,
  configuration/hash, Decimal policy, source/scenario summaries, and hashes.
- Obsidian control that requires M2 verified close-event analysis, collects a
  non-negative Decimal cost, and shows source P/L, scenario P/L, exact delta,
  and scenario-only win/loss/breakeven counts.
- Inline local validation beside the cost field for empty, malformed, and
  negative values; Core-side validation remains authoritative.

## Validation evidence

| Area | Outcome |
| --- | --- |
| Research Core | 32 pytest tests pass, including Decimal arithmetic, sign-change classification, immutable source data, invalid input, distinct configuration identities, deterministic reruns, and worker dispatch. |
| Plugin | 7 automated tests and the production TypeScript/esbuild build pass. |
| Owner review | The owner confirmed matching results at `0.00`, exact cost sensitivity at a positive value, visible research-only warnings/no-document boundary, and the corrected inline negative-cost error. |

## Boundaries retained

The fixed-cost input is a `USER_SUPPLIED` analytical assumption. This increment
does not model spreads, slippage, execution, lots, margin, leverage, stop loss,
equity, drawdown, currency conversion, prop-firm rules, or future performance.
It is not advice, a signal, an execution instruction, or a forecast.

## M6 status

This closes the first M6 What-If increment, not all of Milestone 6. Monte
Carlo, money-management research, and optimisation analysis remain unapproved
and unimplemented. Their first implementation requires a separately approved
policy, fixture plan, acceptance criteria, and owner checklist.
