# Milestone 4 — Fixture and Validation Plan

**Status:** Closed; approved fixture plan and owner manual acceptance are
recorded in `MILESTONE_4_CLOSURE_REPORT.md`.

## Deterministic fixture cases

| Case | Required outcome |
| --- | --- |
| Create strategy | A selected `Strategies/` path receives valid `trl_` frontmatter and an empty user-owned body. |
| Pre-analysis document controls | Strategy actions are visible and available before an MT5 report is loaded; experiment/report actions are visible but disabled with an explanatory message. |
| Create experiment | Explicit strategy/dataset/analysis IDs are recorded; no ID is inferred from a filename. |
| Select existing document | The user explicitly opens one note in Obsidian; the plugin reads only that current/last-opened Markdown note and validates its expected `trl_type` and required relationships. |
| Corrected existing-document selection | A prior selection error is cleared after a later valid selection, and the selected document identity/path is shown. |
| Mismatched existing experiment/report | Selection is blocked if its dataset/analysis or experiment relationship differs from the current selection. |
| First report generation | Exactly one marker pair and required report references are created. |
| Regenerate valid report | Only the generated block and plugin-owned version keys change; user prose and non-`trl_` frontmatter remain intact. |
| Malformed/duplicate markers | Write is blocked without altering the document. |
| Report-check failure feedback | A report validation failure is shown in the document section beside the report controls, not only in a distant page-level error area. |
| Missing/inconsistent relationship | Write is blocked with a reviewable error; no repair or inferred relationship occurs. |
| Changed analysis/configuration | Revision increases and a new report-manifest identity records current evidence and supersession. |
| Repeat unchanged generation | Candidate managed hash/identities match the current report; no write, revision, or duplicate report is created, and the UI reports `NO_CHANGES_DETECTED`. |
| Manual change inside generated block | The mismatch is detected; a warning is shown before the block is replaced and the changed regeneration receives a revision record. |
| Unrelated vault note | It is never scanned, classified, or modified. |

## Required assertions

- Every generated report identifies selected source hash, dataset, analysis,
  configuration, Core/schema/calculation versions, quality/availability state,
  and artifact references.
- Generated writes use the Obsidian vault API and exact marker boundary only.
- Errors leave the target and unrelated notes unchanged.
- Unchanged managed inputs make no vault write or revision and produce a visible
  `NO_CHANGES_DETECTED` result. A report-revision manifest is distinct for
  changed source/analysis/configuration identities.
- Plugin tests cover marker failure, frontmatter preservation, and revision
  behaviour; Core tests cover deterministic manifest/payload identity.

## Manual review checklist

1. Before loading a report, confirm strategy actions are available and experiment/report actions are visibly disabled with an explanation.
2. Confirm creating a strategy and experiment does not change unrelated notes.
3. Confirm an experiment visibly shows selected—not inferred—relationships.
4. Open one existing note from the sidebar, then confirm the matching current-note action reads only that note and rejects a mismatched type or relationship.
5. Confirm an unchanged regeneration performs no write/revision and visibly says no changes were detected.
6. Confirm the regeneration warning appears before a changed generated block is replaced.
7. Confirm manual text outside the marker block is unchanged after regeneration.
8. Confirm malformed markers prevent a write and show a reviewable error.
9. Confirm a changed analysis produces an understandable revision/evidence record rather than silently overwriting provenance.
