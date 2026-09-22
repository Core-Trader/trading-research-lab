# Milestone 0 — Live Acceptance Evidence

**Date:** 2026-09-20  
**Status:** Happy-path acceptance passed; formal spike closure remains in progress.

## Confirmed live path

The user manually loaded the development plugin in the disposable vault at
`C:\DEV\vaults\TRL-Dev-Vault` and ran the approved source report:

`C:\DEV\Trading_Research_Lab\data\raw\EURUSD_2025.xlsx`

The local worker completed the run and generated:

`C:\DEV\vaults\TRL-Dev-Vault\Trading Research Lab\M0\EURUSD_2025 - M0 Analysis.md`

The output retained the source dataset identity
`mt5:63E3D6C6737E577F1EF6335E731E74A305BCA9060D420592241F4E66DC90A523`.
It reported opening balance `15000.0`, final reported balance `15166.99`, balance
change `166.99`, and 60 closing deal events. It correctly qualified intratrade
equity as unavailable instead of reconstructing it from balance-only data.

## Independent checks after the live run

- The generated Markdown is valid UTF-8 with zero replacement characters.
- It has one analysis-run line and exactly one valid bounded generated section.
- A live worker capabilities request returned protocol `1` and the expected
  versioned methods.
- A deliberate unknown method returned the structured protocol error
  `E_METHOD_UNKNOWN`.
- The TypeScript check and production plugin bundle passed.

## Deliberately not overstated

This is not full M0 sign-off. The acceptance record still requires an
outside-marker user-text preservation rerun, a manual worker restart check,
automated-test dependency approval and coverage, and baseline measurements.
These are listed in `internal/docs/MILESTONE_0_EXECUTION_STATUS.md`.

## Manual review required

Before marking M0 closed, the project owner must perform the two Obsidian checks
listed in the execution-status document and review the recorded baseline
measurements. Do not use a personal production vault for these checks.
