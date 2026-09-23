# 2026-09-23 — Neighbourhood analysis (PX-010, N1–N7)

The owner accepted N1–N7 as recommended ("proceed").

## Core (`neighbourhood.py`)

- `neighbourhood(study_ref, candidate_id, objectives, roles, radius,
  slice_axes, slice_metric)` returns:
  - coverage (possible and tested, by source), always
  - boundary distances
  - the tested neighbours, and the nearest tested settings (up to 5, with no
    statistics)
  - with at least 4 tested neighbours: the median, Q1/Q3/IQR (type 7), the
    candidate's rank, and the best neighbour and margin per objective
  - the profitable share and the worst neighbour equity DD
  - the isolated-peak flag (the margin over the best neighbour must exceed
    the IQR on every objective)
  - a 2-D slice with untested cells as null, defaulting to the two ordinal
    inputs with the fewest grid values
  - a configuration hash that covers roles, radius, attached runs, single
    tests, and the forward attachment
- Roles are ORDINAL (steppable `.set` inputs only), CATEGORICAL, or
  HELD_FIXED.
- `render_neighbourhood_set` and `write_neighbourhood_set`:
  - ranges are clipped to the `.set` range, and every other input is written
    with N
  - the file is UTF-16 LE with a BOM and CRLF, written in exclusive-create
    mode (never overwrites)
  - the box is recorded under `parameter-studies/<id>/neighbourhood-sets/`
- `attach_neighbourhood_run`:
  - the context and dates must equal the study's (otherwise BLOCKED)
  - it must match exactly one recorded box (otherwise BLOCKED)
  - held inputs are filled from the box
  - disagreeing duplicates give RESULTS_DIFFER_FROM_STUDY, and the study's
    pass is kept
- `render_choice(..., neighbourhood={roles, radius})` adds the coverage and
  flag lines to the choice block (N7).
- Worker methods: `exploration.neighbourhood`,
  `exploration.render_neighbourhood_set`,
  `exploration.write_neighbourhood_set`, and
  `exploration.attach_neighbourhood_run`.
- Tests: 15, covering:
  - brute-force box enumeration for every position, radius, and role set
  - the numeric signature, and categorical and held-fixed equality
  - the coverage threshold (3 vs 4 neighbours)
  - quartiles and the peak boundary (margin equal to the IQR is not flagged)
  - a flag on every objective
  - the slice, including its default axes
  - invalid roles and radius
  - the `.set` round-trip and clipping, and the UTF-16 no-overwrite write
  - run attachment: coverage 2 → 8 with a differing duplicate; BLOCKED for
    dates or an unknown box
  - the choice block, and worker determinism
- Total: 188 Core tests pass.

## Plugin

- `neighbourhood-model.ts` (pure, tested): default roles, coverage and
  statistics wording, heatmap shading (darker = better by direction;
  untested cells get no shade and are hatched), and the suggested `.set`
  path next to the study's `.set`.
- `neighbourhood-panel.tsx` shows, when a set is selected on the Parameters
  page:
  - the coverage line first, then an edge-of-range note
  - the isolated-peak line, and the statistics table
  - the neighbours table, or the nearest tested settings
  - the slice heatmap with axis and metric pickers
  - roles and radius controls
  - Prepare / Save `.set` and Attach neighbourhood run
- Recording a choice passes the current roles and radius.
- Tests: service IPC mapping and model tests; 68 plugin tests pass; the build
  is clean.

## Real-data verification

IS 2020–2024 study, 173 passes:
- The frontier coverage reproduces the spec §2 numbers exactly for r = 1,
  r = 2, and lot held fixed.
- None of the frontier sets is flagged as an isolated peak. Only 3 of 19 have
  enough neighbours at r = 1, and 10 of 19 at r = 2.
- Harness: Pass 133 shows 5 of 17 tested neighbours with statistics (not an
  isolated peak) and a 6 × 6 overbought × oversold map. The prepared `.set`
  has 9 runs and the suggested path is next to the study's `.set`.
- No page overflow at 360 px. Checked in the DOM only; screenshots time out
  while the owner is remote.

## Deferred (POST-MVP)

- Letting neighbourhood-run passes join the Pareto field (opt-in).
- Relative-distance neighbourhoods and composite scores.
