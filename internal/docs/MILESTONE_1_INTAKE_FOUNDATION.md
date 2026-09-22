# Milestone 1 — Intake Foundation Specification

**Status:** Closed, 2026-09-20  
**Depends on:** `MILESTONE_0_SPIKE_REPORT.md`  
**Purpose:** turn the M0 single-report vertical slice into a production-quality,
provenance-first intake and dataset-evidence foundation.

## Scope

M1 adds versioned raw-source intake records, a canonical dataset registry, and
read-only dataset-evidence views. It strengthens provenance and usability; it
does not add trade pairing, equity reconstruction, risk metrics, portfolio
analysis, optimisation, or prop-firm rules.

## Locked boundaries

- Python Research Core owns hashing, source validation, raw snapshot, canonical
  registry writes, and all canonical transformations.
- The plugin selects a file, submits user intent through versioned local NDJSON,
  and renders Core-returned evidence only. It performs no financial calculation.
- Raw source files are immutable after intake. Canonical/derived files remain
  rebuildable and are never the only source of provenance.
- Registry/evidence views never infer account mode, broker timezone, position
  pairing, equity, or missing source facts.
- The vault is not scanned as a registry and user Markdown is not overwritten.

## Proposed intake model

### 1. Source selection and validation

The user selects an adapter-supported file. The Core validates the extension,
layout, required sheets/fields, and importer schema before creating any dataset
record. Unsupported or ambiguous layouts return a structured error with no
partial registry entry.

### 2. Immutable raw-source snapshot — owner-approved policy

**Recommended default:** after hashing a selected source, the Core creates one
managed raw snapshot beneath its bounded workspace, verifies the copied bytes
against the original SHA-256, and records both the original selected path and
managed snapshot reference. The original file is never modified.

This makes future re-import/rebuild possible if the original file is moved or
deleted. A reference-only mode is possible only if explicitly approved; it must
display that reproducibility is conditional on the external file remaining
available.

### 3. Provenance receipt

Each accepted intake creates a JSON receipt containing at least:

- source SHA-256, original filename, byte count, original selected path, and
  managed-snapshot reference/status;
- adapter ID/version, source-layout/schema version, canonical schema version,
  Core version, and import configuration hash;
- observed sheet/section names, source-time text/context as supplied, account
  currency if present, precision metadata, and explicit warnings;
- deterministic dataset/source-import identity and canonical artifact references;
- quality state and evidence limitations.

Operational timestamps may appear in a separate receipt field; they must not
alter deterministic canonical artifacts or result identities.

### 4. Dataset registry

The Core maintains a bounded JSON registry in its workspace. The registry is an
index of immutable dataset manifests, not a replacement for Parquet/JSON
artifacts and not a general database. It supports deterministic lookup by source
hash/dataset identity, duplicate-source reuse, and evidence-only listing.

Duplicate intake of the same source hash, compatible importer version, and
configuration returns the existing dataset with an explicit reuse status. A
different importer/schema/configuration creates a separately versioned record;
it never silently overwrites a prior receipt.

### 5. Dataset evidence view

The plugin adds a view/command that requests the registry from the Core and
shows: dataset identity, source hash, adapter/schema/core versions, intake mode,
artifact availability, event count, source quality, declared currency/time facts,
and warnings. It may open a plugin-owned dataset note only through the existing
frontmatter/marker safety convention.

## Implemented versioned Core interface

Version the following Core methods and response schemas before implementation:

- `dataset.intake_mt5_excel`
- `dataset.list_registry`
- `dataset.get_evidence`
- `dataset.verify_raw_snapshot`

Each response must include protocol/core/schema versions, stable identities,
quality/warning fields, and structured error codes. Large source/canonical data
must be addressed by artifact reference, not sent as bulk NDJSON.

## Acceptance criteria

1. Intake never modifies the selected source; a managed snapshot, if approved,
   has the exact source SHA-256.
2. An unsupported or ambiguous report produces a structured error and no
   registry/canonical partial write.
3. The same source/version/configuration deterministically reuses the existing
   dataset and shows its provenance; changed version/configuration is explicit.
4. Registry/evidence data survives plugin restart and can be rebuilt from raw
   snapshots plus versioned importer/configuration information.
5. The plugin renders Core-returned evidence only and performs no financial
   calculation or source-layout inference.
6. Dataset evidence clearly distinguishes verified facts, supplied metadata,
   unknowns, warnings, and unavailable data.
7. Generated dataset notes preserve user prose and obey the existing marker and
   `trl_` frontmatter rules.
8. Golden fixtures cover normal, duplicate, unsupported, ambiguous, modified
   source, and snapshot-verification cases.

## Out of scope

Completed trades, `INFERRED` pairings, equity/marks, daily drawdown, broker-time
profiles, risk policy overlays, portfolio replay, optimisation, Monte Carlo,
entitlements, cloud storage, and portable-MT5 automation.

## Owner approval record

The owner approved the managed-snapshot policy, private local-path receipt,
registry boundary, evidence fields, fixture policy, acceptance criteria, and
M1 scope boundary on 2026-09-20. The owner also completed the development-vault
review. The closure evidence is recorded in `MILESTONE_1_CLOSURE_REPORT.md`.
