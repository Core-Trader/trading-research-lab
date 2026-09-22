# Vault Document and Generated-Content Convention

## Scope

This convention applies only to an explicitly selected development or personal
research vault. The source repository is not a vault and no production vault is
used during Milestone 0.

## Frontmatter v1

Plugin-managed keys use the `trl_` prefix. Human-readable names are optional;
stable IDs are not inferred from paths or titles.

```yaml
---
trl_type: experiment
trl_schema: 1
trl_id: 018f0000-0000-7000-8000-000000000000
trl_status: draft
trl_engine_version: 0.1.0
trl_dataset_id: 018f0000-0000-7000-8000-000000000001
trl_strategy_id: 018f0000-0000-7000-8000-000000000002
trl_analysis_run_id: 018f0000-0000-7000-8000-000000000003
---
```

Allowed initial `trl_type` values are `strategy`, `dataset`, `experiment`,
`portfolio`, and `report`. Unknown plugin-owned keys are preserved by the
plugin. Non-`trl_` keys and all body text are user-owned.

## Generated-content boundary

The plugin may create or replace only the content between an exact marker pair:

```markdown
<!-- TRL:GENERATED:START analysis_run_id=<uuid> -->
<!-- TRL:GENERATED:END -->
```

Rules:

1. A missing, duplicate, malformed, or mismatched marker pair blocks automatic
   update and returns a reviewable error.
2. The plugin never regenerates text outside the pair.
3. It writes a complete replacement for the bounded block atomically through the
   vault API; it does not patch arbitrary offsets after stale reads.
4. Generated sections state source/canonical hashes, core/schema version,
   configuration, quality state, and run ID where relevant.
5. Manual edits inside a generated block may be replaced on regeneration; the
   UI warns before the first generated-block update. User commentary belongs
   outside the markers.

## Vault path and privacy rules

The plugin stores logical document relationships by IDs/frontmatter, not absolute
machine paths. It does not scan or modify unrelated vault files. Raw reports and
derived Parquet data stay outside Markdown body content and are referenced by
stable IDs/artifact manifests.
