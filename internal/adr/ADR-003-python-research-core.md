# ADR-003 — Python Research Core Is the Calculation Authority

**Status:** Accepted | **Date:** 2026-09-20

## Context

Trading calculations require one testable, reproducible source of truth.

## Decision

Use Python 3.14.7 as the authoritative Research Core. TypeScript renders and
orchestrates but does not duplicate quantitative calculations.

## Alternatives considered

Frontend calculations; split logic between plugin and worker.

## Consequences

Core remains independently testable and future-packageable; all results pass
through versioned worker interfaces.
