# ADR-004 — Local Subprocess and Versioned JSON IPC

**Status:** Accepted for Milestone 0 | **Date:** 2026-09-20

## Context

The plugin needs isolated worker failure/restart without a mandatory server.

## Decision

Use a local disposable Python child process and versioned JSON IPC; Milestone 0
uses NDJSON over stdin/stdout.

## Alternatives considered

FastAPI/localhost HTTP; in-process Python; named pipes.

## Consequences

No port lifecycle or HTTP service is required. Spike evidence must validate the
transport before production reliance.
