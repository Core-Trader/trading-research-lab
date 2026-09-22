# ADR-006 — Separate Repository, Development Vault, and Personal Vault

**Status:** Accepted | **Date:** 2026-09-20

## Context

User research must not be mixed with source code or release material.

## Decision

Keep the software repository, ignored development/test vault, fixtures, and
personal research vault separate.

## Alternatives considered

Using the personal vault as repository; developing against production notes.

## Consequences

Vault safety and product packaging remain tractable; migration/import is explicit.
