# Claude Code Handoff — Post-Reset Baseline

## Current status

The pre-reset standalone-browser/SQLite direction is superseded. Do not extend
root `src/`, root `tests/`, the prior browser assumptions, or the earlier Step
3–5 implementation sequence. Preserve them as read-only engineering evidence.

The authoritative baseline is `internal/docs/` and `internal/adr/`. The next
authorised implementation is **Milestone 0 only** after owner review.

## First reads

1. `CLAUDE.md`
2. `internal/docs/ARCHITECTURE.md`
3. `internal/docs/MILESTONE_0_ARCHITECTURE_SPIKE.md`
4. `internal/docs/ENGINE_PROTOCOL.md`
5. `internal/docs/DATA_MODEL.md`
6. `internal/docs/TESTING_PROTOCOL.md`
7. all ADRs in `internal/adr/`

## Milestone 0 implementation boundary

Create the `plugin/`, `research-core/`, controlled test-fixture, and external
`C:\DEV\vaults\TRL-Dev-Vault\` boundaries only as necessary for the spike. The Python worker owns
MT5 fixture import, canonical Parquet, basic statistics, balance/equity
availability, and JSON protocol responses. The plugin owns worker lifecycle,
minimal React view, and bounded experiment-note generation.

Do not implement portfolio replay, Position-ID pairing, prop-firm calculations,
Monte Carlo, broad reporting, licensing, payment, telemetry, or production vault
use. Do not alter raw reports or the frozen MT5 EA.

## Required evidence before completion

Record dependency versions/licences, fixture hashes, protocol transcripts,
worker restart evidence, deterministic result hashes, dev-vault note safety,
and spike measurements. Update the internal journal and handoff with any
deviation or failed acceptance criterion.

## External reference repositories

Read `internal/references/README.md`, `REFERENCE_REGISTER.md`, and
`EXTERNAL_CODE_USAGE_REGISTER.md` before using an external repository. Journalit
and Strategy Factory direct code reuse is approved by their developer/owners,
subject to mandatory provenance tracking and a final usage report. Record every
direct or substantial derivation in the usage register as it is introduced; do
not reuse code or assets without that record and independent validation.
