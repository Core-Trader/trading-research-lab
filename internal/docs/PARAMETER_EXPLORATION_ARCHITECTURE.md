# Parameter Exploration (Pareto) — Architecture Evaluation

**Status:** Architecture proposal for owner review, 2026-09-23. **No
implementation is authorised.** Decisions X1–X7 (§15) are needed first.
**Question:** how should TRL let the owner explore EA parameter trade-offs
(many parameter sets, several objectives, hard constraints, a visible default,
and owner-chosen trade-offs) without becoming an overfitting machine or
duplicating MT5?

## 1. Evidence gathered (owner's real files, 2026-09-23)

| Source | Finding | Consequence |
| --- | --- | --- |
| `EA_DCA_CENT_V1_parameter_optimisation.xml` | 162 passes; 4 optimised inputs (`InpMultiplierSystem` 6 values, `InpInitialLot` 47, `InpQQEOverbought` 6, `InpQQEOversold` 6) | The full grid is 10,152 points, so MT5 ran its **genetic** optimiser: the tested set is **sparse** |
| Same XML | Metrics: Result, Profit, Expected Payoff, Profit Factor, Recovery Factor, Sharpe Ratio, Custom, **Equity DD %**, Trades | A usable objective set exists without new calculation. Equity DD % is **MT5-computed equity** drawdown, better evidence than TRL's realised balance |
| Same XML | Only optimised inputs are listed; about 100 other EA inputs are absent | The default and fixed inputs must come from elsewhere |
| `EA_DCA_CENT_V1_FORWARD_IS.set` (UTF-16) | `InpQQEOverbought=55\|\|55.0\|\|5.0\|\|80.0\|\|Y` means value, start, step, stop, optimise | **MT5 already supplies the parameter schema and the default**, including fixed inputs |
| Single-test `.xlsx` reports | A "Results" section with MT5 summary statistics exists (currently not parsed) | A default or candidate single test can yield the **same MT5 metrics** as XML rows, so they are comparable |
| Existing TRL | `mt5_optimisation.intake_parameter_grid` (immutable XML intake, Parquet rows, pass ids); `intake_paired_forward_grid` (in-sample ↔ forward pairing by parameter signature) | The candidate table and IS/OOS join already exist |
| `MILESTONE_6_PARAMETER_SELECTION_DECISION_PACKAGE.md` | Owner decision: **defer automatic selection**; an owner-led review workflow was option 3 | This proposal fits option 3: TRL marks Pareto status, and the owner chooses |
| Strategy Factory `optimizer.py` | A single-objective DEAP genetic algorithm maximising Sharpe, returning `best_params`, unseeded, coupled to a vectorbt backtester | **Not reusable**: single-winner, needs price data, nondeterministic. No code reuse; the register is unchanged |

## 2. Answers to the owner's questions

1. **Fit with the architecture:** yes. Every calculation (schema parsing,
   metrics mapping, constraints, dominance, frontier, neighbourhood) is
   deterministic Core work over imported MT5 evidence. The plugin only
   configures, plots, inspects, and records the owner's choice. No locked ADR
   changes.
2. **Experiment subtype or module:** both, at different layers. In the
   research model it is an **Experiment of type `parameter_exploration`** under
   a Strategy (the EA). The owner's assumption holds: the experiment asks
   "which trade-offs does this EA's parameter space offer on symbol/period X?".
   In code it is a **Core module** (`parameter_exploration`) plus a shared
   **`pareto`** module that Portfolio Lab's explorer (PL-003) also uses.
3. **Reusable Core modules:** `mt5_optimisation` (XML intake, rows, pass ids,
   forward pairing), `identities.stable_uuid`, the dataset/raw-snapshot
   patterns, `performance_metrics` (for deep-dive single tests), `monte_carlo`
   (later robustness for a chosen candidate), and M4 reporting (Report notes).
4. **Can MT5 exports provide the dataset?** Mostly yes. The XML gives
   candidates and the MT5 metrics; the `.set` gives the schema, the default,
   and fixed inputs; the forward XML gives the out-of-sample view. Missing from
   the XML: daily drawdown, win rate, average win/loss, holding time, and trade
   lists. Those exist only for candidates the owner re-runs as single tests (a
   deep dive).
5. **Additional canonical schema:** §4.
6. **Objectives and constraints:** §5.
7. **Pareto calculation:** §6.
8. **The default set:** §7.
9. **Neighbourhood analysis later:** §8.
10. **Most useful MVP UX:** §9.
11. **Smallest end-to-end slice:** §10. The owner's proposed slice is right,
    with two additions: `.set` import and a default fallback.
