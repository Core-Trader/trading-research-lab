# Milestone 6 — Monte Carlo Order-Permutation Closure Report

**Status:** accepted on 2026-09-21.  
**Scope:** first bounded Monte Carlo slice only.

## Delivered capability

The Research Core deterministically permutes the order of one M2
`MT5_VERIFIED_CLOSE_EVENTS` population without replacement. It uses required
explicit uint64 seed, `PCG32-v1`, deterministic Fisher–Yates shuffle, and a
bounded path count. It writes versioned Parquet path summaries and JSON
provenance without modifying source or M2 artifacts.

The Obsidian panel exposes the seed and path count only after M2 verified
trade-event analysis is available. It shows qualified money-only drawdown
summaries and creates no research document.

## Acceptance evidence

- Automated validation passed: 40 Research Core tests, 7 plugin tests, and the
  production plugin build.
- The pinned Strategy Factory `MonteCarloSimulator` was reviewed as a concept
  reference only. No source code was reused; its replacement sampling,
  percentage-return compounding, and probability claims were rejected.
- The owner confirmed the panel behaviour, input dependency, invariant final
  P/L, deterministic same-input result, changed-seed distinct result, inline
  invalid-input feedback, limitations, and no-document boundary.

## Explicitly not delivered

Replacement/bootstrap return sampling, capital/equity curves, probability or
confidence claims, ruin calculations, prop-firm compliance, position sizing,
currency conversion, multi-account aggregation, and optimisation remain out of
scope. Money-management and optimisation require their own M6 policy packages.
