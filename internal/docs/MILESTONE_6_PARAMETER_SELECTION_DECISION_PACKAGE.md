# Milestone 6 — Parameter Selection Decision Package

**Status:** Owner decision recorded — automatic selection deferred; no
implementation authorised.  
**Depends on:** accepted paired forward evidence viewer and its strict
signature-pairing boundary.

## Purpose

Decide whether Trading Research Lab should ever add a reproducible method that
*selects* one or more parameter rows from paired MT5 optimisation evidence. The
current viewer deliberately does not do this.

## Why this is a separate decision

The paired XML files establish source-reported outcomes for a fixed grid; they
do not establish a universally valid objective, acceptable risk limit,
instrument metadata, a live trading context, or that one period generalises.
Selecting a row therefore adds a material research policy, rather than merely a
display feature.

Strategy Factory's rolling walk-forward and optimiser-selected `best_params`
patterns were reviewed as concepts only. They are not compatible with the
current precomputed, source-preserving MT5 evidence boundary and are not
adopted here.

## Possible owner choices

1. **Defer selection (recommended now).** Keep paired evidence inspection-only
   while additional independently comparable runs are collected.
2. **Define a transparent screening rule.** The owner would approve a bounded,
   versioned rule over named source-reported columns. It would produce a
   qualified research candidate list, not a live-trading recommendation.
3. **Define an owner-led qualitative review workflow.** The product would
   preserve evidence and decision notes without ranking rows automatically.

## Required policy choices before any implementation

- exact eligible source schema and compatible EA/test contexts;
- whether a result may use in-sample metrics only as guardrails, and which
  forward metrics are evaluated;
- metric definitions, units, missing-value rules, direction, thresholds, and
  deterministic tie-breaking;
- whether multiple candidates may remain rather than forcing one winner;
- required warnings, minimum evidence, and prohibited claims;
- result identity, source hashes, policy/configuration version, and output
  format; and
- deterministic synthetic fixtures, negative cases, acceptance criteria, and
  owner-panel review.

## Non-negotiable exclusions

The first selection policy must not claim future profitability, robustness,
prop-firm compliance, live suitability, equity drawdown, currency conversion,
or a recommended EA configuration. It must block incompatible or incomplete
inputs and must never overwrite the paired evidence.

## Owner decision

On 2026-09-22, the owner selected **defer automatic selection**. Continue
collecting like-for-like paired runs and use the accepted side-by-side evidence
viewer for human inspection. Revisit this package only when the owner is ready
to choose a research objective and explicit evidence thresholds.

## Amendment (2026-09-23)

The owner approved descriptive, owner-led parameter exploration (PX-001): TRL
may mark constraint status and Pareto rank for parameter sets, and the owner
chooses. Automatic selection of a single winner remains deferred. See
`PARAMETER_EXPLORATION_ARCHITECTURE.md`.