12. **Deferred:** §12.
13. **External references:** Strategy Factory's optimiser is conceptually
    opposite (single best) and not reusable. Its walk-forward loop re-optimises
    with price data, so it is not applicable either. Journalit has no
    optimisation UI; its scatter/card patterns are already reflected
    independently. **No external code is reused.**
14. **Provenance:** nothing to register.

## 3. Module architecture

```
Core (Python, authoritative)
  mt5_set.py                 parse .set -> ParameterSchema (+ default)      [new]
  mt5_optimisation.py        XML intake (existing) + forward pairing (existing)
  mt5_excel.py               + Results-section summary (MT5_REPORTED)        [extend]
  pareto.py                  dominance, fronts, constraint filtering         [new, shared]
  parameter_exploration.py   study assembly, metric catalogue, evaluate      [new]
  neighbourhood.py           local statistics over the schema grid           [later]

Worker methods (versioned JSON IPC)
  exploration.intake_parameter_schema(source_path)       .set -> schema artifact
  exploration.create_study(optimisation_ref, schema_ref, forward_pair_ref?)
  exploration.evaluate(study_ref, objectives, constraints) -> statuses + frontier
  exploration.neighbourhood(study_ref, candidate_id, metric)   [later]

Plugin (TypeScript/React, presentation)
  Research -> Experiment "Parameter exploration": import XML + .set, choose
  objectives and constraints, TradeOffScatter (shared with Portfolio explorer),
  CandidateInspector, CompareTable (DEFAULT vs A vs B), record the selection
  in the Experiment note.
```

## 4. Data model (mapped to Strategy → Experiment → Results → Report)

| Proposed concept | TRL mapping | Storage |
| --- | --- | --- |
| OptimizationStudy | **Experiment** (`trl_experiment_type: parameter_exploration`) + a Core **study manifest** | Experiment note (Markdown/YAML) + JSON manifest |
| ParameterDefinition | Entry in a **ParameterSchema** parsed from `.set` (name, raw value type, default, start, step, stop, optimise Y/N) plus an owner-declared `ordinal` flag | JSON artifact (source hash, parser version) |
| ParameterSet / CandidateResult | An existing optimisation **pass row** (`trl_pass_id`, parameter signature, MT5 metric strings) | Existing Parquet table |
| OptimizationRun | The imported MT5 optimisation (XML intake, `optimisation_ref`); a forward XML is a paired run | Existing manifests |
| ObjectiveDefinition | `{metric_id, direction: MAX\|MIN}` in the evaluation configuration | JSON configuration (hashed) |
| ConstraintDefinition | `{metric_id, operator: >=\|<=, threshold (decimal string)}` | JSON configuration (hashed) |
| ParetoFront / statuses | **Evaluation result**: per candidate, feasibility, violated constraints, Pareto rank (1 = frontier), dominated-by count | Versioned JSON/Parquet result keyed by `evaluation_id` |
| CandidateSelection | The owner's choice, recorded in the **Experiment note** (candidate id, parameter signature, evaluation id, reason text) and optionally exported as `.set` later | Markdown/YAML (human decision) |
| Comparison | A **Report** (M4) with DEFAULT vs selected candidates | Report note + payload |

The metric catalogue maps MT5 columns to TRL metric ids with direction, unit,
and basis:

