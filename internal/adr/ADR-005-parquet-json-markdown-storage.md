# ADR-005 — Parquet, JSON, and Markdown Storage Model

**Status:** Accepted | **Date:** 2026-09-20

## Context

Analytical tables, reproducibility metadata, and human research have different
storage needs.

## Decision

Use Parquet for substantial canonical/derived tables, JSON for manifests and
configuration, and Markdown/YAML for human research. Do not default to SQLite.

## Alternatives considered

SQLite as canonical store; Markdown trade rows; one universal format.

## Consequences

Caches are disposable; canonical data is rebuildable; database adoption requires
a future ADR and demonstrated need.
