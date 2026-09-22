# ADR-010 — Private Engineering Documentation Boundary

**Status:** Accepted | **Date:** 2026-09-20

## Context

Development methodology and handoffs must not accidentally ship as product docs.

## Decision

Keep ADRs, journals, handoffs, playbooks, and course-source material under
`internal/` and exclude it by release allowlist.

## Alternatives considered

Keeping all documentation in distributable product folders.

## Consequences

Product help belongs only in `product-docs/`; packaging gets a hard boundary.
