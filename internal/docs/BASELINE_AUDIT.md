# Architecture Reset — Baseline Audit

**Status:** Complete, 2026-09-20.  
**Authority:** The Obsidian Desktop / Python Research Core architecture reset.

## Classification rules

This audit preserves valid product and trading-research knowledge. A legacy
document or implementation is not deleted merely because its delivery mechanism
changed. “Superseded” means it is not authority for future architecture or
implementation unless the new baseline explicitly incorporates a requirement.

## Existing materials

| Material | Classification | Reset disposition |
| --- | --- | --- |
| `docs/01`–`docs/09` | Retain but adapt | Their research purpose, determinism, event, validation, and methodology requirements move into `internal/docs/`. Browser/HTTP/SQLite assumptions are superseded. |
| `docs/10`–`docs/12` | Retain unchanged as source evidence | MT5 intake, report hashes, JPY precision, and optimizer limitations remain valid evidence. |
| `docs/13`–`docs/21` | Retain as pre-reset implementation history | Do not extend these milestones. Their importer and forensic work are reference assets pending Milestone 0 adoption decisions. |
| `journal/` | Retain as historical internal record | New decisions and work use `internal/`; old journals are not product material. |
| `reference/` | Retain as non-authoritative research | Use only after licence/feature review; never copy third-party code without approval. |
| `src/`, `tests/`, root `pyproject.toml` | Superseded implementation location | Preserve read-only as pre-reset experiments. Do not add features here. Milestone 0 starts under `research-core/`. |
| External frozen EA and forensic copy | Retain as local evidence tooling | Not part of plugin distribution or the Research Core baseline. Keep their source/report provenance separate. |
| `tools/TRADING_RESEARCH_LAB_SETUP_SPEC.md` | Retain but adapt | Future setup validates Obsidian, a dev vault, Node/npm, Python 3.14.7, and the worker path instead of a standalone browser app. |
| Standalone HTTP deployment and SQLite persistence guidance | Obsolete | Do not implement or preserve as a default compatibility target. |
| Charting library, exact Python data dependencies, plugin test runner, and worker packaging | Unclear / deferred | Resolve through Milestone 0 evidence and ADRs, not speculation. |

## Requirements retained into the new baseline

- Local-first, single-user research and zero mandatory cloud dependency.
- Raw MT5 source immutability, SHA-256 provenance, strict schema validation, and
  reproducible import results.
- Decimal-safe money/price handling; no universal FX precision assumption; the
  USDJPY three-decimal regression requirement remains.
- Broker time profiles, date-aware timezone handling, and explicit daily-risk
  policy provenance.
- Broker-native analysis as the default; prop-firm rules as optional versioned
  overlays, never as broker facts.
- Event-level analysis remains valid without Position ID. Position/trade groups
  are `MT5_VERIFIED`, `INFERRED`, `UNPAIRED`, or `AMBIGUOUS` as documented.
- Forensic Position-ID evidence is optional development validation, never a
  requirement for ordinary user report imports.
- Deterministic inputs, versioned algorithms/configuration, regression fixtures,
  and evidence manifests.

## Superseded architectural assumptions

- Standalone browser application as the primary shell.
- FastAPI, loopback HTTP, and a Python API server as the default integration.
- SQLite as the V1 canonical analytical store.
- Root `src/` as the continuing Python package location.
- A generic browser UI as the product navigation or user-document shell.

## Explicit pause

No further implementation is authorised in the pre-reset `src/`, `tests/`, or
external forensic-EA path. The next implementation work is Milestone 0 only,
and only after the new baseline review is accepted.
