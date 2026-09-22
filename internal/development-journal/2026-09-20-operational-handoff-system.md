# Operational Handoff System

**Date:** 2026-09-20  
**Scope:** private agent/human development workflow only.

## Change

Created `internal/handoffs/CURRENT_HANDOFF.md` as the single operational
snapshot, a reusable template, and the empty archive directory.

## Boundary

The handoff is private, excluded from releases, and subordinate to approved ADRs
and authoritative specifications. It contains no credentials, tokens, licence
keys, or other secrets.

## Accuracy note

The first snapshot records that the M0 execution-status document still needs
reconciliation with later owner-confirmed manual checks. It does not silently
claim formal M0 closure.

## Manual review required

Before another agent starts substantial work, review `CURRENT_HANDOFF.md` for
the recorded next exact task and open issues. Archive it only at a meaningful
milestone or major-state transition.
