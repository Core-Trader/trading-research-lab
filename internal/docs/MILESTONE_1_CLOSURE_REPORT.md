# Milestone 1 — Intake Foundation Closure Report

**Status:** Closed, 2026-09-20  
**Scope:** verified raw-source intake, provenance, registry, and evidence views

## Delivered

- SHA-256-verified, immutable managed copies of accepted MT5 Excel sources.
- Deterministic canonical dataset reuse and a bounded JSON evidence registry.
- Versioned local-worker methods for intake, listing, evidence lookup, and
  on-demand managed-snapshot verification.
- Obsidian evidence rendering, clear intake/reuse states, and persistent
  verification feedback.
- Source decimal-format observation, including five-decimal price-scale
  regression coverage, without universal FX-digit assumptions.

## Validation evidence

| Area | Outcome |
| --- | --- |
| Research Core | 10 pytest tests pass. |
| Plugin | 2 automated tests and production TypeScript/esbuild build pass. |
| Source preservation | Owner confirmed the original local MT5 report was unchanged. |
| Evidence UI | Owner confirmed selection, intake, duplicate reuse, refresh, and visible managed-snapshot verification. |
| Negative cases | Automated coverage rejects invalid and ambiguous sources before intake writes, distinguishes changed sources, and detects tampered snapshots. |

## Deliberate boundaries retained

M1 does not pair trades, infer account mode/timezone, reconstruct equity,
calculate drawdown/risk, replay portfolios, automate MT5, or expose private
receipt paths in product material. Those remain later milestones.

## Next milestone

Milestone 2 is specification-only until its event/trade-pairing policy,
quality presentation, and fixture plan receive owner approval.
