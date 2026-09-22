# Milestone 4 — Experiments and Research Documents Specification

**Status:** Closed; owner policy and manual acceptance recorded by 2026-09-21.  
**Depends on:** `MILESTONE_3_CLOSURE_REPORT.md`  
**Purpose:** connect existing dataset and analysis evidence to reproducible strategy, experiment, and report Markdown documents without taking ownership of the user's research prose.

## Scope

M4 adds explicit vault-local relationships between strategies, experiments,
datasets, analyses, and reports. Documents are created only by an explicit user
command from the plugin. Python remains responsible for quantitative output; the
plugin selects references, writes safe document shells, and renders Core-produced
report payloads.

## Document types and identity

The existing `trl_` frontmatter convention remains authoritative. M4 uses
`strategy` for user-owned strategy context, `experiment` for a named research
attempt, and `report` for a reproducible generated report. Every new document
receives a UUIDv7 `trl_id`; paths/titles are display metadata, never identity.

M4 creates documents only in the selected development vault, using `Strategies/`,
`Experiments/`, and `Reports/` as defaults. It also permits selection of one
existing Markdown note when the user explicitly opens that note in Obsidian and
uses the matching current-note action. The plugin reads and validates only that
opened note's `trl_` frontmatter; it does not scan, rename, classify, or modify
unrelated files.

Strategy creation and selection are available before an MT5 report is loaded.
Experiments and reports remain disabled until a report has been loaded and its
dataset/analysis identities are available, because those document types must
record and validate those relationships. Loading another report clears the
selected experiment/report but preserves the selected strategy.

## Relationship contract

An experiment records one explicit `trl_strategy_id`, `trl_dataset_id`, and
`trl_analysis_run_id`. A report records `trl_experiment_id`, `trl_dataset_id`,
`trl_analysis_run_id`, Core version, calculation/configuration identity, and a
`trl_report_revision` integer. References are selected from known plugin-created
documents, one explicitly opened existing note, or worker results;
they are never inferred from filenames or body text. An existing experiment or
report must match the currently loaded dataset/analysis before use.

Absent, malformed, duplicate, or inconsistent references block the write with a
reviewable error. The plugin never repairs user-owned relationship data.

## Generated report contract

Generated quantitative content uses one exact marker pair:

```markdown
<!-- TRL:GENERATED:START analysis_run_id=<uuid> -->
<!-- TRL:GENERATED:END -->
```

- First generation creates frontmatter, a human-editable title/body area, and one generated block.
- Regeneration occurs only after the plugin validates the marker pair and required frontmatter keys.
- Before a write, the Core/plugin creates a candidate payload and compares its generated-block hash, selected evidence identities, and configuration identity with the current report revision.
- If those managed values are identical and the current generated block matches its recorded hash, the operation performs no write, does not increment `trl_report_revision`, and visibly reports `NO_CHANGES_DETECTED`.
- The plugin replaces only that block when a managed change is detected. Before the first such replacement it warns that edits inside the generated block will be replaced.
- User text outside the block and all non-`trl_` frontmatter remain user-owned and byte-preserved where practical.
- A successful changed regeneration increments `trl_report_revision` and records prior/current run and configuration identities in a versioned local report manifest.

## Reproducibility and storage

The Core produces a versioned report payload/manifest from selected artifacts.
Markdown contains only compact evidence references, quality/availability labels,
configuration identity, warnings, and result summaries. The report manifest
records report ID/revision, source hash, dataset/analysis IDs, Core/schema/
calculation versions, configuration hash, artifact references/hashes, and the
generated-block hash.

## Out of scope

Vault-wide discovery, automatic note classification, arbitrary frontmatter
repair, editing user prose, custom templates, personal-vault migration, sync,
export/distribution, portfolio documents, and TypeScript financial calculations.

## Owner decisions required

Approve or amend the default document locations, one-strategy/one-analysis
experiment relationship, change-aware report revision behaviour, regeneration
warnings, fixtures, and manual review checklist before implementation starts.
