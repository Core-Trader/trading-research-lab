# Milestone 2 — Trade and Event Analysis Specification

**Status:** Closed, 2026-09-20. See `MILESTONE_2_CLOSURE_REPORT.md`.  
**Depends on:** `MILESTONE_1_CLOSURE_REPORT.md`  
**Purpose:** add deterministic event-level and, where explicitly allowed,
lifecycle-level trade analysis without claiming evidence the MT5 report lacks.

## Scope

M2 adds source-faithful close-event summaries, quality-labelled trade-lifecycle
reconstruction, completed-trade distributions, and basic reports. Python remains
the sole calculation authority. The Obsidian plugin requests compact results and
renders them without financial formulas.

## Evidence-first output channels

### Verified close-event channel

Every supported `POSITION_CLOSE` event is a verified source event. M2 may report
its reported profit, commission, swap, and source-signed net result without
claiming that it is a complete position lifecycle. This channel remains usable
when account mode or position identity is unknown.

### Lifecycle channel

A lifecycle contains allocated opening and closing events. It is labelled:

- `MT5_VERIFIED` only when a supported source supplies an unambiguous position
  identity for every allocated event;
- `INFERRED` when a versioned matching policy reconstructs it without that
  identity;
- `UNPAIRED` when an opening or closing allocation has no valid counterpart;
- `AMBIGUOUS` when more than one valid interpretation remains under the selected
  policy.

Regular MT5 Strategy Tester Excel reports do not establish account mode or
position identity. They must never silently produce `MT5_VERIFIED` lifecycles.

## Recommended M2 policy for owner approval

Enable inferred lifecycle reconstruction only after the user explicitly declares
the account mode as `HEDGING` for that analysis. Record the declaration as
`USER_SUPPLIED`, never as a broker fact. Use deterministic chronological FIFO
matching within the same symbol and direction; a partial close allocates volume
against one or more earlier openings in source order. An unknown or netting mode
does not enter this M2 inferred-lifecycle path.

The policy is versioned as `mt5-excel-hedging-fifo-v1`. The output records the
policy ID, policy configuration hash, quality state, allocated source sequences,
and deterministic UUIDv5 lifecycle ID. Re-running the same dataset and policy
must give identical artifacts and results.

## Economics and metrics

- All money, volume, and allocation arithmetic uses Decimal-safe strings.
- Lifecycle net P/L is the signed sum of the allocated source profit,
  commission, and swap components. Partial-event economics are allocated by
  volume using a documented deterministic remainder rule; no float arithmetic.
- Basic lifecycle metrics include count, net P/L, gross profit, gross loss,
  win/loss/breakeven counts and rates, and distribution-ready values.
- Event-level and lifecycle-level results remain separate. A combined metric is
  not emitted merely for convenience, and quality categories are never silently
  mixed.
- Holding duration, when later enabled, is only a source-clock elapsed interval;
  it is not a broker-timezone conversion or session classification.

## Storage and IPC contract

The Core writes a versioned lifecycle Parquet artifact plus JSON manifest under
the bounded dataset workspace. It returns artifact references, compact quality
counts, configuration identity, and warnings through new version-1 methods:

- `analysis.close_event_summary`
- `analysis.reconstruct_lifecycles`
- `analysis.lifecycle_summary`

The plugin must display the analysis basis (`Verified close events` or
`Inferred lifecycles`), quality counts, policy, supplied account-mode declaration,
and warnings beside every metric.

## Out of scope

Forensic EA ingestion, automatic account-mode discovery, broker timezone
conversion, intratrade equity, daily drawdown, prop-firm policies, portfolio
replay, optimisation, Monte Carlo, and changing MT5 source imports.

## Owner decisions required

Approve or amend the recommended hedging-only FIFO policy, partial-allocation
rule, quality-separated presentation, exact M2 metrics, fixtures, and manual
review checklist before implementation starts.
