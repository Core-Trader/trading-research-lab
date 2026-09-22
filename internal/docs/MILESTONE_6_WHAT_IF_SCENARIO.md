# Milestone 6 — What-If Scenario: Fixed Per-Close-Event Cost

**Status:** Accepted; see `MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md`.  
**Workstream:** What-If scenarios.  
**Depends on:** `MILESTONE_2_CLOSURE_REPORT.md` and the universal M6 policy in
`MILESTONE_6_ADVANCED_RESEARCH.md`.

## Purpose

Establish the reusable M6 configuration, provenance, artifact, and comparison
contract through one deliberately narrow scenario: apply a declared additional
fixed monetary cost to every eligible verified close event.

This is a sensitivity calculation over historical reported event economics. It
does **not** estimate future commissions, spreads, slippage, execution quality,
or profitability.

## Proposed initial input boundary

- **Allowed basis:** `MT5_VERIFIED_CLOSE_EVENTS` only.
- **Excluded basis:** inferred lifecycles, unpaired/ambiguous records, M3
  realised-balance series, M5 combined balance artifacts, and mixed-quality
  populations.
- **Population:** every eligible verified close event in one selected M2
  close-event artifact, in its recorded source order. The scenario never
  filters, reorders, creates, or removes events.
- **Currency:** the scenario cost must use the source artifact currency. Mixed
  currency is blocked; no conversion is attempted.

This boundary is intentionally stricter than later What-If work. It proves the
configuration contract without turning inferred trade pairings or balances into
unsupported scenario inputs.

## Proposed configuration

```json
{
  "policy_id": "what-if-fixed-close-event-cost-v1",
  "input_artifact": "<verified-close-event-artifact-id>",
  "input_basis": "MT5_VERIFIED_CLOSE_EVENTS",
  "currency": "<source currency>",
  "additional_cost_per_close_event": "0.00",
  "rounding": "preserve source Decimal precision; no implicit currency rounding",
  "event_selection": "all eligible verified close events in recorded source order"
}
```

`additional_cost_per_close_event` is a non-negative Decimal string. It is not a
percentage, lot-based charge, spread, commission replacement, or instrument
conversion. A negative value and a missing/invalid currency block the request.

## Proposed calculation and outputs

For each eligible close event:

```text
scenario_net_pnl = source_net_pnl - additional_cost_per_close_event
```

The Core returns a separate, versioned scenario artifact containing source and
scenario P/L values in source order. The compact IPC result and plugin view show:

- input artifact identity, source quality, event count, and currency;
- full canonical configuration and configuration hash;
- baseline net P/L, scenario net P/L, and exact delta;
- baseline and scenario win/loss/breakeven counts, where a cost-induced sign
  change is a scenario classification, not a modification of the source fact;
- result/manifest identities, calculation version, warnings, and exclusions.

No balance curve, daily drawdown, equity, position sizing, capital floor,
probability, or prop-firm result is produced by this first slice.

## Storage, determinism, and safety

The Python Core writes a new bounded Parquet scenario table plus a JSON manifest
under the selected artifact's bounded workspace. The manifest includes the
input artifact hash, input quality, configuration hash, Decimal policy, Core and
calculation versions, and output hashes. The plugin may request and render the
result but performs no calculation.

Same input artifact and configuration yield the same scenario identity and
byte-stable fresh-workspace artifact. Changed cost or configuration creates a
distinct artifact. No source snapshot, canonical dataset, M2 artifact, M3/M5
artifact, Markdown document, or user-authored note is changed.

## Explicit limitations

- The configured cost is an analytical assumption supplied by the user; it is
  not verified broker data.
- Results do not model trade size, lots, ticks, symbols, spreads, slippage,
  margin, swaps beyond source-reported swap, execution timing, FX conversion,
  deposits/withdrawals, or open positions.
- A scenario comparison is not a forecast, recommendation, live-trading signal,
  or compliance result.

## Owner review outcome

The owner approved and manually validated the initial policy on 2026-09-21,
including the corrected inline negative-cost error. See
`MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md`.
