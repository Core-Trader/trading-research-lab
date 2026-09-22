# Development Log

This log records meaningful work in chronological order. It is intentionally factual: objective, actions, evidence, issues, and next step.

## 2026-09-20 — Step 1: Context and Specification Package

### Objective

Create the authoritative documentation package before application implementation.

### Decisions captured

- Local-first browser application; Python backend, React/TypeScript frontend, SQLite for V1.
- MT5 import and deterministic shared-account replay are the first technical proof point.
- OneDrive/Google Drive are supported only with full offline availability; a non-synchronised local working directory remains preferred.
- Daily drawdown is a versioned policy, not a universally defined metric.
- No application code is approved in Step 1.

### Reference material used

Uploaded MQL5 setup scripts/manuals were used only for generalized setup lessons: actual-path discovery, portable-install awareness, idempotent setup, offline-file caution, smoke testing, and log/artifact verification. Notes do not reproduce or rely on unverified claims beyond those sources.

### Evidence

Created `README.md`, `CLAUDE.md`, documentation specifications, journal templates, reference notes, and the environment-tool specification.

### Next step

Select 1–3 representative MT5 export files and explicitly decide the initial account currency, opening balance, daily-drawdown timezone/reset time/baseline, and desired supported export layout.

## 2026-09-20 — Step 2: Source Data Intake Started

### Objective

Prepare a reviewable, reproducible intake process for the real MT5 exports that will define the first importer and replay baseline.

### What was added

Created `docs/10_STEP_2_SOURCE_DATA_INTAKE.md`. It lists the owner-only manual review points: export selection, confidentiality/retention, account assumptions, daily-drawdown definition, and source reference totals.

### Why manual review is required

The source export’s provenance, confidentiality, report labels, and intended risk policy cannot be inferred safely by an implementation agent. These choices control whether later reconciliation and daily-risk results are meaningful.

### Next step

Owner completes the Step 2 checklist and supplies approved copies of 1–3 representative export files. Then proceed to Step 3: a narrow importer specification and implementation plan.

## 2026-09-20 — Project Root Path Corrected

### Change

Moved the documentation package to the approved project root `C:\DEV\Trading_Research_Lab`.

### Intake location

