# Milestone 6 — Fixed-Cost What-If Implementation Record

**Date:** 2026-09-21  
**Status:** Accepted; implementation and owner-panel validation completed on
2026-09-21.

## Delivered

- Core method `scenario.fixed_close_event_cost` calculates a separate M6 result
  from one selected dataset's deterministic M2 verified close-event artifact.
- The method accepts only a non-negative finite Decimal additional cost in the
  source currency. It blocks missing currency, missing verified close events,
  negative, invalid, and non-finite values.
- Each result writes a bounded Parquet scenario table plus JSON manifest with
  input artifact identity/hash, configuration/hash, versions, Decimal policy,
  source/scenario summaries, and output hashes.
- The Obsidian panel requires M2 close-event analysis first, accepts the
  declared cost, and visibly separates source P/L from scenario P/L and its
  exact delta. It retains research-only and unavailable-result warnings.
- Negative, empty, and malformed cost input now receives an inline panel error
  beside the cost field before the worker is called; worker-side validation
  remains the authoritative second boundary.
- No source snapshot, canonical dataset, M2 source event, M3/M5 artifact, or
  Markdown research document is modified by the scenario.

## Validation evidence

- Research Core: 32 pytest tests pass. New coverage proves exact Decimal
  arithmetic, a cost-induced scenario breakeven, source-dataset immutability,
  invalid-cost blocking, changed-configuration identities, deterministic
  reruns, and worker capability/dispatch.
- Plugin: 7 automated tests and the production TypeScript/esbuild build pass.
- After the inline validation correction: 32 Core tests, 7 plugin tests, and
  the production build pass again.

## Owner review outcome

The owner confirmed baseline equivalence, positive-cost sensitivity, visible
warnings/no-document boundary, and the corrected inline negative-cost error.
Closure evidence is in `MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md`.
