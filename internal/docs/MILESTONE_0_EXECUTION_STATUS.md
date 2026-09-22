# Milestone 0 — Execution Status

**Status:** Closed — architecture viable for Milestone 1 specification work,
with explicit deferred validation risks.  
**Updated:** 2026-09-20

> **Closure update:** The local development environment is prepared with
> Node 24.21.0/npm 11.19.0 and Python 3.14.7. The plugin was manually loaded in
> the dedicated Obsidian development vault and successfully analysed the approved
> EURUSD MT5 Excel report through the local Python worker. The owner confirmed
> the required M0 manual checks, including outside-marker preservation, plugin
> reload, Browse-based source selection, and local diagnostics display.

## What now exists

- `research-core/`: the Python 3.14-targeted, versioned NDJSON worker; its
  source-preserving MT5 Excel importer; canonical Parquet/JSON storage; verified
  reported-balance statistics; explicit unavailable-equity state; and generated
  Markdown renderer.
- `plugin/`: desktop-only Obsidian TypeScript/React/esbuild source. It starts a
  local worker, completes a protocol handshake, applies local timeout/cancel
  handling, renders only worker results, draws the verified balance curve, and
  writes/updates only the bounded generated section of an experiment note.
- `C:\DEV\vaults\TRL-Dev-Vault\`: the separate disposable development vault
  with the required manual acceptance checklist.

No legacy `src/`, root `tests/`, `docs/`, raw reports, forensic EA, or personal
vault was changed.

## Evidence obtained

| Check | Result | Notes |
| --- | --- | --- |
| Python 3.14.7 environment and declared dependencies | Pass | `openpyxl 3.1.5`, `pyarrow 25.0.1`, and the editable research core installed; `pip check` passed during setup. |
| Canonical Parquet/JSON write and source-preserving import | Pass | The approved EURUSD source was imported to the external development vault; its stable source SHA-256 is `63E3D6C6737E577F1EF6335E731E74A305BCA9060D420592241F4E66DC90A523`. |
| NDJSON capabilities and structured error | Pass | A live worker returned protocol `1`, advertised the import method, and returned structured `E_METHOD_UNKNOWN` for an invalid method. |
| Basic-statistics integrity | Pass | The live EURUSD run reported opening balance `15000.0`, final balance `15166.99`, change `166.99`, and 60 closing deal events; equity is explicitly `UNAVAILABLE`. |
| USDJPY MT5 reference import | Pass with limitation | 153 events parsed; first trading price preserved as `158.425`. The workbook has no usable Excel price display scale, so `source_price_scale` is `null`, not inferred. |
| Plugin type-check/build | Pass | TypeScript check and esbuild production bundle pass with the system Node/npm installation. |
| Obsidian plugin load/view | Pass | Manually loaded through the vault junction; live local-worker analysis completed and rendered the verified balance curve. |
| Generated note UTF-8/content integrity | Pass | The approved note has valid UTF-8, zero replacement characters, one analysis-run line, and the expected generated-content start/end markers. |
| Automated Python test runner | Pass | `pytest 9.1.1` is installed only through the `research-core[dev]` extra; 5 tests pass. |
| Plugin automated test suite | Pass | Two Node tests prove bounded generated-content replacement and duplicate-marker rejection. |
| Fresh-workspace deterministic canonical artefacts | Pass | The schema `1.1` regression test proves byte-identical `metadata.json` and `events.parquet` across two fresh workspaces from the same source facts. |
| Local timing baseline | Pass, observational | Owner-displayed warm-worker run: readiness 1.3 ms, import 35.2 ms, statistics 3.2 ms, report payload 3.0 ms, note write 2.0 ms, presentation 2.1 ms, total 46.8 ms. These are observations, not performance targets. |

Early pre-environment syntax checks used an isolated Python 3.12.14 only for
syntax and standard-library protocol behavior. The closure evidence above was
subsequently obtained with the approved Python 3.14.7 virtual environment.

## Declared M0 dependencies — historical requested ranges

> The table below preserves the original requested ranges. Its pending wording is
> historical; current resolved local-development versions and validation evidence
> are authoritative in `THIRD_PARTY_LICENSES.md`. Distribution approval remains
> pending.

| Package | Requested range | Purpose | Licence / status |
| --- | --- | --- | --- |
| `openpyxl` | `>=3.1.5,<4` | Read observed MT5 `.xlsx` reports | MIT; compatibility and exact lock pending Python 3.14.7 installation. |
| `pyarrow` | `>=25.0.1,<26` | Canonical Parquet read/write | Apache-2.0; PyPI provides CPython 3.14 Windows wheels; installation smoke test pending. |
| `react`, `react-dom` | `^19.1.1` | Isolated plugin view rendering | MIT; build/Obsidian compatibility pending. |
| `esbuild` | `0.25.5` | Plugin bundle | MIT; build smoke test pending. |
| `obsidian` | `latest` | Plugin API type package, matching official sample pattern | Distribution/version lock pending the installed Obsidian version. |
| `typescript` | `^5.8.3` | Plugin type-checking | Apache-2.0; build smoke test pending. |

Before any dependency is marked approved, record its resolved version and
package-manager lockfile hash in `THIRD_PARTY_LICENSES.md`.

## Historical M0 acceptance checklist — owner-confirmed

The owner subsequently confirmed the schema-upgrade rerun, outside-marker prose
preservation, plugin reload, Browse workflow, and local diagnostics display.
The list below is retained as the original checklist, not as pending work.

1. Reload or disable/re-enable the plugin so the editable Python worker picks up
   canonical schema `1.1`, then rerun the approved EURUSD source once. Its old
   schema `1.0` cache will be regenerated with deterministic UUIDv5 identifiers.
   Confirm the source SHA-256 and financial values remain the same; changed
   dataset/import/analysis IDs are expected and are not a calculation change.
2. Confirm prose outside the generated marker block still remains unchanged after
   that schema-upgrade rerun. Do not edit inside the marker block.
3. Capture the spike measurements listed in
   `MILESTONE_0_ARCHITECTURE_SPIKE.md`: plugin activation, worker startup,
   import, Parquet size, analysis, render, memory, and chart responsiveness.
   They are baseline observations, not product performance targets.

## Deferred validation risks

- **Peak Python-worker memory:** intentionally not captured in M0. No privileged
  system inspection or extra dependency was introduced solely for this
  measurement. Treat it as a non-blocking M0 limitation and revisit during
  performance/product hardening.
- **Forced worker-crash recovery:** clean stop/restart and live reload were
  exercised, but a deliberately induced worker crash was not tested. Keep this
  as integration coverage to add before product hardening.
- **Portable MT5 terminal path:** the importer consumes exported `.xlsx` files;
  direct portable-terminal automation is outside the M0 vertical slice and has
  not been tested here.
- **Broad integration coverage:** M0 has focused unit tests and live evidence,
  not a full automated cross-process/Obsidian integration suite.

## M0 gate decision

**Proceed to Milestone 1 specification and review only.** Do not begin
Milestone 1 feature implementation until its specification, fixture plan,
acceptance criteria, and manual-review checklist receive owner approval.
