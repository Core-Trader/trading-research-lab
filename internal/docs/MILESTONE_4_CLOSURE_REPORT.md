# Milestone 4 — Experiments and Research Documents Closure Report

**Status:** Closed, 2026-09-21  
**Scope:** explicit strategy/experiment/report relationships and bounded,
change-aware report regeneration.

## Delivered

- UUIDv7-backed strategy, experiment, and report Markdown documents in the
  disposable development vault.
- Explicit current-note selection from Obsidian without vault scanning or
  filename-based relationship inference.
- Report output with a bounded generated-content marker pair; user prose outside
  the marker pair remains untouched during regeneration.
- Change-aware report revisioning: unchanged managed content returns
  `NO_CHANGES_DETECTED`; a changed generated section requires confirmation and
  creates the next revision plus a local Core manifest.
- Visible, local document-status feedback for selection and report-validation
  failures.

## Validation evidence

| Area | Outcome |
| --- | --- |
| Research Core | 22 pytest tests pass, including deterministic report payload, revision-manifest, and worker-IPC cases. |
| Plugin | 7 automated tests and the production TypeScript/esbuild build pass. |
| Owner review | The owner manually confirmed strategy/experiment/report creation and reuse; no-change detection; warning and changed-only regeneration; preservation of prose outside the generated block; malformed-marker blocking; visible local error feedback; and recovery to `NO_CHANGES_DETECTED`. |

## Boundaries retained

M4 does not scan or classify the vault, repair user-owned frontmatter, edit
user-authored prose, automatically create documents from a batch, perform
financial calculations in TypeScript, or provide portfolio aggregation. Those
remain future work.

## Next milestone

Milestone 5 begins in specification/discovery only. Its first task is to define
the evidence, ordering, compatibility, and owner-review rules for multi-report
shared-balance analysis before any implementation is authorised.
