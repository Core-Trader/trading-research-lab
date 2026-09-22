# ADR-013 — Immutable Raw Source and Provenance

**Status:** Accepted | **Date:** 2026-09-20

## Context

MT5 formatting and source semantics can be ambiguous; evidence must be auditable.

## Decision

Raw files are immutable. Every import records hash, source type, parser/schema,
time context, and available broker/account metadata.

## Alternatives considered

Normalizing in place; storing only transformed data.

## Consequences

Canonical data is rebuildable and unsupported source conditions are explicit.
