# Shared-Account Replay Engine Specification

## Objective

Produce an auditable projection of what the selected imported events imply under one explicitly configured account model. The engine is not a substitute for the original broker/MT5 execution model and must label unsupported assumptions.

## Inputs

- Immutable selected normalised events and their source manifests
- Account scenario: opening balance, currency, leverage, cost/margin policies
- Daily drawdown policy
- Mark-price policy and available `MARK` events
- Engine semantic version and event-ordering table version

## State

At each ordered event the state includes: cash balance, realised P/L, costs, open positions, marks used, unrealised P/L, equity, used/free margin when supported, high-water marks, daily-policy state, warnings, and violations.

## Core equations

```text
net realised P/L = gross realised P/L + commission + swap + cash adjustments
balance           = opening balance + cumulative net realised P/L
equity            = balance + unrealised P/L
drawdown          = running equity peak - current equity
drawdown %        = drawdown / running equity peak, when peak > 0
```

The source adapter must state its cost sign convention before values enter these equations. The canonical convention preserves source-signed cash components, so a commission or swap that reduces balance is negative.

## Processing algorithm

1. Validate all input manifests and required policy fields.
2. Generate a stable, fully ordered event stream.
3. Apply each event atomically to a copy of state.
4. Revalue open positions only using an allowed mark; otherwise retain the last permitted mark and emit a warning, or block the requested metric according to policy.
5. Compute account metrics and daily-risk observations at each relevant checkpoint.
6. Persist an append-only ledger entry and snapshot references.
7. Finalize summary metrics, provenance manifest, warnings, and evidence links.

If an event cannot be applied, the run fails with a classified error; it must not skip the event silently.

## Same-timestamp behavior

Same-time events are ordered by the persisted tuple from the data model. The initial priority table will be specified and tested before implementation. Until then, a report that depends on same-timestamp ordering is a design question, not a calculation result.

## Daily drawdown

The policy defines: (a) timezone, (b) reset local time, (c) balance or equity starting baseline, (d) realised-only or realised-plus-floating treatment, and (e) whether breaches are evaluated continuously at available checkpoints or only at day close. The output includes the policy ID and the maximum adverse daily observation; it never labels a generic daily-loss number as universal.

## Reconciliation modes

- **Balance reconciliation:** completed-trade cash totals only.
- **Equity reconciliation:** requires sufficiently granular reliable marks.
- **Account-model replay:** also requires explicit currency conversion and margin semantics when relevant.

The mode is a result attribute, not a UI choice hidden from the record.
