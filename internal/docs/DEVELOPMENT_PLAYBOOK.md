# Development Playbook

## Operating sequence

1. Read `CLAUDE.md`, `ROADMAP.md`, the active ADRs, the active milestone package,
   and relevant protocol/model specifications.
2. Confirm the task's milestone, ownership boundary, raw-data impact, and
   required user manual review before changing code.
3. Add or update tests with each quantitative, protocol, or vault-safety rule.
4. Run proportionate validation; record evidence and limitations.
5. Update the internal decision log and development journal for material work.
6. Keep internal material out of release paths and user vaults.

## Non-negotiable engineering rules

- Research Core is the calculation authority; plugin code orchestrates and
  presents.
- Never mutate raw inputs. Canonical and derived data must carry provenance.
- Do not silently infer timezones, Position-ID equivalence, currency conversion,
  marks, or rule-provider semantics.
- New external dependencies need a compatibility/licence note before adoption.
- Journalit and Strategy Factory are approved code donors subject to mandatory
  provenance tracking and a final usage report. Reuse only where technically
  justified; record the exact repository, commit, source path/symbol, TRL
  destination, change type/extent, dependencies, product scope, and validation
  immediately in `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md`. No
  untracked external code reuse. Permission never replaces independent
  quantitative validation.
- Plugin startup must not start expensive computation or scan a vault.
- Worker failures must remain recoverable and observable.
- Release packaging uses an allowlist; no internal documentation is distributable.

## Documentation discipline

ADRs record durable architecture choices. The decision log records product and
research-policy choices. Handoffs identify current state and exact validation.
Development journals record what changed, why, evidence, and manual review.

## Obsidian vault discipline

Develop only against `C:\DEV\vaults\TRL-Dev-Vault\` until a user explicitly
selects a separate vault. Treat user prose as owned data. Use `trl_` frontmatter
keys and bounded generated markers; never write arbitrary Markdown replacements.
