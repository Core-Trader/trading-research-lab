# Reusable prompt: MVP completion session

Paste everything below the line into a new Claude session working in
`C:\DEV\Trading_Research_Lab`. It narrows the general handoff to the work that
finishes the MVP. Written 2026-09-25.

---

You are finishing the Trading Research Lab (TRL) MVP.

## 0. Start with the general handoff

Read `internal/prompts/SESSION_HANDOFF.md` and follow all of it:
- the orientation order
- the git and push rules
- the working method
- the sourcing rule
- the MT5 safety rules
- privacy
- writing for the owner

Everything below is additional and specific to the MVP.

## 1. MVP sources (read after the general orientation)

- `internal/docs/MVP_FAST_TRACK.md`: the MVP scope and sequence (MVP-A to
  MVP-D, MVP-P).
- `internal/docs/MVP_OWNER_REVIEW_CHECKLIST.md`: the owner's visual review
  (MVP-C).
- `internal/docs/MVP_D_RELEASE_READINESS.md`: the release tooling, pending
  decisions R-D1 to R-D4, and "Not yet done".
- `scripts/build_release.py` and `scripts/tests/`: the release allowlist
  builder and its checks.
- `product-docs/`: the user help that ships with a release.

## 2. Reconcile the MVP status first (propose; do not edit until confirmed)

`MVP_FAST_TRACK.md`'s status section is dated 2026-09-23, and later work has
changed it. Check these against `internal/docs/DECISION_LOG.md` and the code,
then propose status updates to the owner:

- **Drag/drop and saved layouts** are listed as "DEFERRED — POST-MVP", but
  customisable layouts were built with the owner's approval (LAYOUT-1).
- **Margin claims and prop-firm checks** are listed as deferred, but the
  prop-firm check (PROP-1 to PROP-4) and the combined margin level (EQP-1)
  were built.
- **Tier C:** C1 and C2 (performance metrics, R-multiples/SQN) are
  implemented according to the handoff.
- **Since 2026-09-23:**
  - significance (SIG-1)
  - bootstrap Monte Carlo (BOOT-1)
  - combined equity (EQP-1)
  - costs (COST-1)
  - execution costs (EXEC-1)
  - windows (WIN-1)
  - symbol scan (SWEEP-1 to SWEEP-3)
  - research notes (NOTES-1, NOTES-2)
  - plain language (UIX-5)
  - hideable guidance (GUIDE-1)
  - reopening the last report (SESSION-1)
  - Decide with the owner whether each is part of the MVP release or a
    qualified extra.
- **Owner review checklist:**
  - `MVP_OWNER_REVIEW_CHECKLIST.md` covers only Portfolio and Parameters
  - its step B8 still describes the old single `TRL:CHOICE` block; since
    NOTES-2, each kind of check has its own `TRL:RECORD` block
  - propose an updated checklist that also covers the features listed above

## 3. MVP-C: usability from the owner's review

- The owner is reviewing the plugin in Obsidian and will bring UI and UX
  notes. Take them one by one:
  - restate each note
  - fix it with the smallest change that follows the existing design
    patterns (tokens in `plugin/styles.css`, `KpiTile`, `ChartFrame`,
    `GuidanceBlock` or `Interpretation`, `plain()`)
  - test it
- Check narrow widths (320–400 px), light and dark themes, and keyboard use.
- Verify what you can in the harness, and state what still needs the owner in
  Obsidian.
- **Harness:**
  - it currently lives only in the previous session's scratchpad
    (`C:\Users\vasco\AppData\Local\Temp\claude\C--DEV-Trading-Research-Lab\5a6f0dc1-4e0c-41dc-bcc9-7ab1d35ffd22\scratchpad\harness`,
    which may have been cleaned)
  - `.claude/launch.json` points there
  - propose moving it into the repository (for example `plugin/harness/`,
    with relative imports and a launch configuration in the repository)
  - **never commit fixtures built from the owner's real reports** (for
    example `costs.json`, `execcost.json`, `sig.json`); regenerate fixtures
    from the synthetic test data instead
  - move it only after the owner agrees

## 4. MVP-D: release readiness

1. Present the pending decisions R-D1 to R-D4 (licence, how users get
   Python, third-party notices, distribution channel) with the document's
   recommendations. Wait for the owner's choices.
2. Re-run the release build and its tests:
   - check that every `product-docs/*.md` is included:
     - `EQUITY_LOGGER.md`
     - `INSTALL.md`
     - `MT5_EXPORT_GUIDE.md`
     - `OPTIMISATION_CHECKLIST.md`
     - `PROP_FIRM_CHECK.md`
     - `README.md`
     - `RESEARCH_WORKFLOW.md`
   - check that nothing private is included (`internal/`, journals, handoffs,
     data, `.trl-*`, vaults)
   - check that the private-reference check passes
3. After R-D2, generate the release third-party notices from the lockfiles
   (R-D3).
4. Propose a versioning policy (today the version is `0.0.1` in
   `manifest.json`, `package.json`, and `pyproject.toml`).
5. **Install check:**
   - a clean-machine check that follows `INSTALL.md` literally needs the
     owner or a clean VM
   - write the steps, and do not claim it was done
   - macOS and Linux are unverified; say so
6. Update `MVP_D_RELEASE_READINESS.md`, `ROADMAP.md`, `DECISION_LOG.md`, and
   `CURRENT_HANDOFF.md` as items close.

## 5. Out of scope for this session (unless the owner asks)

- **Future or deferred features:**
  - live drift monitoring (LIVE-1)
  - the research checklist (CHECK-1)
  - accumulated-commission and reversal-deal import (C6)
  - demo and live statement import
  - rolling walk-forward optimisation
- **Anything excluded by the locked rules:** telemetry, accounts, network
  features, and Obsidian community-store publishing (R-D4 recommends a
  private zip).

## 6. Definition of done for the MVP

- The owner's review notes are resolved, or recorded as deferred with the
  owner's agreement.
- `MVP_FAST_TRACK.md` and `ROADMAP.md` state the true status.
- R-D1 to R-D4 are decided and recorded.
- The release folder builds `READY` with the full help set and no private
  material, and the notices are included.
- Both test suites and the build pass.
- The handoff is updated; everything is committed and pushed, with the hash
  reported.
