# Milestone 5 — Portfolio Replay Discovery

**Status:** Discovery completed; superseded by the owner-approved M5
specification and checklist on 2026-09-21.  
**Purpose:** turn the existing proposed Portfolio Replay milestone into an
approved evidence-qualified specification, starting with common balance analysis
across several MT5 Excel reports.

## New recorded requirement

Common balance analysis must accept a user-selected batch of several MT5
Strategy Tester Excel (`.xlsx`) reports. Each input remains an independently
preserved source with its own hash, managed snapshot, canonical dataset, and
intake evidence. The product must not silently concatenate files into one
dataset.

Before any combined result, the future Core must make the proposed report set
and its aggregation basis reviewable, including chronological coverage,
duplicates/overlaps, gaps, currency/account compatibility, and any funding or
shared-capital assumptions.

## Non-negotiable boundaries

- No directory or vault-wide automatic intake; the user explicitly selects the
  reports in a batch.
- No silent deduplication, ordering, currency conversion, or balance carryover.
- No claim of a continuous account, shared balance, equity curve, or daily-risk
  result when the supplied evidence cannot support it.
- No modification of the original reports or existing canonical datasets.
- Batch workflow orchestration may reduce clicks later, but it must preserve the
  same source evidence and explicit document-write safeguards established in
  M1–M4.

## Confirmed decision

**Aggregation intent:** approved on 2026-09-21 as sequential reports from one
account only. Shared-capital and multi-account aggregation are deferred.

## Decisions required before implementation

1. **Ordering and overlap:** define ordering keys, treatment of identical source
   events, overlapping date ranges, and gaps.
2. **Capital model:** define opening-balance, deposits/withdrawals, balance
   carryover, and shared-capital rules.
3. **Compatibility:** define currency handling and the result when account,
   currency, symbol, or report-clock facts differ.
4. **Risk qualification:** define which balance/equity/drawdown outputs remain
   available for a batch and which must be labelled unavailable.
5. **Workflow:** decide which validated steps can be orchestrated automatically
   and which require review/confirmation before research documents are written.

## Required future evidence and acceptance

A formal M5 specification must add deterministic fixtures for normal sequential
batches, duplicates, overlaps, gaps, incompatible currencies/accounts, and
partial/missing evidence. It must define Parquet/JSON artifacts, IPC responses,
and an owner review screen that clearly shows the selected batch before a
combined analysis is created.

## Manual review when M5 is specified

The owner must review and approve the proposed batch membership, order,
compatibility findings, overlap/gap treatment, and aggregation basis before any
combined balance analysis or related research document is written.
