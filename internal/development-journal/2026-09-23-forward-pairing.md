# 2026-09-23 — Parameter exploration: forward (out-of-sample) pairing

Approved step 6 follow-up (PX-004/PX-005): show how each tested setting did on
the MT5 forward period.

## Core (`parameter_exploration.py`)

- `attach_forward(workspace, study_ref, forward_optimisation_ref)`, worker
  method `exploration.attach_forward`. The forward XML is intaken through the
  existing `optimisation.intake_parameter_grid` (immutable, hashed).
- Pairing is by the study's parameter signature with numeric normalisation
  (`0.02` = `0.020`). Periods are read from both MT5 titles.
- Findings: CONTEXT_DIFFERS and PARAMETERS_DIFFER (BLOCKED), PERIODS_OVERLAP
  and FORWARD_BEFORE_IN_SAMPLE (WARNING, "not out-of-sample evidence"),
  PERIOD_GAP (NOTE), PERIODS_UNVERIFIABLE, FORWARD_DUPLICATE_SIGNATURES.
- A READY attachment is stored as `parameter-studies/<id>/forward.json`. A
  BLOCKED attempt is reported but never replaces an earlier READY attachment.
- `evaluate` (now `mvp-parameter-evaluation-2`) returns the `forward` summary,
  including matched, in-sample-only and forward-only counts, and a
  per-candidate `forward` object (`{pass, metrics}` or null). The forward ref
  is part of the configuration hash. The Pareto status stays in-sample only;
  forward values are shown, never ranked.
- Tests: contiguous join with the numeric signature, overlap warning, parameter
  mismatch, and blocked-not-used (167 Core tests pass).

## Plugin

- `ResearchService.attachForward`, and the `ForwardSummary` and
  `ForwardAttachment` types.
- Model (`exploration-model.ts`): `FORWARD_PREFIX` axis ids, `metricValue`,
  `axisOptions`, and "Forward: …" compare rows ("no forward match" for
  unpaired passes). Tested (62 plugin tests pass; build OK).
- Parameters page:
  - "Attach forward results (.xml)…", with a paired-count summary and findings
  - "Forward: …" options for X, Y, and size (unpaired passes counted as not
    plotted; colours stay in-sample)
  - a forward line in the hover card and a caveat when the periods overlap

## Real-data check (local, not committed)

- IS 2020–2024 + FORWARD 2025: 11 paired, 162 in-sample-only, and 159
  forward-only. MT5's genetic optimiser seldom re-runs the same sets, so the
  pairing is sparse.
- 2020–2025 + "2020-2025_FORWARD": the titles have identical periods, which
  triggers the PERIODS_OVERLAP warning.

## Limitations / follow-ups

- Single-test candidates are not paired with forward passes.
- There is no "detach forward" action; attaching another READY export replaces
  the current one.
- Not validated in Obsidian.
- Sparse genetic overlap limits usefulness. Running the forward period as MT5's
  built-in forward optimisation (same run) gives full pairing and is the
  recommended collection method.
