---
project: Trading Research Lab
status: active
current_milestone: Milestone 6 — Advanced Research (fixed-cost What-If, Monte Carlo, optimisation, and paired forward evidence accepted; automatic selection is deferred)
last_updated: 2026-09-24
primary_repo: C:\DEV\Trading_Research_Lab
dev_vault: C:\DEV\vaults\TRL-Dev-Vault
python: 3.14.7
node: 24.21.0
handoff_version: 1
---

# Current Operational Handoff

> **Source-of-truth rule:** This is an operational snapshot, not the source of
> truth for architecture or specifications. If it conflicts with an approved ADR
> or authoritative project specification, the ADR/specification takes precedence.

## Project status

The locked Obsidian Desktop + local Python Research Core architecture is active.
Milestone 0 is closed with documented non-blocking deferred validation risks.
Milestone 1 is closed with owner-confirmed development-vault validation and
automated normal, duplicate, invalid, ambiguous, modified-source, and tampered-
snapshot coverage. Milestone 2 is closed with owner-confirmed manual validation.
Milestone 3 is closed with owner-confirmed manual validation. Milestone 4 is
closed with owner-confirmed manual validation and a closure report. Milestone 5
is closed with owner-confirmed panel validation and a closure report. Milestone
6's bounded fixed-cost What-If, deterministic Monte Carlo order-permutation,
single-grid optimisation evidence, and paired forward evidence slices are accepted.
Automatic selection and other M6 workstreams remain deferred.

## Current milestone

**Milestone 6 — Advanced Research.** **Status:** In progress; the fixed-cost
What-If, Monte Carlo order-permutation, single-grid optimisation evidence, and
paired forward evidence slices are accepted. MVP dashboard workspace work is
active: import automatically populates safe Overview cards without creating
Markdown, while technical evidence stays under Data & import. The plugin view
is now modularised behind a typed application service (MVP-B/C hardening);
see `internal/development-journal/2026-09-22-mvp-view-modularisation.md`.
The
authoritative milestone order, classification, and status are in
[`internal/docs/ROADMAP.md`](../docs/ROADMAP.md), not this operational snapshot.

## Just completed

- The local M0 diagnostics panel was built, compiled, and manually displayed;
  it measures local worker readiness, import, analysis, report, note-write,
  presentation, and total time without altering analytical data.
- The owner confirmed the M0 manual checks and the Browse-based `.xlsx` selection
  workflow work in Obsidian.
- Canonical schema `1.1` replaced time-based canonical identifiers with stable
  source-derived UUIDv5 identities; a fresh-workspace byte-stability regression
  test passes.
- The Python test development extra (`pytest 9.1.1`) and plugin generated-note
  safety tests were added and passed.
- Journalit and Strategy Factory were pinned and reviewed outside the TRL tree.
  Their developer/owners later approved direct reuse subject to mandatory
  provenance tracking and a final usage report; no external code is currently
  recorded as used.
- Milestone 0 was formally closed with an architecture-spike report and deferred
  risks recorded.
- The owner approved M1 raw retention, local-path privacy, evidence fields,
  registry boundary, fixture policy, acceptance criteria, and scope boundary.
- M1 baseline code adds SHA-verified managed raw snapshots, deterministic
  registry receipts, evidence retrieval/verification methods, and plugin
  evidence controls. The Core test suite has 10 passing tests; plugin tests (2)
  and build pass.
- Milestone 1 is formally closed. The closure report records owner-confirmed
  source preservation, intake/reuse/refresh/verification evidence UI, and the
  full automated fixture coverage.
- M2 now provides separate source-verified close-event analysis and optional
  `INFERRED` declared-hedging FIFO lifecycle analysis. Core and plugin builds
  pass; the owner accepted the representative-report review and M2 is closed.

## In progress

M4 is closed. The owner manually validated explicit strategy, experiment, and
report creation/reuse; bounded generated-content safety; warning and
changed-only regeneration; malformed-marker blocking; and `NO_CHANGES_DETECTED`
recovery. M5 now provides bounded, evidence-qualified sequential
same-account realised-balance analysis across a user-selected batch of MT5
Excel reports and is formally closed after owner panel validation.

