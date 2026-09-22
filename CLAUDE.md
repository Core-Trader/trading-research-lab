# Trading Research Lab — Authoritative Working Context

## Architecture reset status

The Obsidian Desktop plugin + Python Research Core architecture reset is active.
`internal/docs/` and `internal/adr/` are authoritative. Root `docs/`,
`journal/`, `src/`, `tests/`, and the external forensic EA are retained as
pre-reset evidence only; do not extend them.

## Read before implementation

1. `internal/handoffs/CURRENT_HANDOFF.md` (operational snapshot only)
2. `internal/docs/ROADMAP.md` (authoritative milestone order and status)
3. the specification, fixture plan, and owner checklist for the active milestone
4. `internal/docs/ARCHITECTURE.md`
5. `internal/docs/ENGINE_PROTOCOL.md`
6. `internal/docs/DATA_MODEL.md`
7. `internal/docs/TESTING_PROTOCOL.md`
8. `internal/docs/DEVELOPMENT_PLAYBOOK.md`
9. `internal/docs/HANDOFF.md`
10. `internal/docs/VAULT_DOCUMENT_CONVENTION.md`
11. `internal/references/README.md`, `REFERENCE_REGISTER.md`, and
    `EXTERNAL_CODE_USAGE_REGISTER.md`
12. every ADR in `internal/adr/`

## Locked rules

- Obsidian Desktop is the V1 shell; V1 is desktop-only.
- Python 3.14.7 Research Core is the single financial calculation authority.
- Plugin/TypeScript code never duplicates quantitative calculations.
- The worker is a restartable local child process using versioned JSON IPC; do
  not introduce FastAPI, localhost HTTP, or another transport without an ADR.
- Canonical/derived tables use Parquet; metadata/configuration uses JSON; human
  research uses Markdown + YAML/frontmatter. SQLite is not a V1 default.
- Raw imports are immutable and provenance is mandatory.
- The personal vault, dev vault, and source repository are separate.
- `internal/` is private development material and is never release-packaged.
- Journalit and Strategy Factory are approved external references whose
  developer/owners have granted direct code-reuse permission, conditional on a
  final usage report. Reuse only where technically justified; immediately record
  the exact repository, commit, source path/symbol, TRL destination, changes,
  validation, dependencies, and product scope in
  `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md`. No untracked reuse.
- No telemetry, mandatory network, accounts, payments, or commercial licensing
  infrastructure is in scope.

## Current authorised work

Milestones 0–5 are closed. Milestone 6 has accepted bounded advanced-research
increments, while automatic parameter selection remains deferred. The active
product-delivery direction is the fixed-dashboard MVP track in
`internal/docs/MVP_FAST_TRACK.md`; do not let deferred M6 work block it.
`internal/docs/ROADMAP.md` is the authority for milestone order and status.
Create new product code under `plugin/` and `research-core/`; do not use the
pre-reset root Python package as the product foundation.

## Documentation and validation

Record material choices as ADRs/decisions and work in `internal/`. Add tests for
every quantitative, protocol, and vault-safety rule. Preserve explicit data
quality states, version identifiers, source hashes, configurations, and random
seeds. Ask for manual review whenever a milestone document requires it. Before
substantial work, read `internal/handoffs/CURRENT_HANDOFF.md` together with the
relevant authoritative specification/ADR files. After substantial work or before
handing to another agent, update the handoff when the operational state has
materially changed.
