# ADR-014 — Dependency and Licensing Policy

**Status:** Accepted | **Date:** 2026-09-20

## Context

Future commercial distribution requires compatible, documented dependencies.

## Decision

Adopt the smallest justified dependency set only after compatibility and licence
review; maintain `THIRD_PARTY_LICENSES.md`.

## Alternatives considered

Unreviewed convenience dependencies; locking large stacks before the spike.

## Consequences

Python 3.14.7, charting, and plugin-test dependencies are Milestone 0 gates.
