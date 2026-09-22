# Development Playbook

## Reusable sequence

1. Capture objective, scope, source material, and owner decisions.
2. Write/approve the canonical data model and testable financial semantics.
3. Establish offline-capable local environment and verify each toolchain component.
4. Create synthetic fixtures and deterministic unit/scenario tests.
5. Build one narrow importer around representative real files.
6. Reconcile its completed-trade baseline before expanding formats.
7. Implement the replay core and validate one strategy before multiple strategies.
8. Add risk policies and explainability outputs.
9. Build the browser UI over proven projections.
10. Add advanced research modules only after baseline evidence remains stable.

## Session checklist

- Read the relevant specification and open decision/bug entries.
- Confirm the objective and acceptance evidence for this unit of work.
- Inspect existing changes before editing.
- Make the smallest coherent change and run its proportionate tests.
- Record what happened: command/tool version where relevant, input fixture identity, verification result, issues, files, and commit/reference.

## Documentation templates

Use `journal/DEVELOPMENT_LOG.md` for work performed, `DECISION_LOG.md` for choices and reversal triggers, `BUG_LOG.md` for meaningful defects, `LESSONS_LEARNED.md` for reusable principles, and `ARCHITECTURE_DECISIONS.md` for formal architecture records.

## Local/cloud working policy

Preferred working location is a non-synchronised local folder (for example, `C:\Dev\TradingResearchLab`). OneDrive or Google Drive is supported only when the full project is configured for offline availability. Confirm local materialization before tool setup, do not trust sync status as version control, and use Git as the source of truth.

## Evidence before progression

Do not move to the next stage because a screen looks plausible. Progress when the required test, traceable input/output evidence, and reconciliation classification for the current stage are recorded.
