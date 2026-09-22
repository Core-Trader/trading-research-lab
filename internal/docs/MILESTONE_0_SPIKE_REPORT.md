# Milestone 0 — Architecture Spike Report

**Status:** Closed with explicit deferred validation risks  
**Date:** 2026-09-20  
**Recommendation:** Proceed to Milestone 1 specification and owner review; do
not begin Milestone 1 feature implementation yet.

## Decision

The locked desktop-only Obsidian plugin plus local Python Research Core approach
is viable. The live vertical slice imported an MT5 Strategy Tester Excel report,
wrote canonical Parquet/JSON data, calculated only qualified balance statistics,
rendered worker-owned results, and updated a bounded generated Markdown section
in the disposable development vault.

## Acceptance evidence

| Spike criterion | Result | Evidence / qualification |
| --- | --- | --- |
| Deterministic canonical output | Pass | Fresh-workspace regression test proves byte-identical `metadata.json` and `events.parquet` under canonical schema `1.1`. |
| Versioned local worker protocol | Pass with deferred crash test | Live handshake and structured unknown-method error verified; clean reload/restart exercised. Forced worker-crash recovery remains deferred. |
| Responsive plugin / no startup analysis | Pass, owner-confirmed | The owner confirmed the live plugin view and short-run behavior. No automatic analysis is started by plugin load. |
| Worker-owned statistics and chart | Pass | Live EURUSD run displayed worker-returned verified balance statistics and chart; plugin does not calculate financial results. |
| Bounded generated-note update | Pass | Live preservation review plus two automated duplicate-marker/bounded-update tests. |
| Windows local workflow | Pass for approved development path | Python virtual environment, Node/npm build, Obsidian vault junction, file Browse workflow, and local subprocess path worked. Portable MT5 terminal automation is not part of M0. |
| Dependency compatibility / licence review | Pass for local development only | Exact local versions/builds/imports recorded in `THIRD_PARTY_LICENSES.md`; distribution approval remains future work. |

## Baseline observation

The owner displayed a warm-worker local run with: readiness **1.3 ms**, MT5
import **35.2 ms**, verified statistics **3.2 ms**, report payload **3.0 ms**,
note write **2.0 ms**, view presentation **2.1 ms**, and total **46.8 ms**.

These values are local observations, not benchmarks, guarantees, or financial
results. Peak worker memory is explicitly **not captured in M0**; this is a
deferred performance-hardening concern, not a hidden result.

## What M0 does not establish

- It does not provide trade/position pairing, intratrade equity reconstruction,
  portfolio replay, prop-firm rules, Monte Carlo, optimisation analysis, or
  production packaging.
- It does not establish public-distribution licence compatibility or a final
  commercial product model.
- It does not replace further integration, forced-crash, performance, or
  portable-terminal validation.

## Required next planning artefact

Create the **Milestone 1 — Intake Foundation** specification, including raw
intake/provenance boundaries, canonical dataset registry, dataset-evidence
views, fixture plan, acceptance criteria, and manual-review checklist. Obtain
owner approval before implementing it.