## Next exact task

The owner accepted the MVP dashboard review "for now" on 2026-09-22 (Monte Carlo
histogram and the modularisation changes included). Dashboard/UX reference
research is recorded in `internal/references/DASHBOARD_UX_RESEARCH.md`.

Tiers A and B are implemented: KPI tiles, readable balance chart, and card
states (A); and Core `analysis.close_event_display_series`, P/L bars, daily
calendar, monthly table, and Monte Carlo v3 percentile table and path fan (B).
See `internal/development-journal/2026-09-22-mvp-dashboard-tier-{a,b}.md`.
**Owner action:** reload the plugin, import a real report, and review Overview
and Advanced → Monte Carlo (dark and light theme). Tier C1 performance
metrics are implemented (defaults D1–D7 accepted); see
`internal/development-journal/2026-09-22-mvp-tier-c1-performance-metrics.md`.
Tier C2 (Van Tharp R-multiples, SQN) is implemented and the sequential
batch panel was reworked after the feedback analysis; see
`internal/development-journal/2026-09-22-batch-feedback-and-van-tharp.md`.
**Owner clarified the multi-import intent (2026-09-22):** concurrent
portfolio combinations of EA backtests (return vs drawdown over active
periods), later checked against prop-firm rules. See
`internal/docs/PORTFOLIO_LAB_RECOMMENDATION.md`. R1–R6 were accepted
as PL-001–PL-006. **Portfolio Lab slice 1 (Core `portfolio.combine`) is done**;
see `internal/development-journal/2026-09-22-portfolio-lab-slice-1.md`.
Slice 2 (plugin Portfolio section) is done; owner review in Obsidian is
pending. Parameter exploration architecture approved (PX-001–PX-007). **Build step 1
(shared Pareto core `pareto.py` + `TradeOffScatter`) is done**; see
`internal/development-journal/2026-09-23-shared-pareto-and-scatter.md`.
Build step 2 (Portfolio Lab slices 3–4: saved combinations, comparison
scatter, and `portfolio.explore`) is done. **Owner review in Obsidian is
pending** for the whole Portfolio page. Build steps 3–4 (parameter exploration Core and the Parameters page) are
done; see `internal/development-journal/2026-09-23-parameter-exploration-mvp.md`.
**Owner review in Obsidian is pending** for the Portfolio and Parameters
pages. Step 6 follow-ups are done: single-test attach (untested default) and
forward (out-of-sample) pairing with forward axes, hover lines, and compare
rows; see `internal/development-journal/2026-09-23-forward-pairing.md`.
Independent MVP work done on 2026-09-23 (see
`internal/development-journal/2026-09-23-mvp-c-d-hardening.md`):
- saved combinations persist as setups that the Core recalculates (PL-007)
- narrow-width fixes (MVP-C)
- the release allowlist tool and check (`scripts/build_release.py`), product
  help in `product-docs/`, and a release-folder worker smoke check (MVP-D)
The owner review passed on 2026-09-23. Tracks are now numbered and the
stagnation band has a legend. Multi-XML studies (PX-008), the release
decisions R-D1 to R-D4, and the clean-machine install check are deferred.
Neighbourhood analysis (PX-010, N1–N7) is implemented; see
`internal/development-journal/2026-09-23-neighbourhood-analysis.md`.
The equity logger (PL-006/PL-008) is built and validated in MT5; see
`internal/development-journal/2026-09-23-equity-logger.md`. Logger 1.0.1 has
0 link mismatches on V1–V3, and the owner's DCA EA shows equity drawdown
12.5× balance drawdown. The UI/UX pass (UIX-1) is implemented (revert tag `plugin-pre-uiux-pass`); see
`internal/development-journal/2026-09-24-ui-ux-pass.md`. Follow-up UI fixes (sidebar
alignment, bar hover, fan paths) are in commit 4db1a65. The prop-firm check
(PROP-1, P1–P10 accepted) is built: Core `day_boundary.py` and `prop_check.py`
(`prop.*` methods, `tzdata` dependency) and the plugin **Prop-firm check** page.
The display precision policy (UIX-2: 2–5 decimals by relevance) is applied
across the plugin. See `internal/development-journal/2026-09-24-prop-firm-check.md`.
**Next:** the owner reviews the Prop-firm check page in Obsidian:
1. Re-attach the DCA V3 equity log in the dev vault. Its registry entry lost
   its `equity` block, although the log files remain.
