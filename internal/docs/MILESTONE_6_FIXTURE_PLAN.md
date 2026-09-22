# Milestone 6 — Advanced Research Fixture Plan

**Status:** What-If and Monte Carlo slices accepted. Remaining workstream
fixtures require their own policy approval before implementation is authorised.

## Universal deterministic cases

| Case | Required outcome |
| --- | --- |
| Same input, configuration, versions, and seed | Fresh workspaces yield the same result identity, manifest, and numerical output. |
| Changed configuration | Produces a distinct result identity; prior artifacts remain unchanged. |
| Changed seed | Produces a distinct stochastic result identity; the manifest shows the new seed. |
| Missing seed for a stochastic request | The Core blocks with a structured error; it never chooses a seed silently. |
| Ineligible/qualified input | The Core blocks or retains the declared quality limitation exactly as the approved policy requires. |
| Input artifact tampering or identity mismatch | The Core blocks and preserves all prior artifacts. |
| Result rerun | Uses a bounded reuse/no-write policy or a deterministic new revision policy, whichever the approved workstream specifies. |

## Workstream-specific cases to approve later

### What-If

- fixed additional cost of zero preserves every source net P/L and aggregate;
- one declared positive Decimal cost produces an independently checkable exact
  event and aggregate delta;
- a cost-induced sign change is labelled as scenario-only and does not change
  source facts;
- negative, non-Decimal, or currency-mismatched cost blocks;
- an inferred, mixed-quality, or missing close-event artifact blocks;
- same input/configuration is byte-stable in a fresh workspace; a changed cost
  produces a distinct result identity without writing to the input artifact.

### Monte Carlo

- a fixed tiny verified-event population with independently checkable PCG32-v1
  seeded Fisher–Yates paths;
- same input/configuration/seed produces byte-stable path summaries and
  artifact bytes in fresh workspaces;
- changed seed or path count creates a distinct result identity;
- every path final cumulative P/L exactly matches the source population total;
- deterministic nearest-rank p05/p50/p95 drawdown values over a small known
  path set;
- missing, invalid, or out-of-range uint64 seed blocks;
- one-event, inferred, mixed-quality, missing-currency, or tampered input
  artifact blocks;
- path count above the approved cap blocks without partial artifact output.

### Money management

- No fixture or implementation is authorised while
  `MILESTONE_6_MONEY_MANAGEMENT_DECISION_PACKAGE.md` recommends deferral for
  insufficient sizing evidence.
- If a future richer evidence source is approved: known eligible event/risk
  facts with one approved fixed sizing rule; rounding/minimum-size boundary;
  missing required risk/instrument fact; and capital-floor or stop-rule boundary.

### Optimisation analysis

- The proposed first slice in
  `MILESTONE_6_OPTIMISATION_ANALYSIS_DECISION_PACKAGE.md` is an evidence viewer,
  not parameter selection. Its required fixtures are valid source retention,
  missing identity/header blocking, duplicate qualification, modified/tampered
  source handling, and parameterless-table selection blocking.
- A later parameter-analysis slice additionally requires a fully evidenced
  parameter grid, missing parameter/provenance-field blocks, separated
  in-sample/out-of-sample labels, and blocking of a recommended live parameter
  set unless separately approved.

All fixtures must be synthetic or cleared for repository use. Proprietary MT5
reports remain local-only smoke evidence.
