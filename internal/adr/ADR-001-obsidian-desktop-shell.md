# ADR-001 — Obsidian Desktop as Application Shell

**Status:** Accepted | **Date:** 2026-09-20

## Context

Research notes, navigation, settings, and interactive analysis need one local
desktop environment.

## Decision

V1 is an Obsidian Desktop plugin with React views and native Obsidian concepts.

## Alternatives considered

Standalone browser application; Markdown templates only.

## Consequences

Plugin lifecycle and vault safety are first-class; the Research Core remains
independent of Obsidian.
