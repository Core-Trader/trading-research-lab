# Architecture Decision Records

## ADR-001 — Domain-first deterministic replay

**Status:** Accepted  
**Date:** 2026-09-20

The Python domain layer owns event ordering, account state, risk policies, and replay outputs. The UI reads derived data and sends explicit commands only. This limits presentation-driven financial inconsistencies and makes the core engine independently testable.
