# ADR-007 — Obsidian Plugin Toolchain

**Status:** Accepted | **Date:** 2026-09-20

## Context

The plugin needs a conventional, maintainable Obsidian Desktop development path.

## Decision

Use TypeScript, React, esbuild, npm, and the Obsidian Plugin API. Prefer native
Obsidian styling and concepts.

## Alternatives considered

Standalone web stack; prematurely selecting Vite, Tailwind, Redux, or Plotly.

## Consequences

Charting and state-library choices remain spike decisions based on evidence.
