# Milestone 3 — Time, Equity, and Risk Foundation Closure Report

**Status:** Closed, 2026-09-20  
**Scope:** source-reported-clock realised-balance daily drawdown and explicit equity availability

## Delivered

- Report-clock daily grouping labelled `SOURCE_REPORTED_CLOCK`, without UTC or broker-timezone claims.
- Decimal-safe `REALISED_BALANCE_ONLY` daily high-water drawdown with qualified partial-coverage warnings and controlled artifacts.
- Explicit `UNAVAILABLE` intratrade-equity result, including the evidence required before future equity drawdown can be verified.
- Obsidian M3 panel presenting compact Core results without TypeScript financial calculations.

## Validation evidence

| Area | Outcome |
| --- | --- |
| Research Core | 20 pytest tests pass, including M3 source-clock, daily-drawdown, unavailable-equity, deterministic-artifact, and worker-IPC coverage. |
| Plugin | 2 automated safety tests and production TypeScript/esbuild build pass. |
| Owner review | Owner confirmed all four requested M3 panel checks pass using a representative report. |

## Boundaries retained

M3 does not convert report times to broker time, reconstruct intratrade equity,
apply a prop-firm/broker rule, claim a daily-loss breach, or add a proprietary
equity-data input. These remain explicit future work.

## Next milestone

Milestone 4 is specification-only until its strategy/experiment/document
relationship and generated-report safety package receives owner approval.
