# Initial Environment Setup Tool Specification

**Status:** Design only — do not implement in Step 1.

## Goal

Provide a Windows-first, local-first bootstrap tool that prepares a reproducible Trading Research Lab development workspace and reports what it verified. It must be safe to re-run and must not silently install, alter system settings, or overwrite project files.

## Supported target

Initial target: Windows developer machine, project workspace, Git, Python, Node.js, and a browser. MT5 is an optional import-data source; an MT5 terminal is not required to run the future application.

## Inputs

- Project directory (default recommendation: `C:\Dev\TradingResearchLab`)
- Optional cloud-folder acknowledgement and offline-availability confirmation
- Whether the tool may initialize Git when no repository exists
- Optional paths/commands for Python, Node.js/npm, and Git when auto-detection finds multiple candidates

## Required behavior

1. Validate a writable project path and detect cloud-sync path markers.
2. If cloud-synced, warn that all files must be kept offline/local and require explicit confirmation; never assert it can fully verify every provider’s sync state.
3. Detect Git, Python, and Node.js; report their exact resolved paths and versions.
4. Check project files required by the current phase and verify their readable contents/hashes.
5. Initialize Git only after explicit approval, creating no commit unless the user separately requests it.
6. Create only missing, approved skeleton directories/files; never replace existing content without a separate explicit confirmation.
7. Run non-destructive smoke checks appropriate to the implemented phase (for Step 1: document integrity and tool discovery; later: backend/frontend tests).
8. Produce a timestamped machine-readable and human-readable diagnostic report under a local ignored diagnostics path.
9. Exit nonzero on failed required checks and print actionable remediation.

## Idempotence contract

Each operation has one of: `CREATED`, `VERIFIED`, `SKIPPED`, `WARNING`, `FAILED`. Re-running produces `VERIFIED`/`SKIPPED` for correct existing state. It must not reset configuration, delete directories, change execution policy, download installers, or modify system-wide PATH.

## Safety constraints

- Do not install packages automatically. Offer commands/instructions only.
- Do not run with administrator privilege by default.
- Do not create symlinks, change MT5 configuration, or touch a broker terminal.
- Do not store secrets, account credentials, or raw trading reports in diagnostics.
- Treat paths with spaces and non-ASCII characters as normal test cases.

## Smoke-test evidence

The report records tool versions, resolved paths, workspace write/read check, Git status (if present), document-package validation result, and the exact command/result of each check. A passing process exit code alone is not sufficient where a domain-specific result/log/artifact exists.

## Future extensions (not approved)

Python virtual environment/dependency setup, frontend package installation, local database initialization, fixture download, and optional MT5 export-location discovery may be added only with a versioned implementation plan and updated safety review.
