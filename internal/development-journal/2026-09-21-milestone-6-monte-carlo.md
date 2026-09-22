# Milestone 6 — Seeded Order-Permutation Monte Carlo Implementation Record

**Date:** 2026-09-21  
**Status:** Implemented; owner-panel validation pending.

## Reference adaptation

Strategy Factory's pinned `validation_utils.py` was reviewed as a concept-only
reference. It resamples portfolio percentage returns with replacement, compounds
from initial capital, reports confidence/profit-probability values, and does not
show an explicit seed contract. No code or dependency was reused.

TRL retained only the compatible idea of explicit multi-path tail/worst-case
summaries. It independently implements a specified `PCG32-v1` PRNG and
Fisher–Yates order permutation without replacement over verified monetary close
event P/L. It intentionally excludes percentage-return compounding, probability
and confidence claims, initial-capital/equity semantics, and hidden randomness.

## Delivered

- Core method `scenario.monte_carlo_order_permutation` with required uint64
  seed, 1–10,000 path count, two-event minimum, and exact final-P/L invariant.
- Bounded Parquet path-summary table and JSON manifest containing source
  artifact identity/hash, seed, PRNG, method, configuration/hash, quantile
  convention, drawdown summary, and output hashes.
- Obsidian Monte Carlo section with visible seed/path inputs, inline validation,
  explicit shuffle action, source-total/invariant display, tail drawdown
  summaries, and warning labels.

## Validation evidence

- Research Core: 40 pytest tests pass, including deterministic seeded artifacts,
  changed-seed/path identities, invariant totals, tail ordering, invalid
  seed/path blocking, minimum-population blocking, and worker dispatch.
- Plugin: 7 automated tests and the production TypeScript/esbuild build pass.

## Owner review required

Use the M6 Monte Carlo panel in Obsidian and confirm the checks in
`MILESTONE_6_MONTE_CARLO.md`. In particular, confirm same-seed repeatability,
changed-seed distinction, visible limitations, inline invalid-input feedback,
and no-document creation.
