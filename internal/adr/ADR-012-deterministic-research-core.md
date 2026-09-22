# ADR-012 — Deterministic and Reproducible Research Core

**Status:** Accepted | **Date:** 2026-09-20

## Context

Financial research must be explainable and repeatable.

## Decision

Same canonical dataset, configuration, and core version must yield the same
result. Persist manifests, schemas, versions, hashes, and stochastic seeds.

## Alternatives considered

Best-effort calculations without recorded configuration/version identity.

## Consequences

Randomness, defaults, ordering, rounding, and cache invalidation require tests.
