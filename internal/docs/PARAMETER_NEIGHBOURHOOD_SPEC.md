# Parameter neighbourhood analysis: specification

**Status:** DRAFT for owner approval (drafted 2026-09-23 at the owner's
request). No implementation is authorised until decisions N1–N7 are answered.

**Builds on:** `PARAMETER_EXPLORATION_ARCHITECTURE.md` §8, and PX-001, PX-005,
and PX-007.

## 1. Question it answers

"If I pick this parameter set, do the settings around it behave similarly, or
is it an isolated lucky peak?" A robust setting sits on a **plateau**: small
changes to its inputs give similar results. A fragile one is a **spike** whose
neighbours are much worse. TRL describes the neighbourhood; it does not score
or choose.

## 2. Evidence from the owner's real data (why coverage comes first)

Study: `EA_DCA_CENT_V1_IS_2020-2024.xml` with `.set`, 173 genetic passes.

| Parameter | .set range | Values possible | Values tested | Kind |
| --- | --- | --- | --- | --- |
| InpMultiplierSystem | 0–5 (mode switch) | 6 | 6 | categorical (not ordinal in the study; X5) |
| InpInitialLot | 0.01–0.50, step 0.01 | 50 | 47 | ordinal |
| InpQQEOverbought | 55–80, step 5 | 6 | 6 | ordinal |
| InpQQEOversold | 20–45, step 5 | 6 | 6 | ordinal |

Neighbourhoods are ±r steps on the ordinal parameters (Chebyshev distance),
with the categorical mode held equal:

| Neighbourhood | Possible neighbours (median) | Tested (median, all passes) | Tested, 19 frontier passes | Passes with none tested |
| --- | --- | --- | --- | --- |
| r = 1, lot varies | 17 | 0 | 0,0,0,0,0,0,0,0,0,1,1,2,2,2,3,3,4,4,5 | 56% |
| r = 2, lot varies | 74 | 1 | 0,1,1,2,2,2,3,3,3,4,5,6,6,7,9,9,11,12,13 | 25% |
| r = 1, lot held fixed | 8 | 0 | 11 of 19 have 0 | — |

The genetic optimiser tested 116 of the 216 logic cells (mode × overbought ×
oversold), with a median of one pass per cell.

**Conclusion:** on typical genetic output, a neighbourhood statistic is
unavailable for most settings, **including most frontier settings**. The
feature must therefore:
1. show coverage honestly before anything else
2. give the owner a cheap way to fill the gap: a targeted full-grid MT5 run
   around the chosen setting (§5)

## 3. Definitions

- **Parameter roles.** Each study parameter has one of three roles:
  - **ordinal**: stepped, and neighbours differ by ±steps. Default when the
    `.set` step is greater than 0.
  - **categorical**: must be equal. Owner-marked, per X5.
  - **held fixed**: must be equal. Owner-marked, for inputs that mainly
    rescale risk rather than change logic, such as a lot size.

  The roles are part of the analysis configuration and its hash.
- **Neighbourhood N(c, r):** every grid point (from the `.set` start, step,
  and stop) whose ordinal parameters are each within ±r steps of candidate c,
  with at least one differing, all categorical and held-fixed parameters
  equal, and every value inside its `.set` range. The default r is 1; the
  owner may choose 2.
- **Tested neighbours:** the points in N(c, r) that have a pass in the study,
  or in an attached neighbourhood run (§5), matched by normalised parameter
  signature (the forward-pairing rule: `0.02` = `0.020`).
- **Coverage** = tested ÷ possible, always shown as "k of n".
- **Sufficient coverage:** at least **4** tested neighbours (N2). Below that,
  TRL shows no statistics, only the list and the coverage.

## 4. Output (Core, per candidate and per objective metric)

Everything is descriptive and uses the study's MT5-reported metrics and the
evaluation's objective directions.

1. **Coverage:** possible, tested, and the r and roles used. Distance in steps
   from the candidate to each range boundary (a setting at the edge of the
   `.set` range has an unexplored side).
2. **Nearest tested settings** (always, even with low coverage): up to 5
   tested passes, ordered by Chebyshev step distance and then by signature,
   each with its distance and differing inputs (N3). No statistics are
   computed from them.
3. **With sufficient coverage, for each objective metric:**
   - the count, median, and interquartile range among the tested neighbours
   - the candidate's value and its rank within {candidate + tested neighbours}
     ("better than 5 of 6")
   - the share of neighbours with net profit > 0
   - the worst neighbour's equity DD %
   - the forward values of the neighbours when a forward export is attached
     (context only)
4. **Isolated-peak flag (N5):** set when, on every objective, the candidate is
   better than **all** tested neighbours by more than that objective's
   neighbourhood IQR. It is shown as a flag with the numbers, never as a score.
5. **Two-dimensional slice (N6):** for two ordinal parameters the owner picks
   (default: the first two, excluding held-fixed ones), with all other
   parameters equal to the candidate's, the full grid of cells:
   - tested cells carry the chosen metric's value
   - untested cells are explicitly `null`
   - the candidate's cell is marked
6. **Determinism:** exact Decimal arithmetic, with quartiles by the same
   method as the performance metrics (to be named in the fixture plan).
   Neighbour order is stable.

## 5. Filling the gap: targeted neighbourhood run (N4; amends PX-007)