| MT5 column | TRL id | Default direction | Basis |
| --- | --- | --- | --- |
| Profit | `net_profit` | MAX | MT5_REPORTED |
| Equity DD % | `equity_drawdown_pct` | MIN | MT5_REPORTED (equity) |
| Profit Factor | `profit_factor` | MAX | MT5_REPORTED |
| Recovery Factor | `recovery_factor` | MAX | MT5_REPORTED |
| Expected Payoff | `expected_payoff` | MAX | MT5_REPORTED |
| Sharpe Ratio | `mt5_sharpe` | MAX | MT5_REPORTED (MT5's definition, labelled as such) |
| Trades | `trades` | constraint only by default | MT5_REPORTED |
| Result, Custom | not objectives by default (optimiser criterion / user formula) | — | MT5_REPORTED |

## 5. Objectives, constraints, preferences (kept separate)

- **Objectives:** 2–4 catalogue metrics with a direction. There is no weighting.
- **Constraints:** hard filters applied **before** dominance. A candidate
  failing any constraint is `CONSTRAINED` and records which constraints failed
  and by how much. It is kept in the result, never deleted.
- **Constraint profiles:** named, user-saved constraint sets (for example "My
  prop plan"). Prop-firm profiles later map onto the same structure; no firm's
  rules are hard-coded.
- **Preferences (deferred):** after the frontier exists, optional aids
  (aspiration levels, a preferred box on the scatter, or explicit weights with
  the formula shown) that **highlight** without replacing the Pareto status. A
  weighted score is never the default.

## 6. Pareto implementation

- Exact dominance over feasible candidates using Decimal values after
  direction normalisation: *a* dominates *b* iff *a* is ≥ on every objective
  and > on at least one. Candidates missing an objective value are
  `INCOMPLETE`, excluded from dominance, and shown.
- **Fronts:** rank 1 = non-dominated; rank *k* = non-dominated after removing
  ranks < *k*. Also a dominated-by count per candidate. Ties keep equal status.
- **Algorithm:** a simple non-dominated sort (O(m·n²)). It is exact and
  auditable, and fine for MT5 outputs. Measured 2026-09-23 (pure Python,
  Decimal, 3 objectives, first front only): 0.07 s for 2,000 candidates and
  0.63 s for 10,000. Full multi-front ranking costs more; benchmark it with
  the implementation. For exactly two
  objectives, the sort-and-sweep O(n log n) method gives the same answer and
  is used when faster.
- **Audit output:** per candidate, the raw metric strings, normalised
  objective values, feasibility, violated constraints, rank, dominated-by
  count, and (on request) one dominating example.
- **Determinism:** results depend only on the study, the configuration hash,
  and the version.

## 7. Default set representation

- The `.set` value column **is** the default ParameterSet. The Core computes its
  parameter signature over the optimised inputs and looks it up among the XML
  passes.
- **Found:** the default is a normal candidate with the flag `is_default` and
  gets the same Pareto treatment (never favoured, never hidden).
- **Not found** (likely with genetic sampling): the star is shown as "not
  tested in this optimisation". Fallback: the owner runs the default as a single
  test and imports it. The Core parses that report's MT5 Results summary
  (`MT5_REPORTED`) into the same metric ids, so the default can be placed on the
  same axes with a "single-test source" badge.
- Fixed (non-optimised) inputs must match between the `.set` and the
  optimisation context. A mismatch is flagged, never silently accepted.

## 8. Neighbourhood / plateau analysis (later; definition first)

- **Neighbourhood definition:** using the schema grid (start/step/stop), the
  neighbours of candidate *c* are the grid points within ±*r* steps (default
  *r* = 1, Chebyshev distance) on **ordinal** parameters, with categorical
  parameters (such as `InpMultiplierSystem`, a mode switch) held equal
  (decision X5).
- **Report coverage first:** with genetic sampling, most neighbours are
  untested. Always report `tested / possible` neighbours; with low coverage no
  local statistic is shown.
- **Descriptive statistics only** (no composite score): count; median and
  interquartile range of each objective among tested neighbours; share with
  net profit > 0; the candidate's value relative to the local median (a
  percentile within the neighbourhood); worst neighbour equity DD %; and
  distance in steps to each range boundary.
- **Isolated-peak evidence** (a documented rule, not a score): the candidate
  exceeds all tested neighbours by more than the neighbourhood IQR. It is shown
  as a flag with the numbers, so the owner judges.
- **Targeted neighbour runs:** TRL can emit a small `.set` covering the ±1-step
  box around a chosen candidate for a full-grid MT5 run, turning a sparse
  region dense where it matters.

## 9. MVP UI/UX concept

1. **Study setup:** choose the Strategy, import the optimisation XML and `.set`,
   and optionally the forward XML. A summary shows passes, optimised inputs with
   ranges, full-grid size compared with tested, and whether the default was
   found.
2. **Trade-off field (main view):** a scatter with selectable X/Y axes (default
   X = Equity DD %, Y = Profit). Points are dim when constrained, filled when
   feasible, outlined on the frontier; ★ marks the default; the selected
   candidate is ringed. Optional size = Trades. The frontier can be drawn as a
   step line. A legend explains each state. No "best" label anywhere.
3. **Objective and constraint panel:** add or remove objectives (metric +
   direction), constraints (metric, operator, threshold), and a live count
   ("162 candidates, 47 feasible, 9 on the frontier").
4. **Candidate inspector** (hover/click): parameter values (differences from
   the default highlighted), all MT5 metrics, constraint results, Pareto rank
   and dominated-by count, and forward metrics when paired.
5. **Compare:** DEFAULT vs up to three pinned candidates, as a parameter-diff
   table and a metric table with in-sample and forward columns.
6. **Record choice:** write the owner's selected candidate and reasoning into
   the Experiment note (explicit button, bounded generated block, M4 safety).

## 10. Smallest end-to-end slice

```
.set import (schema + default)  +  existing XML intake
        -> create study (join, default lookup, metric catalogue)
        -> evaluate(objectives, constraints)  [Core pareto]
        -> scatter + default star + frontier + constrained states
        -> click candidate -> inspector
        -> compare DEFAULT vs candidate (MT5 metrics + parameter diff)
```

This matches the owner's proposal. Additions: `.set` import (so the default and
schema are verified, not typed) and the explicit "default not tested" state.
The single-test Results-summary parser for the default is the **first
follow-up**, not part of the thinnest slice.