2. Create a profile with your firm's numbers.
3. Check the logged report, and a saved combination.
4. Try a firm reset time with the report-clock zone `Europe/Athens`.

Since then:
- FTMO presets and profile options (PROP-2)
- the Parameters tooltip with the key results
- rolling start dates (P8)

See the follow-up section of the same journal entry.
An autonomous session on the same day (see
`internal/development-journal/2026-09-24-autonomous-session.md`) added:
- chained phases
- quick actions
- FundedNext presets
- the P1–P3 prop corpus in MT5 (the RoboForex terminal was closed with the
  owner's authorisation; it may need restarting)
- the worker-client restart-race fix, with a real-worker integration test
- worker memory measurements

The Help page now has a **Research workflow** guide (DOC-001; `product-docs/RESEARCH_WORKFLOW.md` is generated from `plugin/src/components/help/research-workflow.ts`). Its 9-item gaps list is the owner's next topic; symbol-sweep import comes first. Note: TRL has never imported MT5 symbol-sweep XML. The older 7-row sweep export is deliberately rejected, per the M6 optimisation decision package.
**Next:** the owner reviews in Obsidian:
1. Re-attach the DCA V3 equity log.
2. Prop-firm check with FTMO and FundedNext presets, and the report-clock
   zone `Europe/Athens`.
3. Rolling starts, and a 2-phase chain (the P1–P3 corpus reports make good
   test cases).
4. The sidebar and saved-combination quick actions.
5. The Parameters tooltip. The navigation sidebar (NAV-1–3) and the Help &
downloads page (HELP-001) are built. **Revert point:** tag `plugin-pre-nav-sidebar`, plus the built-file
backup and steps in `C:\DEV\TRL_Plugin_Backups\2026-09-23_pre-nav-sidebar\HOW_TO_REVERT.md`.
The Data page is redesigned (UX-002): validate first, then companions (equity
log, `.set` check), then analyse; all charts have Expand. **Next:** owner review of
the new Data page and the Analysis-page equity
panel, then the prop-firm rules module, including Portfolio Lab's
conservative combined equity low (E6). The first MT5 test corpus is built (DEV-002); see
`internal/development-journal/2026-09-23-test-corpus-and-bias-fixes.md`. It
fixed three parser biases (the `Inp` prefix, spaced EA names, and built-in
forward). Run `scripts/corpus_check.py` after importer changes. Permanent
report deletion (DS-003) and dismissible messages (UX-001) are done. Playbook §3.1 is corrected: in Git
Bash, `ps aux` cannot see desktop-launched terminals; use `ps -W` or
`Get-Process`. Report archive (DS-001) and MT5 HTML import (DS-002) are done; see
`internal/development-journal/2026-09-23-archive-and-html-import.md`.
**Next exact task:** the owner reviews in Obsidian:
- archive and restore in the Portfolio report library
- importing an MT5 `.html` report
- the Neighbourhood panel, as follows:
1. Select a frontier pass and check the coverage, statistics, and map.
2. Save a neighbourhood `.set`.
3. Optionally run it in MT5 with the "Slow complete algorithm" and attach
   the XML.
After that, the remaining deferred items are the release decisions R-D1 to
R-D4, multi-XML studies, and the equity-logger spec (PL-006) before the
prop-firm module. V2/V3 visuals remain on hold.

Use `MILESTONE_6_PAIRED_EVIDENCE_COLLECTION_PROTOCOL.md` only when collecting
future like-for-like optimisation/forward pairs. Automatic selection,
robustness scoring, composite scores or verdicts, money-management, and broad
aggregation remain deferred. Do not implement them without a separately
approved package.

## Open issues / blockers

- Peak Python-worker memory, deliberate crash recovery, portable-terminal
  automation, and broader cross-process integration coverage are documented
  non-blocking M0 deferrals; they require later validation, not M1 scope creep.
- Git initialised 2026-09-22 on branch `main` (initial commit `25fa5fa`); no
  remote is configured. Worker workspaces (`.trl-*/`) hold real MT5 report
  snapshots and are git-ignored. Commit author email is the placeholder
  `you@example.com` from global Git config.
- External code reuse from Journalit and Strategy Factory is permitted subject
  to mandatory provenance tracking and a final usage report. See
  `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md`.
- Product licence/ownership model, publishable fixture policy, and final Free/Pro
  capability matrix remain owner decisions before public distribution.
- M5 is closed. Broader portfolio aggregation/replay metrics and automatic
  research documents remain outside its closed scope.

## Recent decisions

- Canonical research identities must be deterministic; see `ADR-012` and
  `internal/development-journal/2026-09-20-deterministic-canonical-identities.md`.
- M0 diagnostics are local, non-financial, non-persistent observations; see
  `internal/development-journal/2026-09-20-local-run-diagnostics.md`.
- Journalit and Strategy Factory direct reuse is approved subject to mandatory
  provenance tracking and final reporting; see
  `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md`.
- The completed pinned reference review makes no change to M0, current M2,
  storage, IPC, testing, entitlement, or locked architecture decisions. See
  `internal/references/TRL_REFERENCE_FINDINGS.md`.

## Important paths

| Purpose | Path | State |
| --- | --- | --- |
| Repository | `C:\DEV\Trading_Research_Lab` | Exists; Git `main`, local only (no remote). |
| Disposable development vault | `C:\DEV\vaults\TRL-Dev-Vault` | Exists. |
| Plugin source | `C:\DEV\Trading_Research_Lab\plugin` | Exists. |
| Research Core | `C:\DEV\Trading_Research_Lab\research-core` | Exists. |
| Python virtual environment | `C:\DEV\Trading_Research_Lab\research-core\.venv` | Exists and operational. |
| Plugin junction in vault | `C:\DEV\vaults\TRL-Dev-Vault\.obsidian\plugins\trading-research-lab` | Exists and operational. |
| External-reference clone root | `C:\DEV\TRL_External_References` | Exists; Journalit and Strategy Factory pinned and clean; approved reuse requires provenance tracking. |

## Environment state

- Python `3.14.7`; editable `trading_research_core` import verified.
- `openpyxl 3.1.5`, `pyarrow 25.0.1`, and test-only `pytest 9.1.1` import
  successfully in `research-core/.venv`.
- Node.js `24.21.0`; npm `11.19.0`; Git `2.55.0.windows.3`.
- Obsidian Desktop has manually loaded and used the development plugin.
- The plugin build and development-vault junction are operational.

## Commands to continue

```powershell
Set-Location C:\DEV\Trading_Research_Lab
.\scripts\setup-dev-environment.ps1

Set-Location C:\DEV\Trading_Research_Lab\research-core
.\.venv\Scripts\python.exe -m pytest

Set-Location C:\DEV\Trading_Research_Lab\plugin
& 'C:\Program Files\nodejs\npm.cmd' test
& 'C:\Program Files\nodejs\npm.cmd' run build
```

## Tests / validation status

| Area | Status | Evidence / limit |
| --- | --- | --- |
| Environment | Pass | Python/Node/npm/Git versions and core imports verified on 2026-09-20. |
| Research Core unit tests | Pass | 259 `pytest` tests passed on 2026-09-24 (plus chains, FundedNext presets, reset-spanning intervals) (prop check F1–F9, FTMO presets and examples, rolling starts, day boundary) (plus 4 release-script tests in `scripts/tests`), including MT5 HTML import, report archive, neighbourhood analysis, saved-combination persistence, parameter exploration (single tests, forward pairing), including Portfolio explore = combine per subset, including shared Pareto (brute-force cross-checked), Portfolio Lab P1–P16, R-multiple R1–R8, performance metrics F1–F13, display series, and Monte Carlo v3; earlier coverage includes M0/M1 coverage plus M2 FIFO, partial-allocation, quality, account-mode, deterministic-artifact, and worker-IPC cases. |
| Plugin automated tests | Pass | 93 Node tests passed on 2026-09-24, including a real-worker crash/restart integration test; (prop model and presets, rolling guidance, scatter key results, display precision policy) (incl. chart geometry, calendar layout, display rounding, KPI tiles): generated-note safety, research documents, application-service IPC mapping, superseded-run rejection, and dashboard view-model (Unavailable is never zero). |
| Plugin build | Pass | TypeScript check and esbuild production bundle passed. |
| Live M0 path | Pass, owner-confirmed | EURUSD import, verified balance curve, generated note, Browse workflow, and diagnostics panel were manually exercised. |
| Integration/negative coverage | Partial | Live structured unknown-method response was verified; a broader formal integration suite is not yet present. |
| Formal M0 closure | Pass with documented deferrals | See `internal/docs/MILESTONE_0_SPIKE_REPORT.md`. |
| Formal M1 closure | Pass | See `internal/docs/MILESTONE_1_CLOSURE_REPORT.md`. |
| Formal M2 closure | Pass | 16 Core tests, 2 plugin tests, production build, and owner-confirmed representative-report review; see `internal/docs/MILESTONE_2_CLOSURE_REPORT.md`. |
| Formal M3 closure | Pass | 20 Core tests, 2 plugin tests, production build, and owner-confirmed representative-report review; see `internal/docs/MILESTONE_3_CLOSURE_REPORT.md`. |
| Formal M4 closure | Pass | 22 Core tests, 7 plugin tests, production build, and owner-confirmed manual document-flow/safety review; see `internal/docs/MILESTONE_4_CLOSURE_REPORT.md`. |
| Formal M5 closure | Pass | 27 Core tests, 7 plugin tests, production build, representative S1/S2 artifact/daily verification, and owner-confirmed visual Obsidian review; see `internal/docs/MILESTONE_5_CLOSURE_REPORT.md`. |
| M6 What-If increment | Pass | 32 Core tests, 7 plugin tests, production build, and owner-confirmed panel review; see `internal/docs/MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md`. |
| M6 Monte Carlo technical validation | Pass | 42 Core tests, 7 plugin tests, production build, and independently documented Strategy Factory concept review. Owner accepted the original panel review; the new histogram needs a focused manual review. |
| M6 optimisation evidence viewer | Accepted | 41 Core tests, 7 plugin tests, production build, and owner-confirmed 162-pass panel review. |
| MVP dashboard workspace | In progress | Central workspace, concise navigation, automatic safe Overview population, and Core-derived Monte Carlo chart are implemented; view modularised behind `ResearchService` with a stale-import guard; tier A, B, C1, and C2 dashboard work plus batch feedback fixes (159 Core tests, 60 plugin tests, production build pass on 2026-09-23). Owner accepted the Obsidian usability review "for now" on 2026-09-22; further dashboard refinement is expected after competitor/reference UX research. |

## Recently changed files

- 2026-09-22 modularisation: `plugin/src/application/{research-service,latest-run}.ts`,
  `plugin/src/components/{dashboard-model.ts,dashboard-summary.tsx,balance-chart.tsx,collapsible-section.tsx}`,
  `plugin/src/components/{data,analysis,research,advanced}/*.tsx`,
  `plugin/src/vault/research-vault.ts`, `plugin/src/services/local-file-path.ts`,
  `plugin/src/research-view.tsx` (now state/orchestration only),
  `plugin/styles.css`, and `plugin/tests/{application,dashboard-model}.test.ts`.

- `plugin/src/research-view.tsx` — Browse workflow, bounded-note integration,
  and local M0 diagnostics panel.
- `plugin/src/worker-client.ts` — worker readiness exposure for diagnostics.
- `plugin/src/generated-note.ts` and `plugin/tests/generated-note.test.ts` —
  bounded generated-content safety implementation and tests.
- `research-core/src/trading_research_core/{identities,dataset_store,analysis}.py`
  — deterministic schema `1.1` canonical identities.
- `research-core/tests/test_deterministic_storage.py` — byte-stable fresh-workspace
  regression test.
- `research-core/src/trading_research_core/{intake,worker,mt5_excel}.py` — M1
  managed snapshot, evidence registry/verification IPC, and corrected observed
  Excel price-scale parsing.
- `research-core/tests/test_intake.py` — M1 source-preservation and no-partial-
  intake regression coverage.
- `plugin/src/{research-view,types}.tsx` — M1 evidence panel and raw-snapshot
  verification control, including persistent verification feedback and stable
  latest-intake display on a same-dataset registry refresh.
- `internal/development-journal/2026-09-20-milestone-1-intake-foundation.md` —
  implementation record and validation boundaries.
- `internal/docs/MILESTONE_1_CLOSURE_REPORT.md` — M1 closure evidence.
- `internal/docs/MILESTONE_2_{TRADE_EVENT_ANALYSIS,FIXTURE_PLAN,OWNER_REVIEW_CHECKLIST}.md`
  — approved and accepted M2 policy/fixture package and owner-validation checklist.
- `internal/docs/MILESTONE_2_CLOSURE_REPORT.md` — M2 closure evidence.
- `internal/docs/MILESTONE_3_{TIME_EQUITY_RISK_FOUNDATION,FIXTURE_PLAN,OWNER_REVIEW_CHECKLIST}.md`
  — M3 owner-review package; no implementation authorised.
- `research-core/src/trading_research_core/trade_analysis.py` — M2
  source-verified close-event summaries and declared-hedging FIFO lifecycle
  reconstruction, with controlled artifacts.
- `research-core/tests/test_trade_analysis.py` — synthetic M2 allocation,
  quality, account-mode, and deterministic-artifact coverage.
- `plugin/src/{research-view,types}.tsx` — M2 user-supplied account-mode control
  and visibly separated verified/inferred result panels.
- `research-core/src/trading_research_core/time_risk.py` — M3 source-clock
  realised-balance daily drawdown, explicit equity availability, and controlled
  artifact writing.
- `research-core/tests/test_time_risk.py` — M3 source-clock, Decimal drawdown,
  unavailable-equity, and deterministic-artifact coverage.
- `plugin/src/{research-view,types}.tsx` — M3 daily-balance and
  equity-availability presentation; no financial calculation in TypeScript.
- `internal/docs/MILESTONE_3_CLOSURE_REPORT.md` — M3 closure evidence.
- `internal/docs/MILESTONE_4_{EXPERIMENTS_RESEARCH_DOCUMENTS,FIXTURE_PLAN,OWNER_REVIEW_CHECKLIST}.md`
  — approved M4 policy/fixture package and owner-validation checklist.
- `internal/docs/MILESTONE_4_CLOSURE_REPORT.md` — M4 closure evidence.
- `internal/docs/MILESTONE_5_{PORTFOLIO_REPLAY,PORTFOLIO_REPLAY_DISCOVERY,FIXTURE_PLAN,OWNER_REVIEW_CHECKLIST}.md`
  — owner-approved sequential same-account batch-analysis specification package.
- `internal/docs/MILESTONE_5_IMPLEMENTATION_PLAN.md` — conservative preflight-
  first implementation plan; bounded implementation is closed after final
  owner-panel review.
- `internal/docs/MILESTONE_5_CLOSURE_REPORT.md` — M5 closure evidence.
- `internal/docs/MILESTONE_6_{ADVANCED_RESEARCH,FIXTURE_PLAN,OWNER_REVIEW_CHECKLIST}.md`
  — M6 draft policy, reproducibility, and owner-decision package; no M6
  implementation is authorised.
- `internal/docs/MILESTONE_6_WHAT_IF_SCENARIO.md` — accepted first What-If
  slice.
- `internal/docs/MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md` — accepted M6
  fixed-cost What-If increment evidence.
- `internal/docs/MILESTONE_6_MONTE_CARLO.md` — independently implemented after
  Strategy Factory concept review and accepted following owner-panel validation.
- `internal/docs/MILESTONE_6_PAIRED_FORWARD_ANALYSIS_CLOSURE_REPORT.md` —
  accepted source-preserving paired-forward evidence increment.
- `internal/docs/MILESTONE_6_OPTIMISATION_EVIDENCE_CLOSURE_REPORT.md` —
  accepted source-preserving single-grid evidence increment.
- `internal/docs/MILESTONE_6_PARAMETER_SELECTION_DECISION_PACKAGE.md` —
  decision-only package; no selection implementation is authorised.
- `internal/development-journal/2026-09-21-milestone-6-monte-carlo.md` — M6
  Monte Carlo reference adaptation, implementation, and validation record.
- `internal/development-journal/2026-09-21-milestone-6-what-if.md` — M6
  implementation and validation record.
- `internal/development-journal/2026-09-21-collapsible-panel-navigation.md` —
  panel navigation change; owner visual review pending.
- `research-core/src/trading_research_core/reporting.py` — deterministic M4
  report payloads and revision manifests written only after a changed report.
- `plugin/src/research-documents.ts` and its tests — UUIDv7 document shells,
  explicit existing-document validation, marker validation, no-change detection,
  bounded regeneration, and revision frontmatter updates.
- `plugin/src/research-view.tsx` — explicit M4 document-flow controls; no vault
  scan or automatic document creation.
- `plugin/src/components/{dashboard-summary,workspace-navigation}.tsx` — MVP
  central dashboard summary and task-oriented workspace navigation.
- `plugin/src/research-view.tsx` — Browse-and-analyse import flow, automatic
  safe Overview results, and a Core-derived Monte Carlo drawdown distribution;
  no automatic Markdown creation.
- `research-core/src/trading_research_core/monte_carlo.py` — bounded,
  deterministic histogram display data derived from existing Monte Carlo path
  summaries; simulation policy remains unchanged.
- `internal/docs/{MVP_FAST_TRACK,MVP_UI_INFORMATION_ARCHITECTURE}.md` — the
  small, modular MVP delivery path and dashboard information design.
- `internal/references/` — pinned provenance, architecture maps, and findings;
  no external source copied into TRL.

## Do not change

- Obsidian Desktop is the V1 application shell; V1 is desktop-only.
- Python is the authoritative quantitative Research Core.
- Obsidian ↔ Python uses a local subprocess and versioned JSON IPC.
- Canonical analytical storage starts with Parquet + JSON; Markdown is human
  research/documentation.
- Source repository and research vault remain separate.
- React + TypeScript + esbuild is the plugin toolchain.
- Product-ready, personal-first remains the architectural principle.
- Licensing/entitlements stay above the Research Core.
- Internal development material is private and excluded from commercial releases.
- Journalit and Strategy Factory reuse is approved by developer/owner, with
  mandatory provenance tracking and final usage reporting.

## External references

- **Journalit** — Obsidian/plugin/dashboard reference.
- **Strategy Factory** — quantitative/research reference.

**Direct reuse is approved when technically justified, but must be recorded at
the time it occurs.** See `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md`.

## Agent handoff notes

| Role | Working responsibility |
| --- | --- |
| Claude Code | Implementation, repository edits, builds, tests, and environment tooling. |
| Main | Primary architecture/specification decisions, baseline ownership, and development direction. |
| Lab | Secondary review, troubleshooting, architecture checks, research, validation, and second opinions. |

These are working roles, not hard technical restrictions.

## Authoritative documents

Read the handoff together with the relevant authority; do not rely on this file
alone:

1. `CLAUDE.md`
2. `internal/docs/PROJECT_SPEC.md`
3. `internal/docs/ARCHITECTURE.md`
4. `internal/docs/DATA_MODEL.md`
5. `internal/docs/ENGINE_PROTOCOL.md`
6. `internal/docs/TESTING_PROTOCOL.md`
7. `internal/docs/MILESTONE_0_ARCHITECTURE_SPIKE.md`
8. `internal/docs/MILESTONE_0_EXECUTION_STATUS.md`
9. `internal/docs/MILESTONE_0_SPIKE_REPORT.md`
10. `internal/docs/MILESTONE_1_INTAKE_FOUNDATION.md`
11. `internal/docs/MILESTONE_1_FIXTURE_PLAN.md`
12. `internal/docs/MILESTONE_1_OWNER_REVIEW_CHECKLIST.md`
13. `internal/docs/MILESTONE_1_CLOSURE_REPORT.md`
14. `internal/docs/MILESTONE_2_TRADE_EVENT_ANALYSIS.md`
15. `internal/docs/MILESTONE_2_FIXTURE_PLAN.md`
16. `internal/docs/MILESTONE_2_OWNER_REVIEW_CHECKLIST.md`
17. `internal/docs/MILESTONE_2_CLOSURE_REPORT.md`
18. `internal/docs/MILESTONE_3_TIME_EQUITY_RISK_FOUNDATION.md`
19. `internal/docs/MILESTONE_3_FIXTURE_PLAN.md`
20. `internal/docs/MILESTONE_3_OWNER_REVIEW_CHECKLIST.md`
21. `internal/docs/MILESTONE_3_CLOSURE_REPORT.md`
22. `internal/docs/MILESTONE_4_EXPERIMENTS_RESEARCH_DOCUMENTS.md`
23. `internal/docs/MILESTONE_4_FIXTURE_PLAN.md`
24. `internal/docs/MILESTONE_4_OWNER_REVIEW_CHECKLIST.md`
25. `internal/docs/MILESTONE_4_CLOSURE_REPORT.md`
26. `internal/docs/MILESTONE_5_PORTFOLIO_REPLAY.md`
27. `internal/docs/MILESTONE_5_FIXTURE_PLAN.md`
28. `internal/docs/MILESTONE_5_OWNER_REVIEW_CHECKLIST.md`
29. `internal/docs/MILESTONE_5_PORTFOLIO_REPLAY_DISCOVERY.md`
30. `internal/docs/MILESTONE_5_IMPLEMENTATION_PLAN.md`
31. `internal/docs/MILESTONE_5_CLOSURE_REPORT.md`
32. `internal/docs/MILESTONE_6_ADVANCED_RESEARCH.md`
33. `internal/docs/MILESTONE_6_FIXTURE_PLAN.md`
34. `internal/docs/MILESTONE_6_OWNER_REVIEW_CHECKLIST.md`
35. `internal/docs/MILESTONE_6_WHAT_IF_SCENARIO.md`
36. `internal/docs/MILESTONE_6_WHAT_IF_CLOSURE_REPORT.md`
37. `internal/docs/MILESTONE_6_MONTE_CARLO.md`
38. `internal/docs/ROADMAP.md`
39. `internal/adr/`
40. `internal/references/README.md`
41. `internal/references/REFERENCE_REGISTER.md`
42. `internal/references/JOURNALIT_ARCHITECTURE_MAP.md`
43. `internal/references/STRATEGY_FACTORY_ARCHITECTURE_MAP.md`
44. `internal/references/TRL_REFERENCE_FINDINGS.md`

## Update and archive policy

Update this snapshot after a milestone transition, material next-task change,
major blocker change, material architecture/environment change, significant file
set change, or agent/tool handoff. Do not update it for trivial edits.

Before materially rewriting it at a major milestone boundary, archive the prior
snapshot as `archive/HANDOFF-YYYY-MM-DD-NN.md`. The pre-M1 M0 closure snapshot
is archived as `archive/HANDOFF-2026-09-20-01.md`; the M1-transition snapshot
is archived as `archive/HANDOFF-2026-09-20-02.md`.