TRL writes a **new** `.set` file whose ranges cover N(c, r):
- ordinal parameters: start = value − r·step and stop = value + r·step,
  clipped to the original range, with the original step and Y (optimise)
- categorical and held-fixed parameters: fixed at the candidate's value, N
- every other input: copied unchanged from the study's `.set`

Rules:
- The file goes to a location the owner picks. It never overwrites an
  existing file, and the owner is shown the number of runs before saving
  (r = 1 with three ordinal parameters gives at most 27 runs).
- The owner runs MT5 with **"Slow complete algorithm"** (full grid) on the
  same symbol, timeframe, dates, deposit, and modelling mode, then attaches
  the XML to the study as a **neighbourhood run**.
- Pairing reuses the forward checks: context must match (BLOCKED otherwise),
  inputs must match, and the **periods must be equal** (BLOCKED otherwise,
  because a neighbour tested on other dates is not a neighbour).
- Runs whose signature is already in the study must agree on the metrics.
  Disagreement is flagged as a WARNING, and the study's pass is kept.
- Neighbourhood-run passes count as tested neighbours. They join the Pareto
  field only if the owner opts in, because they are extra passes.

TRL still never runs backtests itself.

## 6. Core API (versioned IPC)

- `exploration.neighbourhood(study_ref, candidate_id, objectives, roles,
  radius, slice_axes?, slice_metric?)` returns everything in §4, plus
  `calculation_version`, a `configuration_hash` (roles, radius, study, and
  attached runs), and `warnings`.
- `exploration.render_neighbourhood_set(study_ref, candidate_id, roles,
  radius)` returns the `.set` text and the run count. The plugin writes the
  file only after the owner picks the location and confirms.
- `exploration.attach_neighbourhood_run(study_ref, optimisation_ref)` returns
  an attachment with findings (READY or BLOCKED), stored like `forward.json`
  under the study folder.
- Module: `neighbourhood.py`, reusing the study reader and the signature
  normalisation from `parameter_exploration.py`.

## 7. Plugin UI (Parameters page)

When a candidate is selected, show a **Neighbourhood** panel:

1. A coverage line, always first. Examples:
   - "3 of 17 neighbouring settings were tested (±1 step; mode held equal)"
   - "Too few tested neighbours for statistics"
2. The nearest tested settings table: distance, differing inputs, and
   objective values.
3. With sufficient coverage, a small statistics table per objective (median,
   IQR, the candidate's rank) and the isolated-peak flag, if set, with its
   numbers.
4. A slice heatmap: two parameter pickers and a metric picker. Untested cells
   are hatched, never coloured as zero. The candidate's cell is outlined, and
   hovering shows the exact value. The heatmap is drawn from Core cells only.
5. "Save a neighbourhood .set for MT5…", showing the run count and the MT5
   settings to use, and "Attach neighbourhood run (.xml)…".
6. Role controls: per parameter, ordinal, categorical, or held fixed, with the
   defaults from the `.set`.

The recorded choice block (PX-007) gains one line with the coverage, the
flag, and the neighbourhood configuration hash (N7).

## 8. Tests and fixtures (to detail in a fixture plan after approval)

- The grid enumeration matches a brute-force count, including range clipping,
  categorical and held-fixed equality, and r = 1 and r = 2.
- The signature matching is numeric (`0.02` = `0.020`).
- The coverage threshold: 3 tested neighbours give no statistics; 4 give
  statistics.
- The isolated-peak rule on a hand-built plateau (not flagged), a spike
  (flagged), and a tie at the IQR boundary.
- The `.set` rendering round-trips through `parse_set_text`. Clipping at range
  edges, the Y/N flags, and unchanged fixed inputs are checked, and the run
  count equals the grid size.
- Neighbourhood-run attachment: BLOCKED for a context or period mismatch, a
  WARNING for disagreeing duplicates.
- Determinism: the same hash and output across runs.
- Real-data check: the coverage numbers in §2 are reproduced.

## 9. Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| N1 | Neighbourhood = the ±r-step grid box (Chebyshev) on ordinal parameters, with categorical and **held-fixed** parameters equal; default r = 1, and r = 2 selectable. Adds the "held fixed" role (for example `InpInitialLot`). | **Yes** |
| N2 | Minimum 4 tested neighbours before any statistic is shown. | **Yes** |
| N3 | Always show up to 5 nearest tested settings with their distances, without statistics. | **Yes** |
| N4 | TRL may write a new neighbourhood `.set` file (never overwriting) for a full-grid MT5 run, and attach the result. Amends PX-007, which reserved `.set` export for a separate decision. | **Yes**: the only practical fix for genetic sparsity |
| N5 | Isolated-peak flag = better than every tested neighbour by more than the neighbourhood IQR on every objective, shown with the numbers and never as a score. | **Yes** |
| N6 | A 2-D slice heatmap with untested cells hatched. | **Yes** |
| N7 | Add the neighbourhood coverage, the flag, and the configuration hash to the recorded choice block. | **Yes** |

## 10. Deferred (POST-MVP)

- Neighbourhoods measured in relative (%) distance instead of steps.
- Weighting neighbours by distance, or any composite robustness score.
- Automatic MT5 runs.
- Neighbourhoods across symbols or periods.
- Monte Carlo per neighbour.
