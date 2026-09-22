# Milestone 6 — Monte Carlo: Verified Close-Event Order Permutation

**Status:** Accepted after Strategy Factory reference review and owner-panel
validation.  
**Workstream:** Monte Carlo.  
**Depends on:** `MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md` and the universal M6
reproducibility rules in `MILESTONE_6_ADVANCED_RESEARCH.md`.

## Purpose

Measure the sensitivity of **historical verified close-event P/L ordering** to
deterministic random permutation. The first Monte Carlo slice does not create
new outcomes or predict future returns: each path contains every eligible
historical close event exactly once, in a different seeded order.

This can describe how the observed sequence affects cumulative close-event P/L
path drawdown. It cannot establish future probability, account equity,
broker-execution behaviour, capital adequacy, or strategy robustness.

## Proposed initial input boundary

- **Allowed basis:** one M2 `MT5_VERIFIED_CLOSE_EVENTS` artifact only.
- **Population:** every eligible verified close event's source `net_pnl`, in
  recorded source order, with source artifact identity and hash retained.
- **Excluded basis:** inferred lifecycles, unpaired/ambiguous records,
  M3 realised-balance results, M5 combined artifacts, mixed-quality data,
  multiple accounts, and any currency-converted population.
- **Minimum population:** two verified close events. A smaller population
  blocks because meaningful order variation is unavailable.

## Proposed simulation policy

```json
{
  "policy_id": "monte-carlo-close-event-order-permutation-v1",
  "input_basis": "MT5_VERIFIED_CLOSE_EVENTS",
  "input_artifact": "<verified-close-event-artifact-id>",
  "population": "all eligible verified close-event net P/L values",
  "sampling_method": "ORDER_PERMUTATION_WITHOUT_REPLACEMENT",
  "path_count": 1000,
  "seed": "<required non-negative uint64 decimal>",
  "prng": "PCG32-v1",
  "path_start": "0 cumulative close-event P/L",
  "drawdown": "maximum decline from cumulative path high-water mark",
  "quantiles": "nearest-rank p05, p50, p95"
}
```

- The seed is mandatory and must be an unsigned 64-bit decimal integer. There
  is no implicit clock-based or hidden default seed.
- `path_count` is an explicit positive integer. The proposed first-slice cap is
  10,000 paths; the recommended review default is 1,000.
- The specified PCG32 algorithm is implemented by the Core, not delegated to a
  runtime's unspecified random helper. Its algorithm/version and seed are in
  every manifest.
- A path starts at zero cumulative **close-event P/L**, not account balance or
  equity. Therefore drawdown is reported as currency amount only—never a
  percentage, margin, equity, or prop-firm result.

## Proposed calculation and outputs

For each seeded path, permute the population without replacement and calculate
the cumulative P/L series and its maximum high-water decline. Since every path
uses the same values exactly once, final cumulative P/L must equal the source
population total for every path. A mismatch is a structured calculation error.

The Core writes a bounded Parquet table of path summaries and JSON manifest. It
returns compact results only:

- population count, source total P/L, path count, seed, PRNG, and configuration
  identity/hash;
- invariant final P/L confirmation;
- minimum, p05, p50, p95, and maximum observed path drawdown, in source
  currency only;
- deterministic identifiers for the worst and best observed paths, without
  presenting a sampled path as a forecast;
- a bounded Core-derived equal-width histogram of generated maximum drawdowns
  for visual presentation only. The histogram is derived from the stored path
  summaries, has no randomisation of its own, and is not a substitute for the
  Parquet evidence artifact;
- eligibility, source-quality, and explicit limitation warnings.

No path-level tables are placed in Markdown automatically, and TypeScript does
not perform randomisation or financial calculation.

## Determinism and storage

The Core must use a specified PCG32-v1 implementation and a deterministic
Fisher–Yates shuffle. Same input artifact, configuration, Core/calculation
version, and seed produce the same path summaries, manifest, and artifact bytes
in a fresh workspace. A changed seed, path count, method, or input artifact
produces a distinct identity and never overwrites a previous result.

The bounded manifest records input artifact hash, currency, configuration/hash,
PRNG/seed, sampling method, path count, quantile convention, output hashes,
and all warnings. It neither modifies the M2 artifact nor source data.

## Strategy Factory reference review

The pinned Strategy Factory reference (commit
`31e778a78b465ce1a0e16e232f762ebe8ca80b52`,
`strategy_factory/validation_utils.py`) uses NumPy sampling **with replacement**
over portfolio percentage returns, compounds from supplied initial capital, and
reports confidence intervals and probability-of-profit values. It also does not
show an explicit seed contract in that implementation.

TRL adopts no source code from that repository. The review reinforces three
compatible concepts: an explicit run count (1,000 as the proposed default),
visible tail/worst-case summaries, and storage of per-run evidence. It does
**not** adopt replacement resampling, percentage-return compounding, confidence
interval/profit-probability claims, or implicit randomness. Those require a
later separately approved evidence model with verified returns and capital
semantics.

## Explicit limitations

- Order permutation preserves the historical distribution and total; it does
  not estimate different trade outcomes, live execution, or future likelihood.
- Cumulative close-event P/L is not reported account balance or intratrade
  equity. Its drawdown is not a daily-loss, maximum-loss, margin, or prop-firm
  measure.
- The result has no position sizing, compounding, deposits/withdrawals, currency
  conversion, stop-loss, volatility, correlation, or parameter-selection model.
- Percentile labels describe the generated finite path set only; they must not
  be presented as probabilities of future performance.

## Owner approval outcome

The owner approved this policy on 2026-09-21, subject to the recorded Strategy
Factory reference comparison above. Implementation must preserve the
verified-close-event-only input boundary, order permutation without replacement,
explicit seed/PCG32-v1/Fisher–Yates rules, run limits, money-only drawdown, and
nearest-rank p05/p50/p95 result convention.

## Owner review outcome

The owner completed the Obsidian panel review on 2026-09-21. The panel correctly
remains unavailable until M2 verified trade-event analysis establishes its only
eligible input. The owner confirmed the visible seed/path controls, final-P/L
invariant, money-only drawdown wording and limitations, deterministic same-input
rerun, distinct changed-seed result, inline invalid-input feedback, and the
no-document boundary. Closure evidence is recorded in
`MILESTONE_6_MONTE_CARLO_CLOSURE_REPORT.md`.
