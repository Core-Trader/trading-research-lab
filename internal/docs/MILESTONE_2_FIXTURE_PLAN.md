# Milestone 2 — Fixture and Validation Plan

**Status:** Approved fixture plan; implementation in progress. Manual acceptance
remains required before closure.

## Deterministic fixture cases

| Case | Required outcome |
| --- | --- |
| Verified close event | Report close-event economics exactly as source-signed data. |
| Single inferred lifecycle | One hedging opening and closing allocation creates one `INFERRED` FIFO lifecycle. |
| Partial close | Volumes and economics allocate deterministically; remainder policy is explicit. |
| Multiple matching openings | FIFO source order is reproducible and recorded. |
| Unpaired closing event | No invented opening; output is `UNPAIRED`. |
| Ambiguous or unsupported account mode | No inferred lifecycle is created. |
| Source-supplied position ID, if adapter support is later added | Only then may an eligible lifecycle be `MT5_VERIFIED`. |

All fixtures are synthetic, deterministic test definitions that write temporary
artifacts. Proprietary MT5 reports and forensic EA output remain local-only
smoke evidence.

## Required assertions

- Same events plus same policy/configuration produce byte-stable lifecycle
  manifest/artifact identities in fresh workspaces.
- A changed policy/configuration produces an explicitly distinct artifact; it
  never overwrites or relabels an existing result.
- Decimal allocation reconciles allocated event volume and economics exactly,
  including the documented final remainder.
- Quality categories, policy, account-mode source, source sequences, warnings,
  and unavailable metrics are visible in Core output and the plugin view.
- M2 does not write to raw snapshots or alter M1 canonical events.

## Manual review checklist

1. Confirm an inferred lifecycle is visibly labelled `INFERRED`, not verified.
2. Confirm verified close-event metrics and inferred-lifecycle metrics are shown
   as separate bases.
3. Confirm an `UNPAIRED` or `AMBIGUOUS` case does not gain P/L or duration by
   guesswork.
4. Confirm the declared account mode is displayed as user supplied.
5. Confirm re-running a selected fixture yields the same identifiers and
   quality counts.
