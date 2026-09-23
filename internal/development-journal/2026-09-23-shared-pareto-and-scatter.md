# 2026-09-23 — Shared Pareto core and trade-off scatter (build step 1)

**Authority:** PX-001–PX-007 (`DECISION_LOG.md`),
`PARAMETER_EXPLORATION_ARCHITECTURE.md` §5–§6 and §14 step 1. Consumers come
next: Portfolio Lab slices 3–4, then parameter exploration.
**External code:** none. Strategy Factory's DEAP optimiser was reviewed and
rejected (single objective, `HallOfFame(1)`, unseeded, its own backtester).
Non-dominated sorting follows the published definition.

## Core: `pareto.py` (`shared-pareto-1`)

- `evaluate(candidates, objectives, constraints)` returns, per candidate, a
  status (PARETO / DOMINATED / CONSTRAINED / INCOMPLETE), front rank,
  dominated-by count, a deterministic example dominator (the lowest-input-position
  rank-1 dominator), and constraint violations (`NOT_SATISFIED` or
  `MISSING_VALUE`); plus counts, front count, and a configuration hash.
- Constraints filter before dominance. Missing objective values are INCOMPLETE,
  never zero. Comparisons are exact: each objective's Decimal values are replaced
  by their dense order.
- **Performance:** the first full-ranking version (repeated O(n²) passes) took
  24 s for 5,000 candidates. Pairwise-once took 43 s at 10,000. PyArrow per-row
  vectorisation was slower, because its per-call overhead (about 150 µs)
  dominated. The final version uses **Python big-integer bitsets** (per objective,
  "rows ≥ value" masks; dominators = AND of masks minus identical vectors;
  ranks assigned in one descending-lexicographic pass): 0.01 s at 1,000,
  0.21 s at 10,000, and 0.65 s at 20,000 (3 objectives). Memory is about n²/8
  bytes per objective, hence the `MAX_CANDIDATES = 20_000` limit with
  `E_PARETO_TOO_MANY_CANDIDATES`. No new dependency.
- Tests (25): the P14 portfolio example, mixed directions with 3 objectives and
  fronts, ties and duplicates, constraints before dominance, missing values,
  exact Decimal, configuration errors, property tests (the frontier is mutually
  non-dominated, the example dominator is valid, counts and rank consistency,
  input-order invariance), **a brute-force cross-check on tie-heavy random
  data**, determinism, and the candidate limit. The Core suite is 132/132.

## Plugin: `components/tradeoff/`

- `scatter-layout.ts` (pure, tested): placement with padding, y upwards,
  missing values omitted and never drawn at 0, zero-span centring, a
  square-root size scale, a frontier polyline through PARETO points only
  (opt-in), nearest-point lookup in pixels, and keyboard order.
- `trade-off-scatter.tsx`: points as positioned elements (round at any aspect
  ratio), the ★ default, a selection ring, a hover/keyboard card with
  caller-provided details, a legend with counts, and "(higher/lower is
  better)" axis hints. It never labels anything "best".
- The plugin suite is 51/51 and the build passes.

## Real-data check (harness, not Obsidian)

The owner's `EA_DCA_CENT_V1_parameter_optimisation.xml` (162 passes) with Profit
MAX, Equity DD % MIN, and Trades ≥ 20 gives 21 PARETO, 71 DOMINATED, 70
CONSTRAINED, and 8 fronts. The `.set` default (Multiplier 5, Lot 0.01, OB 55,
OS 45) is **not among the passes**, which confirms the genetic-sampling
"default not tested" case the architecture anticipated. Hover and selection
were checked on real points.

## Not yet done

- No worker method exposes `pareto.evaluate` on its own; each consumer adds
  its own method (`portfolio.explore`, `exploration.evaluate`).
