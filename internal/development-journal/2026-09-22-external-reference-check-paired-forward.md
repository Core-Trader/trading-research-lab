# M6 Paired-Forward External Reference Check — 2026-09-22

## Purpose

Re-check the accepted paired forward evidence design against the two pinned
external reference repositories before advancing M6.

## Findings

Strategy Factory separates training and forward validation but reaches its
results through rolling re-optimisation, direct strategy execution, and
optimiser-selected parameters. Those patterns cannot be safely inferred from
the precomputed MT5 SpreadsheetML sources now in TRL.

Journalit confirms a useful UX pattern: make imported evidence visibly
inspectable before further user action. TRL already implements that idea
independently with source-labelled, bounded tables.

## Decision

Keep the current strict complete-signature pairing and source-only side-by-side
viewer. Do not import selection, scoring, aggregation, or code from either
reference. No external code was used, so the external-code usage register
remains unchanged.

## Next safe work

The parameter-selection decision package was prepared, but no selection
implementation is authorised until the owner chooses its policy.