## 11. Testing strategy

- **`.set` parser:** UTF-16/UTF-8 files, enum steps of 0, booleans, strings,
  malformed lines, and a stable hash. Fixtures are synthetic, plus an
  owner-real file checked locally only.
- **Pareto:** hand-computed fixtures (2 and 3 objectives; ties; duplicates;
  MIN/MAX mix; missing values; a constrained point that would otherwise
  dominate) and property tests (frontier members are mutually non-dominated;
  every dominated point has a dominating frontier member; invariance to input
  order; the two-objective sweep equals the general sort).
- **Study:** default found and not found; parameter-signature mismatch;
  fixed-input mismatch; forward join.
- **Plugin:** scatter geometry, state styling, inspector mapping, and
  configuration serialisation. No dominance logic in TypeScript (a test asserts
  the plugin renders only Core statuses).
- **End to end:** the owner's real XML and `.set` in a temporary workspace
  (local only; nothing committed).

## 12. Deferred (post-MVP)

- Parameter-space **generation** inside TRL (grid, random, Latin hypercube).
  MT5 already generates and runs. TRL may later emit `.set` range files and
  targeted neighbour boxes (§8), still without running backtests.
- **Neighbourhood analysis** (after its definition is approved),
  walk-forward consistency beyond single IS/forward pairs, Monte Carlo
  survival per candidate, spread/slippage sensitivity, and cross-symbol and
  cross-period robustness.
- **Preference aids**, including weighted scores (only with the formula shown
  and never as the default).
- Deep-dive per-candidate metrics that need trade lists (daily drawdown, MAE/MFE,
  holding time). These need single-test re-runs, and for equity the PL-006
  logger.
- `.set` **export** of a selected candidate (small, but it creates a
  live-configuration artifact, so it needs an explicit decision).
- 3-D views, parallel-coordinates plots, and GPU-scale candidate sets.

## 13. Relationship to Portfolio Lab

The dominance engine (`pareto.py`) and the scatter component are shared. The
Portfolio Lab explorer (PL-003, slice 4) needs exactly the same "all
candidates, objectives, optional frontier, no winner" machinery, with
combinations instead of parameter sets. Building the shared layer once avoids
two Pareto implementations.

## 14. Implementation sequence (proposed)

1. **Shared Pareto core** (`pareto.py`) with fixtures and property tests.
2. **Shared `TradeOffScatter`** plugin component (states, default star,
   selection, hover).
3. Portfolio Lab slice 3 (named combinations) and slice 4 (explorer), the
   first consumer, reusing 1–2.
4. `.set` parser + study assembly + `exploration.evaluate`.
5. Parameter exploration UI (setup, field, constraints, inspector, compare,
   record choice in the Experiment note).
6. Follow-ups: Results-summary parser for default/candidate single tests;
   forward metrics in the inspector; the neighbourhood spec, then implementation.

## 15. Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| X1 | Allow Pareto-status marking of **parameter sets** (descriptive; the owner chooses; no automatic winner)? This amends the 2026-09-22 selection deferral in the way option 3 anticipated. | **Yes** |
| X2 | Model it as an Experiment of type `parameter_exploration` under a Strategy, with a Core module and a shared `pareto` layer? | **Yes** |
| X3 | MVP metric set = MT5-reported Profit, Equity DD %, Profit Factor, Recovery Factor, Expected Payoff, MT5 Sharpe, Trades (default X = Equity DD %, Y = Profit)? | **Yes** |
| X4 | Import `.set` as the MT5-verified parameter schema and default; add the Results-summary parser for single tests as the first follow-up? | **Yes** |
| X5 | Parameter kind: TRL infers numeric/ordinal from the `.set` (step > 0), and the owner can mark a parameter **categorical** (e.g. `InpMultiplierSystem`) for neighbourhood purposes? | **Yes** |
| X6 | Order: shared Pareto core and scatter, then Portfolio slices 3–4, then parameter exploration? | **Yes** (one engine, two consumers) |
| X7 | Record the owner's chosen candidate only in the Experiment note for now; `.set` export later by separate decision? | **Yes** |
