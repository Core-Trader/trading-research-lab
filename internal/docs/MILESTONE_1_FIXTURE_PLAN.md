# Milestone 1 — Fixture and Validation Plan

**Status:** Complete, 2026-09-20.

## Fixture classes

| Fixture | Storage / privacy | Required assertion |
| --- | --- | --- |
| Synthetic valid MT5 Excel report | Source-controlled deterministic fixture definition | Stable source hash, intake receipt, snapshot verification, canonical/registry identities, and evidence fields. |
| Synthetic duplicate of valid report | Source-controlled deterministic fixture definition | Existing dataset reused for same source/importer/configuration. |
| Synthetic unsupported layout | Source-controlled deterministic fixture definition | Structured error; no partial receipt, snapshot, registry, or canonical write. |
| Synthetic ambiguous layout | Source-controlled deterministic fixture definition | Structured error; no guessing. |
| Byte-modified valid report | Source-controlled deterministic fixture definition | Different source hash and explicit distinct intake result. |
| Local proprietary MT5 reports | Ignored local data only | Optional smoke evidence; never copied into public fixtures without an approved redaction/legal record. |

## Deterministic assertions

For every golden fixture, record source hash, importer/schema/core versions,
configuration hash, snapshot checksum, dataset/source-import identities, registry
entry checksum, canonical artifact checksums, quality state, warnings, and
expected structured errors where applicable.

## Test layers

- **Research Core unit:** input validation, hashing, snapshot verification,
  receipt/registry schema validation, duplicate reuse, and structured errors.
- **Research Core deterministic integration:** source → snapshot → canonical →
  registry/evidence → checksums in fresh workspaces.
- **Plugin unit:** request binding and evidence rendering without financial
  formulas; bounded-note safety remains covered.
- **Development-vault integration:** Browse selection, intake, evidence view,
  duplicate display, restart persistence, and user-prose preservation.

## Manual review checklist

1. Inspect one intake receipt and confirm the source path, SHA-256, adapter,
   versions, warnings, and snapshot status are truthful.
2. Confirm the selected source file remains byte-for-byte unchanged.
3. Re-intake the same report and confirm explicit reuse rather than a duplicate.
4. Try an intentionally unsupported/ambiguous fixture and confirm no partial
   dataset appears.
5. Review the evidence view for clear unknown/unavailable labels and no inferred
   account mode, timezone, trade pairing, or financial metric.
6. If dataset Markdown is created, edit prose outside markers and confirm it
   remains unchanged after refresh.

## Current automated coverage

The Research Core suite currently covers a synthetic supported report, exact
source-byte preservation, SHA-verified snapshot creation, duplicate-source
reuse, receipt/registry evidence, a clearly unsupported report with no intake
writes, standard MT5 direction capitalization, and a five-decimal price format.

The suite now covers the listed normal, duplicate, unsupported, ambiguous,
byte-modified, and altered-snapshot cases. The MT5 workbook definitions are
kept as reviewed test source rather than opaque checked-in binary files; every
test still writes and imports a real temporary `.xlsx` workbook. The owner
completed the development-vault review. Proprietary MT5 reports remain local-
only and are not test fixtures.
