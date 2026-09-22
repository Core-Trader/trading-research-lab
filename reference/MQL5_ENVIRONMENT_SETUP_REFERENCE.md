# MQL5 Environment Setup Reference Notes

## Source boundary

These are distilled design lessons from the uploaded Windows/MQL5 setup scripts and manuals. They are not copied scripts, universal MetaTrader claims, or instructions to modify an MT5 installation from this project.

## Observed reusable lessons

- Detect real tool paths and validate required executables/files rather than assuming the standard installation layout.
- Treat portable/broker MT5 installations as a distinct supported layout: their program and data locations may coincide.
- Make setup idempotent: re-running should report and preserve already-correct state instead of overwriting it.
- A cloud-synced project can cause problems when files are placeholders rather than fully local. Prefer a local working directory; if OneDrive/Google Drive is used, require offline availability.
- Git is the version-history safety net; cloud sync is not version control.
- Validate tool outcomes from their own logs and expected artifacts, not just a process exit code. The supplied material specifically treats MetaEditor exit status as insufficient for compile verification.
- Establish a small smoke test before doing substantive work.
- When results unexpectedly vary, reduce to a minimal controlled reproduction and verify one assumption at a time.

## MT5-specific cautions retained for later importer work

- The meaning and availability of exported data depend on terminal/build/report format and account mode; detect rather than assume.
- Portable and non-portable command-line configurations require different paths.
- Hedging versus netting semantics affect whether apparent simultaneous/opposite positions are independent; do not infer a portfolio model from tickets alone.

## What this project adopts

The future Trading Research Lab setup tool will inherit detection, idempotence, diagnostics, offline checks, and smoke-test principles. It will not create MT5 symlinks or compile MQL5 code unless a later approved scope explicitly requires that.
