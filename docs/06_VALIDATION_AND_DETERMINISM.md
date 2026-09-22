# Validation and Determinism

## Contract

A replay is reproducible when the same immutable input artifacts, normalised-record versions, scenario, policies, engine version, ordering table, and seed (where randomness exists) yield the same canonical ledger and summaries.

## Evidence manifest

Every replay stores:

- raw artifact hashes and parser versions;
- selected canonical record IDs and their content/version hashes;
- scenario and policy JSON, including timezone and reset-time choices;
- engine, schema, and ordering-table versions;
- deterministic run ID derived from the canonical input manifest;
- result hashes, warnings, and reconciliation classification.

## Import validation

An adapter must prove its supported layout through fixtures. It validates schema/layout identity, required fields, parseability, timezone interpretation, duplicate source IDs, numeric signs/scales, and internal totals when provided. Ambiguous headers, locale conventions, or timestamps must raise a reviewable finding rather than choosing silently.

## Reconciliation ladder

1. **Structural:** record counts, identifiers, and required fields match the source interpretation.
2. **Trade-level:** open/close times, prices, volume, and costs match mapped source records.
3. **Cash-level:** completed-trade net P/L and final balance match a source-provided baseline where comparable.
4. **Equity-level:** equity extrema/drawdown match only when comparable price marks and account assumptions exist.
5. **Portfolio-level:** multi-strategy outputs are explicitly new model results; they cannot be expected to equal independent MT5 tests.

Each comparison is `MATCHED`, `WITHIN_TOLERANCE`, `MISMATCHED`, `NOT_COMPARABLE`, or `NOT_AVAILABLE`, with a reason.

## Determinism controls

- Decimal arithmetic and defined rounding boundaries
- Source price values and their display/precision metadata are preserved; instrument-specific scales are never inferred from a hard-coded symbol list
- UTC storage plus explicit local-calendar conversion
- Stable ordering of all collections and events
- No wall-clock time, random seed, locale, machine path, or database row order may affect a calculation
- Versioned defaults; a default used in a run is serialized into the manifest
- Deterministic canonical JSON serialization for hashes and exports

## Tolerance policy

Tolerances are not a way to hide errors. The comparison records the exact absolute/relative tolerance, source precision, and reason. A financial total without a stated tolerance is exact only when its source conventions and precision are demonstrably identical.

## Failure handling

Unknown data, incomplete marks, unsupported multi-currency economics, or violated invariants either block the relevant result or create an explicit `UNVERIFIED` classification. The UI must preserve the distinction.
