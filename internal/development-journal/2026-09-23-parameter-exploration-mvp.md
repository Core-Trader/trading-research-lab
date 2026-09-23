# 2026-09-23 — Parameter exploration MVP (build steps 3–4)

**Authority:** PX-001–PX-007, `PARAMETER_EXPLORATION_ARCHITECTURE.md` §10 and §14.
**External code:** none.

## Step 3 — Core

- `mt5_set.py` (`mt5-set-parser-1`): decodes UTF-16 (BOM or bare LE) and UTF-8
  (with or without BOM); parses `name=value[||start||step||stop||Y/N]`; kinds
  NUMERIC / BOOLEAN / TEXT; `ordinal` when numeric with step > 0; an integer
  range with step 0 counts as categorical values; value counts; full grid size
  for optimised inputs. Immutable snapshot plus `schema.json` under
  `parameter-schemas/<SHA>/`; ref `mt5-set:<SHA>`.
- `parameter_exploration.py`:
  - `create_study(optimisation_ref, schema_ref?)`: metric catalogue (MT5 column
    → TRL id, label, default direction, unit, basis MT5_REPORTED);
    per-parameter kind, ordinal, default, range, and tested values; findings
    `PARAMETER_NOT_IN_SCHEMA` (BLOCKED), `OPTIMISED_SET_DIFFERS`,
    `VALUES_OFF_SCHEMA_GRID`, `DEFAULT_NOT_TESTED`, `FIXED_INPUTS_UNVERIFIABLE`,
    `NO_SCHEMA`; default lookup by numerically equal signature. Written to
    `parameter-studies/<id>/study.json`.
  - `evaluate(study_ref, objectives, constraints)`: shared Pareto layer over all
    passes; candidates carry parameters, metrics, the default flag, and status.
  - `render_choice(...)`: **re-evaluates in the Core** and renders the choice
    Markdown (study, evaluation id, objectives, constraints, candidate status,
    parameter-versus-default table, MT5 metrics, and the owner's verbatim
    reason, marked "not a recommendation").
- Worker methods `exploration.intake_parameter_schema`, `create_study`,
  `evaluate`, `render_choice`. 21 new tests; Core 159/159.
- Real files: the study is READY with 162 of 10,800 passes, `DEFAULT_NOT_TESTED`,
  no off-grid values; with trades ≥ 20 the evaluation gives 21 / 71 / 70.

## Step 4 — Plugin "Parameters" page

- `components/exploration/parameter-explorer.tsx`:
  1. Study: XML, optional `.set`, and a user-declared modelling mode; "Create
     study" imports, builds the study, and runs a first evaluation.
  2. Summary: passes against the full grid, default status, parameter table,
     and findings.
  3. Objective and constraint editor (up to 4 objectives), with a stale-result
     warning and "Re-evaluate".
  4. Trade-off field with selectable X/Y/size (frontier line only when the axes
     equal the two objectives), a hover card with parameters and violations,
     and selection.
  5. Pin up to 3 passes and compare them with the default (parameter
     differences highlighted; "not tested" when the default is not among the
     passes).
  6. Record the choice in the currently selected Experiment note, through the
     Core-rendered Markdown and a bounded marker block
     (`vault/choice-block.ts`: append, replace only its own block with
     confirmation, block on malformed or duplicated markers).
- `exploration-model.ts` (pure, tested) and `choice-block.ts` (tested).
  Plugin 60/60; build passes.
- Harness run with a stand-in service replaying **real** Core output: study
  summary, evaluation (30 frontier / 132 without constraints; 21 / 71 / 70 with
  trades ≥ 20), stale warning, keyboard selection, pin and compare (3 differing
  parameters highlighted), and record callback. **Not validated in Obsidian.**

## Limitations / follow-ups

- The default can only be placed when it is among the passes. The approved
  follow-up is the single-test Results-summary parser.
- Forward (out-of-sample) metrics are not yet shown in the inspector.
- Recording uses whichever Experiment is selected under Research; there is no
  dedicated "parameter exploration experiment" template yet.
