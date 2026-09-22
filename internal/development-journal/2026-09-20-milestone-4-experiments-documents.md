# Milestone 4 — Experiments and Research Documents Implementation Record

**Date:** 2026-09-20  
**Status:** Closed; implementation and owner validation completed on 2026-09-21

## Scope implemented

- Explicit buttons create strategy, experiment, and report notes in the
  development-vault defaults. No vault scan or automatic document creation is
  used.
- Strategy/experiment/report links use UUIDv7 document IDs and explicit selected
  dataset/analysis identities.
- Report candidates come from the Research Core. Unchanged managed content,
  evidence, and configuration returns `NO_CHANGES_DETECTED` with no vault write
  or revision.
- Changed generated content requires confirmation, replaces only the exact
  marker block, increments `trl_report_revision`, and writes a Core-managed
  revision manifest.
- Existing strategies, experiments, and reports can be selected by explicitly
  opening one note in Obsidian, then invoking its matching current-note action.
  The plugin validates that file only and blocks mismatched document type or
  relationship; it does not scan the vault.

## Validation evidence

- Research Core: 22 pytest tests pass, including deterministic report payload,
  revision manifest, and worker-IPC cases.
- Plugin: 7 automated tests and the production TypeScript/esbuild build pass,
  including no-change detection, changed-only revisioning, user-prose
  preservation, and malformed-marker blocking.

## Manual review required

The owner completed the development-vault validation: strategy/experiment/report
creation and explicit reuse; no-change feedback/no write; warning and bounded
replacement after a generated-block change; preservation of prose outside the
block; malformed-marker blocking; visible local errors; and recovery to
`NO_CHANGES_DETECTED`. See `MILESTONE_4_CLOSURE_REPORT.md`.
