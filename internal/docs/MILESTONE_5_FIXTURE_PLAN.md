# Milestone 5 — Sequential Batch Fixture Plan

**Status:** Validated and closed on 2026-09-21. Combined realised-balance
artifacts and qualified source-clock daily drawdown are in scope; broader
portfolio outputs remain excluded.

## Required deterministic fixture cases

| Case | Required preflight/result outcome |
| --- | --- |
| One valid sequential same-currency pair | Each source remains independently evidenced; preflight proposes a deterministic order and reports the continuity evidence. |
| Repeated identical source file | The second selection is visibly identified as the same source; no duplicate member is silently added. |
| Overlapping report coverage | Preflight identifies the overlap and blocks combined output unless an approved rule permits it. |
| Potentially duplicated source events | Matching timestamp-and-deal identifiers are blocked; a reused deal number in non-overlapping event spans is a warning. The preflight never silently deduplicates. |
| Gap between reports | Preflight reports the gap and applies the approved continuity rule. |
| Opening/final balance mismatch | Preflight reports the discrepancy; it does not invent a deposit, withdrawal, or carryover. |
| Different report currencies | Combined monetary balance is unavailable unless a future approved conversion policy applies. |
| Different report-clock assumptions | Time-sensitive combined output is blocked or explicitly qualified according to the approved rule. |
| Missing regular-report equity evidence | Combined intratrade equity and equity drawdown remain `UNAVAILABLE`. |
| Same approved batch rerun | Batch identity, manifest, findings, and derived artifacts are byte-stable in fresh workspaces. |
| Eligible artifact and daily view | Only an explicitly confirmed eligible batch writes its bounded Parquet/JSON artifact; the separate daily result remains source-clock realised-balance only and retains the gap qualification. |

## Required assertions after approval

- A batch manifest references every source hash and canonical dataset identity.
- No raw snapshot, canonical M1 dataset, M2 artifact, or M3 artifact is altered.
- All user-supplied declarations are labelled as such in the manifest and UI.
- No combined metric is returned when its compatibility/continuity preconditions
  are not met.
- Errors and rejected preflights leave source datasets and unrelated documents
  unchanged.