Created `C:\DEV\Trading_Research_Lab\data\raw\` for approved copies of representative MT5 exports. This directory is ignored by the project’s Git rules to reduce the risk of committing proprietary trading data.

## 2026-09-20 — Step 2: MT5 Excel Baseline Captured

### Evidence reviewed

Read-only inspection confirmed three MT5 Strategy Tester Excel reports in `data\raw`: CADCHF, EURUSD, and GBPUSD. Each uses the same one-sheet Settings/Results/Orders/Deals layout, a USD 15,000.00 initial deposit, 1:1000 leverage, and the EA_DCA_CENT_V1 expert label. SHA-256 identities and source summary totals are recorded in `docs/11_BASELINE_INPUT_MANIFEST.md`.

### Environment evidence

Verified the owner-supplied portable terminal layout at `C:\RoboForex MT5 Terminal\`, including `terminal64.exe`, `metaeditor64.exe`, and `MQL5\`. The recorded launch form is `terminal64.exe /portable`.

### Specification correction

Changed net-realised-P/L semantics to source-signed components after observing a negative swap reduce the reported deal’s balance change. This is recorded as DL-004 and requires a regression test before implementation.

### Manual review still required

Timezone/daily-reset policy, report-retention approval, and the initial single-fixture choice remain owner decisions. See the manual-review section of the baseline manifest.

## 2026-09-20 — Step 2: USDJPY and Optimizer Reports Reviewed

### Evidence reviewed

Read-only review added USDJPY Strategy Tester and multi-symbol optimizer reference evidence. USDJPY deal prices use a three-decimal source display format. The optimizer XML contains seven summary rows and no event-level replay data.

### Owner approvals recorded

Approved: local retention of the reports, baseline USD 15,000.00/1:1000, EURUSD as first reconciliation fixture, and the source baseline totals. Daily drawdown is deferred pending a separate approved policy.

### Scope result

Step 3 remains a read-only EURUSD Excel Deals importer with cash-reconciliation tests. USDJPY is a required precision regression fixture after that baseline passes. The optimizer report remains reference-only.

### Manual review still open

Confirm whether the optimizer’s seven rows represent the complete intended Market Watch universe, whether individual reports for USDCHF/USDCAD/AUDUSD are required later, and whether optimizer-summary import is needed after replay validation.

### Tooling review

GitHub was recommended as an optional future connection for remote repository, issue, pull-request, and CI workflows. It has not been connected and is not required for Step 3. No other external plugin is currently justified because all source data, documentation, and planned implementation are local-first.

## 2026-09-20 — Step 3: Initial EURUSD Deals Importer

### Implementation

Created a read-only Python package using `openpyxl` for the observed MT5 Excel report layout. It captures source hash/size, required Settings, strict Deals headers, source-signed cash components, and source price-scale metadata. Synthetic tests cover signed cash, three-decimal JPY precision, and unsupported-header rejection.

### Verification

Synthetic tests passed. EURUSD imported with the approved SHA-256, USD 15,000.00 opening balance, 121 raw Deals-table rows (one initial balance row plus 120 trading deals), and 166.99 net trading cash change, matching the source-reported net profit. USDJPY imported with 153 raw rows (one balance row plus 152 trading deals) and 244.92 net trading cash change.

### Scope boundary

No raw report was modified. No database, browser UI, replay engine, optimizer import, daily-drawdown output, MT5 automation, Git repository, remote repository, or plugin connection was created.

### Manual review required

Review the Step 3 code and EURUSD result against the source report before approving any next scope. Git initialization and optional GitHub connection remain owner decisions.

## 2026-09-20 — FTMO Reference Daily-Loss Policy Defined

### Decision

The owner selected FTMO timing semantics as the initial daily-risk reference. The calculation clock is Prague time with a midnight reset; Lisbon is a display timezone only. The policy is documented as `ftmo-reference-daily-loss-v0.1`.

### Important limitation

The current RoboForex reports do not label timestamp timezone. The policy is therefore defined but cannot yet produce a daily-loss result. The owner must confirm source server-time/DST mapping before implementation or calculation.

### Manual review required

When prop-firm simulation begins, confirm the account-specific FTMO rule version/allowance and manually inspect a sample conversion from source terminal time to Prague and Lisbon time.

## 2026-09-20 — Broker-Native and Prop-Firm Analysis Separated

### Decision

Broker-native account analysis is now the default. Prop-firm daily/overall-loss rules are optional scenario overlays. The initial RoboForex reference profile records EET UTC+2 with daylight-saving changes as user-confirmed source-time evidence.

### FTMO reference overlay

The FTMO 2-Step Swing reference overlay records 5% Maximum Daily Loss, 10% static Maximum Loss, and equity-based measurement including floating P/L, swaps, and commissions. It remains a reference until a specific account/rule version is selected.

### Manual review required

Before calendar-based policy calculations, verify the broker server’s historical timezone/transition schedule for the report dates. Do not treat a shared EET offset as proof of a particular IANA timezone.

## 2026-09-20 — RoboForex Time Profile and Future Policy Panel Defined

### Source-time profile

Recorded `roboforex-eet-eest-v0.1` for current Forex reports: UTC+2 standard time and UTC+3 summer time. Daylight-saving conversion must be date-aware. Temporary US/Europe transition effects are retained as US-asset session-schedule exceptions, not a server-clock change.

### Future prop-firm UX

Confirmed that prop-firm rules will be implemented later through a configuration panel used for analysis. The panel will attach an optional versioned overlay to a replay scenario and will not alter broker-native results.

## 2026-09-20 — Step 4: MT5 Deal Event Normalisation

### Implementation

Added a deterministic canonical-event layer over the existing read-only MT5
Deals importer. It maps the observed `balance`, Buy/Sell, and In/Out vocabulary
to `OPENING_BALANCE`, `POSITION_OPEN`, and `POSITION_CLOSE`, preserving source
identity, timestamp text, broker time-profile provenance, cash components,
balance, and price precision.

### Explicit boundaries

The layer does not pair entries and exits into trades or positions, convert
timestamps to UTC, calculate risk, or replay the account. Unsupported source
vocabulary fails explicitly rather than being interpreted by assumption.

### Verification

All six importer and normalisation tests pass. Read-only normalisation preserved
the approved source hashes and produced one opening event plus matched open/close
counts for every current report: CADCHF 1/83/83, EURUSD 1/60/60, GBPUSD
1/64/64, and USDJPY 1/76/76. Their source-signed trading cash totals remain
209.33, 166.99, 213.89, and 244.92 respectively.

### Manual review required

Review the mapping and a small sample of EURUSD/USDJPY source lines before
authorising time conversion, trade pairing, or replay work. Confirm that the
current RoboForex time profile remains provenance only at this stage.

### Owner review outcome

The owner approved the event mapping, the event-level `In`/`Out` interpretation,
and the decision to keep the RoboForex time profile as provenance only. The
separate decision to pair events into Trade/Position entities remains pending a
verified account-mode and position-identifier evidence package.

## 2026-09-20 — Position Pairing Evidence Approach Defined

The owner declared the current account mode as hedging. Regular MT5 Excel
reports remain the application's normal working input. A future test-only
Position Audit Exporter will validate pairing against MT5 position identifiers;
it will not be required for normal user imports and will not modify the original
strategy EA. See `docs/18_POSITION_PAIRING_EVIDENCE_PLAN.md`.

## 2026-09-20 — Frozen EA Source Assessed Read-Only

Read `EA_DCA_CENT_V1.mq5` from the portable RoboForex terminal without changing,
compiling, or executing it. The source SHA-256 and assessment are recorded in
the position-pairing evidence plan. It already checks for hedging mode and uses
`DEAL_POSITION_ID` for internal sequence tracking, but exports no forensic audit
artifact. Its frozen-baseline governance prohibits an in-place audit edit.

## 2026-09-20 — Forensic-Copy Authority Pre-Approved

The owner approved creation of a separately named forensic copy at the later
pairing milestone and approved compiling/running it only through the portable
RoboForex MT5 terminal. No forensic copy or export has been created yet; schema,
redaction, storage, and inferred-result UX review remain required first.

## 2026-09-20 — Review Specifications Prepared

Created separate proposed documents for the forensic audit artifact schema and
privacy profile, and for the required user-facing treatment of inferred trade
pairings. They are review material only; no forensic EA, exporter, pairing
algorithm, or UI code was created.

## 2026-09-20 — Forensic Schema and Inferred-UX Reviews Approved

The owner approved the forensic local-storage location, `OMITTED` comment
privacy default, approved local identifiers/metadata, and hash binding to the
regular report. The owner also approved the proposed quality statuses and their
warning text, with inferred results permitted in headline summaries only when
their quality status and breakdown remain visible.

## 2026-09-20 — MT5 Forensic-Output Staging Constraint Identified

Official MT5 file handling restricts tester code to a file sandbox, so a
forensic exporter cannot write directly to the approved project raw-data path.
The proposed safe workflow writes into an MT5 `FILE_COMMON` staging subfolder,
then uses explicit local-app intake into `data/raw/forensic/`. This requires
owner approval before the forensic exporter is created.

## 2026-09-20 — MT5 Forensic-Output Staging Approved

The owner approved `FILE_COMMON\TradingResearchLab\forensic\` as temporary
MT5 tester-output staging. The retained project location remains
`data/raw/forensic/`; any later intake must hash-copy selected artifacts without
modifying the staging source.

## 2026-09-20 — Step 5: Forensic Position Audit Exporter

### Implementation

Created the separately named forensic EA copy and its audit-only include in the
portable RoboForex terminal. The frozen source remains unchanged with SHA-256
`C1B3E0002D3B2A1B313F0C7A3B4E85948B71993C4662ACEC6D8885B8A74D7237`.
The forensic source SHA-256 is
`E073ADCC0F96822D5E8201840FDE9AA7865A9D43660BB43972F3BFE2CFF77764`.

Added the read-only Python audit validator and deterministic report-binding
function. It rejects schema/hash/privacy violations and only creates a
`VERIFIED_TEST_RUN` binding for a matching hedging audit and ordinary report.

### Verification

MetaEditor compiled the forensic copy in the approved portable environment with
0 errors and 0 warnings. All 9 Python regression tests pass, and the audit
validator command is available through `python -m
trading_research_lab.forensic_audit`.

### Manual review required

No Strategy Tester run was launched because the exact source configuration and
unique run ID are owner-controlled. Follow the single-run checklist in
`docs/21_STEP_5_FORENSIC_AUDIT_IMPLEMENTATION.md`, then review the generated
artifacts and binding output before authorising the pairing-policy milestone.
