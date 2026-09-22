# Milestone 1 — Intake Foundation Baseline

**Date:** 2026-09-20  
**Status:** Closed, 2026-09-20

## Decision implemented

Accepted MT5 Strategy Tester Excel sources are first validated by the Python
Research Core. Only then does the Core create a bounded, SHA-256-verified raw
snapshot at `.trl-data/raw/<SOURCE_SHA256>/source.xlsx`, write the existing
deterministic canonical dataset, and atomically update
`.trl-data/registry/datasets.json`. The selected original is never modified.

The JSON receipt/registry entry records the original local path in the private
development workspace, source identity, snapshot status, adapter/configuration,
schema/core versions, MT5-supplied facts, price-scale observations, canonical
artifact references, warnings, and explicit limitations. It is not product
export material.

## User-facing behavior

The Obsidian panel now runs verified intake before the existing M0 balance-only
analysis. It renders Core-returned evidence, shows whether a snapshot was newly
created or an identical source was reused, refreshes the registry, and can
re-hash the managed snapshot on demand. No financial calculation moved into the
plugin.

## Regression discovered during implementation

The test fixture exposed two importer compatibility details:

1. MT5 semantic direction values are now normalized case-insensitively before
   classification (`Out` and `out` are equivalent).
2. Price-scale detection now correctly reads standard Excel formats such as
   `0.00000`; this is required to preserve observed decimal conventions for
   symbols such as JPY pairs without inventing precision.

## Automated evidence

- Research Core: 7 tests passed from `research-core/`.
- Plugin: 2 tests passed and the TypeScript/esbuild production build passed.

## Closure

The owner completed the development-vault review. Automated tests now cover the
remaining ambiguous-source, byte-modified-source, and tampered-snapshot cases.
Milestone 1 closed with 10 passing Research Core tests, 2 passing plugin tests,
and a passing production plugin build. See
`internal/docs/MILESTONE_1_CLOSURE_REPORT.md`.

## Live-review feedback follow-up

The owner confirmed source preservation, snapshot intake, duplicate reuse, and
registry refresh. The initial on-demand snapshot-verification action updated
only the transient top-of-panel status, so its success was too easy to miss.
The evidence panel now retains an explicit `Snapshot check — VERIFIED` result
after the button is pressed and also presents a short desktop confirmation.
Refreshing the registry keeps `Latest intake` visible when it refreshes the
currently displayed dataset. The updated plugin tests and production build pass.
