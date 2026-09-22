# Milestone 3 — Fixture and Validation Plan

**Status:** Approved fixture plan; implementation in progress. Manual acceptance
remains required before closure.

## Deterministic fixture cases

| Case | Required outcome |
| --- | --- |
| Default source-reported clock | Source-clock ordering and report-date daily drawdown are available; output is labelled `SOURCE_REPORTED_CLOCK` with no timezone claim. |
| Fixed-offset single day | Daily key and realised-balance high-water decline are deterministic. |
| IANA profile across DST transition | Local-day assignment follows recorded zone and tzdata identity; no offset is silently assumed. |
| Day boundary with source points on either side | Each point is assigned to the documented local day. |
| Partial first/last day | Result is retained with a partial-coverage warning, not completed with invented opening data. |
| No intratrade marks | Equity and equity-based drawdown remain `UNAVAILABLE`. |
| Intraday balance decline and recovery | Worst realised-balance drawdown is the maximum decline from the daily high-water mark. |
| Same dataset/profile/policy | Result identifiers, manifests, and daily artifacts are byte-stable in fresh workspaces. |
| Changed profile/policy | Produces a distinct configuration/result identity; never relabels prior output. |

## Required assertions

- Every time-sensitive result returns its time basis, resolved daily boundary,
  and warnings. Optional-profile results additionally return profile ID, profile
  source, and configuration hash.
- No result calls source timestamps UTC or broker-local time without a selected
  profile.
- `REALISED_BALANCE_ONLY` output is never rendered as equity or a prop-firm
  maximum daily loss result.
- Daily drawdown uses Decimal-safe source balances and reconciles to the
  retained balance series.
- Missing marks block equity-based calculations rather than triggering an
  estimated substitute.
- M3 leaves raw snapshots, canonical M1 events, and M2 lifecycle results intact.

## Manual review checklist

1. Confirm default source-reported-clock analysis produces a report-date daily
   result labelled `SOURCE_REPORTED_CLOCK`, not a guessed timezone.
2. Confirm an optional selected profile is visibly labelled `USER_SUPPLIED` and its
   configuration identity is displayed.
3. Confirm realised-balance daily drawdown is visibly distinct from equity and
   from any prop-firm rule.
4. Confirm a partial day and missing marks are shown as limitations.
5. Confirm a re-run with unchanged inputs produces the same identifiers and
   values, while a changed profile produces distinct output.
