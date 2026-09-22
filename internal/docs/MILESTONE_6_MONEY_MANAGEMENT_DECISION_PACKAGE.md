# Milestone 6 — Money-Management Research Decision Package

**Status:** Decision package only. No implementation is authorised.  
**Purpose:** establish whether the currently evidenced MT5 report data can
support an honest first money-management capability.

## Recommendation

**Defer money-management implementation.** The regular MT5 Strategy Tester
Excel report currently gives TRL realised event economics and volume, but not a
reliable per-trade risk model. A lot-size or risk-percentage engine built from
those reports would have to silently assume missing stop-loss, tick-value,
contract, margin, conversion, and execution facts. That would make it look more
precise than its evidence permits.

The accepted M6 What-If fixed-cost scenario and Monte Carlo order permutation
remain useful research tools, but neither is position sizing and neither should
be relabelled as money management.

## Evidence currently available

- verified realised close-event `net_pnl` in report currency;
- reported source order and timestamps;
- reported volume;
- symbol, direction, commission, swap, and fees where supplied;
- source-reported opening and realised balance information where available.

## Required evidence currently unavailable or not established

- intended stop-loss price/distance for each trade;
- money risk per lot and stable tick-value/contract specification;
- broker/account currency conversion path when needed;
- margin, leverage, free-margin, and liquidation rules;
- whether volume is an intended risk-sizing decision, a DCA/grid leg, a partial
  close, or another execution outcome;
- deposits, withdrawals, and complete capital-floor semantics;
- a stable rule for rounding, minimum volume, and volume step across symbols.

## Explicit blocks

Until a separately approved evidence source establishes the required facts, TRL
must block claims or calculations for fixed-fractional or percent-risk lot size,
risk-per-trade sizing, stop-loss-based sizing, margin-aware sizing, capital-
floor/ruin outcomes, prop-firm or broker compliance, currency-converted or
cross-symbol sizing, and “optimal” sizing recommendations.

## Future admissible first slice

Only after an approved richer evidence source is available, a first slice may
compare one explicit, declared sizing rule against the same eligible historical
event sequence. It must name its initial capital reference, sizing formula,
rounding/minimum-volume policy, missing-data blocks, capital-floor behaviour,
and whether it is historical replay or a scenario. The Core—not the plugin—must
perform all calculations and write a versioned configuration, result manifest,
and deterministic artifacts.

## Minimum decision checklist before implementation

1. Approve the evidence source: enriched MT5 export, controlled EA export, or
   another documented local input.
2. Approve one sizing formula and whether it is descriptive replay or a declared
   counterfactual scenario.
3. Approve initial-capital reference, deposits/withdrawals treatment, and
   capital-floor/stop rule.
4. Approve stop-loss/risk, tick-value, contract, currency, volume-step, and
   rounding evidence rules.
5. Approve all missing-fact block conditions and limitations.
6. Approve synthetic deterministic fixtures and owner panel-review criteria.

## Manual owner review required

Review this package and choose one of the following before any money-management
implementation: keep it deferred; provide/approve a richer evidence source; or
move to the separate optimisation-analysis decision package instead.
