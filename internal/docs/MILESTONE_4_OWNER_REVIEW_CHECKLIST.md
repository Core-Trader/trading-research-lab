# Milestone 4 — Owner Review Checklist

Approved by the owner on 2026-09-20. Manual validation was completed and is
recorded in `MILESTONE_4_CLOSURE_REPORT.md` on 2026-09-21.

- [x] **Document locations:** use `Strategies/`, `Experiments/`, and `Reports/`
      as development-vault defaults, with writes only after explicit user action.
- [x] **Relationship boundary:** limit M4 experiments to one explicitly selected
      strategy, dataset, and analysis run; do not infer links from text or paths.
- [x] **Existing selection:** permit one explicitly opened Obsidian note for an
      existing strategy, experiment, or report; validate only that note and
      block mismatched type/dataset/analysis/experiment relationships.
- [x] **Identity:** use UUIDv7 `trl_id` values and treat paths/titles as editable
      metadata, not identity.
- [x] **Generated content:** permit replacement only inside one exact generated
      marker pair, with malformed/duplicate markers blocking the operation.
- [x] **No-change detection:** compare candidate managed content/evidence/
      configuration with the current revision. If identical, make no write or
      revision and visibly report `NO_CHANGES_DETECTED`.
- [x] **Regeneration warning:** show a warning before a changed generated block
      is replaced, because edits within that block will be replaced.
- [x] **Revision record:** increment `trl_report_revision` only after a changed
      generation and create a local manifest identifying current/prior evidence;
      do not duplicate or silently overwrite reports.
- [x] **Fixtures and acceptance:** approve the synthetic fixture plan and manual
      checklist in `MILESTONE_4_FIXTURE_PLAN.md`.
- [x] **Scope boundary:** confirm M4 excludes vault scans, arbitrary prose edits,
      automatic note classification, templates, sync, export/distribution, and
      TypeScript financial calculations.
