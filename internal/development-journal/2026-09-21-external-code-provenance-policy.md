# External Code Provenance Policy Update — 2026-09-21

## Decision recorded

The project owner reports that the developer/owners of Journalit and Strategy
Factory approved direct code reuse, conditional on a complete final report of
components actually used. The owner retains the original correspondence; no
private correspondence was added to the repository.

## Controls added

- `EXTERNAL_CODE_USAGE_REGISTER.md` is the authoritative running record.
- `EXTERNAL_CODE_USAGE_FINAL_REPORT.md` is the private, repository-specific
  final-report template.
- Every direct or substantial derivation must record its exact external commit,
  source, destination, changes, validation, dependencies, and product scope
  when introduced.
- No untracked external code reuse is permitted.
- Permission does not replace independent validation of quantitative logic.

## Current provenance state

No external code, assets, or substantially derived implementation has been
incorporated into TRL as of this update. The prior Journalit and Strategy
Factory reviews remain concept/pattern review only.
