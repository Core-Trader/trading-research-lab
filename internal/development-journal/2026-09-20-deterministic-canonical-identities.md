# Deterministic Canonical Identities

**Date:** 2026-09-20  
**Scope:** Milestone 0 reproducibility correction.

## Finding

The M0 importer previously used time-based UUIDv7 values for canonical event,
dataset, source-import, and default analysis-result identifiers. A fresh import
of otherwise identical source facts could therefore produce different Parquet,
JSON, and result artefacts. That violated the locked reproducibility principle.

## Correction

Canonical schema `1.1` uses UUIDv5 identities derived from a fixed project
namespace plus domain-separated source facts:

- dataset and source-import IDs derive from the source SHA-256;
- event IDs derive from source SHA-256 plus source sequence;
- default analysis-result IDs derive from dataset reference, calculation version,
  and core version.

The SHA-256 source fingerprint remains the integrity authority. UUIDv5 is used
only as a stable identifier, never as a security checksum.

## Evidence

The Research Core test suite passes 5 tests. The deterministic-storage regression
test writes the same controlled canonical facts to two fresh workspaces and
asserts byte-for-byte equality for both `metadata.json` and `events.parquet`.

## Development-vault migration

The already-created EURUSD canonical cache is schema `1.0`. The next import after
the plugin/worker reload will regenerate that cache as schema `1.1`; the original
MT5 `.xlsx` source is not modified. The report's financial values and source hash
must remain unchanged. Its dataset, source-import, and analysis-result IDs will
change once as the expected identity migration.

## Manual review required

Reload the plugin, rerun the approved EURUSD report, and verify the source hash,
opening balance, final balance, reported change, closing-event count, explicit
equity limitation, and outside-marker prose. Record baseline timings before M0
is marked closed.
