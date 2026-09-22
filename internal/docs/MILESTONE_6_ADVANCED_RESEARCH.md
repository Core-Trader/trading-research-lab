# Milestone 6 — Advanced Research Specification

**Status:** The first What-If and Monte Carlo slices are accepted. Remaining
workstreams are unapproved and unimplemented.  
**Depends on:** `MILESTONE_1_CLOSURE_REPORT.md` through
`MILESTONE_5_CLOSURE_REPORT.md`.  
**Purpose:** add reproducible scenario and stochastic research capabilities
without turning historical MT5 analysis into trading advice, broker execution,
or unsupported risk claims.

## Scope

M6 may introduce four related workstreams, implemented only after their
individual policy and fixture decisions are approved:

1. **What-If scenarios** — declared, non-destructive changes to a selected
   analytical input or capital/sizing assumption, producing a separate result.
2. **Monte Carlo** — repeatable stochastic resampling or sequencing of an
   explicitly identified eligible population, with a recorded seed and method.
3. **Money-management research** — comparison of explicitly configured sizing
   policies against eligible historical or simulated inputs.
4. **Optimisation analysis** — provenance-preserving analysis of imported
   optimisation results, without claiming that a selected parameter set is
   robust or suitable for live trading.

Python remains the authoritative calculation engine. Obsidian only collects
explicit configuration, displays qualified results, and links them to the
selected source analysis. It performs no financial calculation.

## Universal reproducibility contract

Every M6 result must record, at minimum:

- input dataset/artifact identities, source hashes, quality states, and the
  exact eligible population used;
- Core, schema, calculation-policy, and IPC versions;
- a complete canonical configuration object and configuration hash;
- deterministic ordering and Decimal/rounding policy;
- random generator family, seed, sampling method, replacement rule, path/run
  count, and quantile/interpolation convention where stochastic;
- result identity, artifact hashes, availability state, warnings, and explicit
  exclusions;
- a statement that the output is research evidence, not investment advice,
  execution instruction, or a prop-firm/broker compliance determination.

The same inputs, configuration, versions, and seed must yield byte-stable
manifests and reproducible numerical outputs in a fresh workspace. A changed
configuration or seed creates a distinct result; it never overwrites, relabels,
or mutates a prior result.

## Evidence and eligibility boundary

- M6 consumes qualified M2/M3/M5 artifacts by identity. It does not rewrite raw
  snapshots, canonical data, M2 trade events, M3 risk artifacts, or M5 batch
  manifests.
- A calculation must name its basis. `VERIFIED_CLOSE_EVENTS`, `INFERRED_
  LIFECYCLES`, and source-clock realised-balance series cannot be silently
  mixed.
- Results based on `INFERRED`, `UNPAIRED`, `AMBIGUOUS`, gapped, partial, or
  otherwise qualified data must retain that qualification. The Core must block
  a requested calculation when its declared eligibility policy is not met.
- Regular MT5 reports still do not establish intratrade equity. M6 must not
  produce equity-based maximum loss, MAE/MFE, margin, liquidation, prop-firm,
  or live execution claims without a separately approved evidence source and
  policy.

## Workstream decision gates

### What-If scenarios

Before implementation, approve the permitted scenario variables, their ranges,
the baseline comparison rule, rounding, and whether a scenario can use only
source-verified close events or additionally a declared inferred basis. A
scenario may never modify its input artifact.

### Monte Carlo

Before implementation, approve the population, sampling method (for example,
independent resampling or order permutation), replacement policy, run count,
seed policy, path construction, capital-floor/ruin definition if any,
statistics/quantiles, and display language. Do not use an implicit seed or
describe percentile outcomes as probabilities of future performance.

### Money-management research

Before implementation, approve the initial balance/reference, sizing formulas,
rounding/minimum-size rules, loss limits, handling of missing risk-per-trade
information, and whether the result is historical replay, a scenario, or a
Monte Carlo output. The initial scope must block any sizing calculation that
would require unavailable stop-loss, tick-value, margin, conversion, or
instrument metadata.

### Optimisation analysis

Before implementation, approve the source format, required provenance,
parameter identity, in-sample/out-of-sample labeling, selection rule, handling
of missing/ambiguous data, and claims that must remain unavailable. An imported
optimisation table is evidence; it is not proof of robustness.

## Storage and IPC boundary

The Core will write versioned configuration JSON, result-manifest JSON, and
high-volume paths/tables as Parquet under the bounded workspace. IPC methods,
artifact schemas, and UI controls will be defined only for the first approved
workstream. The plugin must show input identity, calculation basis,
configuration/seed identity, warnings, and result availability adjacent to
every M6 result.

## Explicit exclusions

Live trading, order generation, broker APIs, signals, recommendations,
guaranteed-return language, hidden randomness, automatic parameter selection,
multi-account/shared-capital portfolio construction, currency conversion,
intratrade-equity reconstruction, prop-firm compliance, cloud execution,
telemetry, and commercial entitlement calculations in the Core are out of
scope.

## Owner decisions required

The owner selected and approved **What-If scenarios** as the first M6
workstream. The implemented first-slice policy is in
`MILESTONE_6_WHAT_IF_SCENARIO.md`. Its acceptance evidence is recorded in
`MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md`. Monte Carlo is accepted under the
policy and reference review in `MILESTONE_6_MONTE_CARLO.md`; its closure evidence
is in `MILESTONE_6_MONTE_CARLO_CLOSURE_REPORT.md`. Money-management research and
optimisation analysis remains unapproved beyond its implemented first-slice
evidence viewer. Paired forward evidence comparison is accepted only as a
source-preserving, inspection-only capability; it does not authorise selection.
The money-management
decision package currently recommends deferral because regular MT5 report
evidence cannot support true sizing claims; see
`MILESTONE_6_MONEY_MANAGEMENT_DECISION_PACKAGE.md`. The optimisation decision
package distinguishes the earlier multi-symbol aggregate-results XML from the
new 162-pass parameter-grid XML; the evidence viewer is accepted after
owner-panel validation. See
`MILESTONE_6_OPTIMISATION_ANALYSIS_DECISION_PACKAGE.md`.
