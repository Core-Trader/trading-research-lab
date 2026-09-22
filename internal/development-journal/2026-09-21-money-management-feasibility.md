# Milestone 6 Money-Management Feasibility — 2026-09-21

## Work completed

Prepared the first money-management decision package without implementing a
calculation, UI control, or new data importer.

## Evidence conclusion

Regular MT5 Strategy Tester Excel reports establish realised event P/L and may
include volume, but do not establish the per-trade and account facts required
for an honest lot-sizing or percent-risk calculation. In particular, stop-loss,
risk-per-lot, tick-value/contract, margin, conversion, volume-step, and intent
of reported volume are not available under the current evidence contract.

## Decision recommendation

Defer money-management implementation. Do not reinterpret existing What-If or
Monte Carlo results as sizing research. A future policy must first approve a
richer evidence source and complete sizing, capital, rounding, missing-data,
fixture, and manual-review decisions.

## Manual owner review

Review `MILESTONE_6_MONEY_MANAGEMENT_DECISION_PACKAGE.md` and decide whether to
keep money management deferred, approve a richer local evidence source, or move
to the separate optimisation-analysis decision package.
