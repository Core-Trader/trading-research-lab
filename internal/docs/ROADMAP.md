# Trading Research Lab Roadmap

**Status:** authoritative milestone order and status record  
**Last reconciled:** 2026-09-22  
**Current milestone:** Milestone 6 — Advanced Research (accepted evidence and
scenario slices; automatic selection deferred). MVP-A dashboard work is the
active product-delivery track.

## Authority and use

This file is the single authoritative roadmap for milestone numbering, order,
and status. It reconciles the locked ADRs, formal milestone specifications, the
current handoff, and the former planning-only implementation roadmap.

It does **not** approve future scope. An individual milestone may begin product
implementation only when its own specification, fixture plan, acceptance
criteria, and owner manual-review checklist have been approved. Approved ADRs
and the applicable formal milestone specification take precedence over this
roadmap if a conflict is found.

`internal/docs/IMPLEMENTATION_ROADMAP.md` is retained only as a historical
redirect. Archived handoffs and pre-reset planning material are historical
evidence, not roadmap authority.

## Milestone classification and counts

- **Formally defined milestone records:** 6 (Milestones 0–5).
- **Formally closed milestones:** 6 (Milestones 0–5).
- **Proposed future sequence consolidated from existing planning:** 2
  (Milestones 6–7). These milestones have names and broad scopes only; they are
  not approved specifications.
- **Total milestones in this authoritative roadmap:** 8 (Milestones 0–7).

## Ordered roadmap

### Milestone 0 — Architecture Spike

- **Classification:** Formally defined and closed.
- **Status:** Completed.
- **Primary objective:** Prove the end-to-end Obsidian Desktop plugin and local
  Python Research Core architecture before broader product work.
- **Main scope:** A source-preserving MT5 Excel import, verified balance curve,
  versioned local worker IPC, generated vault note, development plugin linkage,
  and diagnostic/validation evidence.
- **Explicit exclusions:** Trade pairing, account-mode discovery, intratrade
  equity, daily drawdown, portfolio replay, optimisation, Monte Carlo, and
  release packaging.
- **Key deliverables:** M0 architecture-spike specification, implementation and
  validation evidence, local-worker/plugin path, and closure report.
- **Acceptance criteria:** The complete vertical path, production plugin build,
  automated core/plugin checks, and required owner manual checks pass; deferred
  risks are documented rather than hidden.
- **Dependencies:** None; establishes the reset baseline.

### Milestone 1 — Intake Foundation

- **Classification:** Formally defined and closed.
- **Status:** Completed.
- **Primary objective:** Establish evidence-first, source-preserving MT5 report
  intake and provenance before analysis features.
- **Main scope:** SHA-verified managed raw snapshots, deterministic canonical
  dataset reuse, a bounded local registry, evidence lookup/verification IPC,
  and plugin evidence views.
- **Explicit exclusions:** Trade pairing, account-mode/timezone inference,
  equity or drawdown reconstruction, portfolio replay, optimisation, and
  exposure of private receipt paths in product material.
- **Key deliverables:** M1 specification, fixture plan, owner checklist,
  intake/registry evidence capabilities, automated coverage, and closure
  report.
- **Acceptance criteria:** Source preservation, normal and duplicate intake,
  invalid/ambiguous/changed/tampered-source handling, evidence UI, tests, build,
  and owner manual review pass as recorded in the closure report.
- **Dependencies:** Milestone 0 closed.

### Milestone 2 — Trade and Event Analysis

- **Classification:** Formally defined and closed.
- **Status:** Completed.
- **Primary objective:** Add deterministic event-level and, only when expressly
  permitted, lifecycle-level trade analysis without overstating MT5 evidence.
- **Main scope:** Verified close-event summaries; quality-labelled lifecycle
  reconstruction; deterministic hedging/FIFO inference policy if approved;
  partial-close allocation; completed-trade distributions; basic reports; and
  versioned Parquet/JSON artifacts and IPC.
- **Explicit exclusions:** Forensic-EA ingestion, automatic account-mode
  discovery, broker-timezone conversion, intratrade equity, daily drawdown,
  prop-firm policies, portfolio replay, optimisation, Monte Carlo, and changes
  to MT5 source import.
- **Key deliverables:** Approved M2 specification, fixture plan, owner checklist,
  quality-separated event/lifecycle artifacts and views, tests, and owner review
  evidence. Implementation and owner acceptance are recorded in the closure
  report.
- **Acceptance criteria:** The owner approves the inference eligibility,
  user-supplied account-mode declaration, FIFO/allocation rules, quality
  presentation, metrics, and fixtures; then implementation must pass its
  approved automated and manual checks without silently producing verified
  lifecycles from insufficient source evidence.
- **Dependencies:** Milestone 1 closed; owner policy approval recorded before
  implementation.

### Milestone 3 — Time, Equity, and Risk Foundation

- **Classification:** Formally defined and closed.
- **Status:** Completed.
- **Primary objective:** Establish explicit temporal, balance/equity, and
  generic risk foundations for later analysis.
- **Main scope:** Source-reported-clock analysis by default, optional
  broker-time profiles, mark availability and qualification, balance/equity
  distinctions, and generic daily-drawdown analysis.
- **Explicit exclusions:** Undeclared timezone assumptions, unsupported
  intratrade mark-to-market claims, hard-coded broker or prop-firm policy, and
  portfolio replay.
- **Key deliverables:** Approved M3 specification, fixture plan, owner checklist,
  policy/configuration model, deterministic fixtures, qualified result
  artifacts/views, and validation evidence. The basic report-supported
  implementation and owner acceptance are recorded in the closure report.
- **Acceptance criteria:** The owner approves the source-clock default, optional
  profile model, generic realised-balance daily-drawdown definition, partial-day
  treatment, percentage denominator, fixtures, and manual checks. Every
  implemented result must expose its calendar, time basis, floating-P/L, and
  data-availability assumptions.
- **Dependencies:** Milestone 2 must establish the required event/lifecycle
  evidence boundary; any M2 policy decision must be respected.

### Milestone 4 — Experiments and Research Documents

- **Classification:** Formally defined and closed.
- **Status:** Completed.
- **Primary objective:** Connect analysed datasets to reproducible strategy and
  experiment research documents.
- **Main scope:** Strategy/experiment relationships, safe Markdown generation,
  report regeneration, and report versioning.
- **Explicit exclusions:** Arbitrary replacement of user prose, product
  distribution documentation, and financial calculations in TypeScript.
- **Key deliverables:** Approved M4 specification, fixture plan, owner checklist,
  vault-document safety tests, versioned report artifacts, owner review
  evidence, and a closure report.
- **Acceptance criteria:** The owner approves document locations, explicit
  relationship boundaries, identity, bounded generation, no-change detection,
  changed-regeneration warning, revision record, fixtures, and manual checks.
  Generated content must remain reproducible and safely separable from
  user-authored content. These conditions are recorded in
  `MILESTONE_4_CLOSURE_REPORT.md`.
- **Dependencies:** Milestones 1–3 provide provenance, analysis identity, and
  qualified time/risk outputs where used.

### Milestone 5 — Sequential Same-Account Balance Analysis

- **Classification:** Formally defined and closed.
- **Status:** Completed.
- **Primary objective:** Provide evidence-qualified, sequential same-account
  realised-balance analysis for an explicitly selected set of MT5 reports.
- **Main scope:** Independent M1 intake/reuse; chronological preflight;
  compatibility, duplicate, overlap, gap, and capital-continuity checks;
  bounded Parquet/JSON combined realised-balance artifacts; and qualified
  source-clock daily realised-balance drawdown.
- **Explicit exclusions:** Multi-account or shared-capital portfolios, currency
  conversion, inferred funding, intratrade equity or equity drawdown, prop-firm
  compliance, broker execution, optimisation, Monte Carlo, and automatic vault
  or folder scanning.
- **Key deliverables:** The approved M5 specification, fixture plan, owner
  checklist, implementation plan, deterministic Core tests, plugin batch UI,
  bounded artifacts, qualified daily result, and final owner review evidence.
- **Acceptance criteria:** Explicitly selected sequential reports must pass
  evidence-preserving M1 intake; the Core must block unsupported/bad batches,
  retain warnings without guessing, require an explicit artifact-creation step,
  and label daily output as source-clock realised balance. Automated tests and
  production plugin build must pass; the final panel workflow must receive owner
  confirmation. These conditions are recorded in
  `MILESTONE_5_CLOSURE_REPORT.md`.
- **Dependencies:** Milestones 1–3 and applicable M2 evidence semantics.

### Milestone 6 — Advanced Research

- **Classification:** Formally defined first What-If and Monte Carlo slices;
  remaining workstreams remain proposed and unapproved.
- **Status:** In progress — What-If, Monte Carlo, single-grid optimisation
  evidence, and paired-forward evidence slices accepted; automatic parameter
  selection deferred.
- **Primary objective:** Add controlled scenario and stochastic research tools.
- **Main scope:** What-If analysis, Monte Carlo, money management, optimisation
  analysis, and explicit random-seed controls.
- **Explicit exclusions:** Live trading or broker execution, hidden randomness,
  opaque optimisation claims, and commercial feature enforcement in the core.
- **Key deliverables:** A future approved specification, versioned scenario and
  seed manifests, fixtures, results artifacts, tests, and owner review evidence.
- **Acceptance criteria:** To be formally defined before implementation; at a
  minimum, configurations, algorithms, input datasets, and seeds must be
  recorded so results can be reproduced.
- **Dependencies:** Reliable event/lifecycle, time/risk, and (where relevant)
  portfolio foundations from earlier milestones.

### Milestone 7 — Product Hardening

- **Classification:** Proposed future milestone, consolidated from existing
  planning; no formal milestone package exists.
- **Status:** Not started.
- **Primary objective:** Prepare the local-first product for reliable controlled
  distribution without weakening private-development boundaries.
- **Main scope:** Performance, packaging, release allowlists, compatibility,
  user help, and optional entitlement-provider integration above application
  workflows.
- **Explicit exclusions:** Bundling `internal/`, mandatory accounts/payments,
  telemetry, cloud requirements, and Free/Pro calculations in the Research
  Core.
- **Key deliverables:** A future approved release specification, packaging and
  compatibility evidence, release allowlist checks, product-facing
  documentation, and any separately approved entitlement boundary.
- **Acceptance criteria:** To be formally defined before implementation; at a
  minimum, releasable artifacts must exclude internal material, satisfy the
  approved compatibility/licence policy, and preserve local-first operation.
- **Dependencies:** The relevant earlier research capabilities are complete and
  the separate product-licence/ownership and publishable-fixture decisions are
  resolved.

### Future: live drift monitoring

- **Classification:** Recorded future work, not scheduled; no milestone package
  and no owner decisions (`PROPOSAL_LIVE_DRIFT.md`, draft L1–L5; decision
  LIVE-1).
- **Status:** Not started.
- **Primary objective:** Detect whether live or demo results drift from what the
  backtest led the owner to expect.
- **Main scope:**
  - an account-history importer
  - a same-period deal-by-deal comparison with an MT5 re-run
  - live-against-bands checks that reuse the bootstrap, significance, cost,
    and windows engines
  - a separately designed live-safe equity logger mode
- **Explicit exclusions:** Broker connections, network access to accounts,
  trading or execution, alerts, and automatic decisions.
- **Key deliverables:** To be defined when the proposal is taken up.
- **Acceptance criteria:** To be defined when the proposal is taken up. At a
  minimum: immutable raw snapshots with provenance, sourced and labelled drift
  statements, no verdicts, and user-defined thresholds only.
- **Dependencies:** The deferred C6 import change (non-trade deal types), the
  Research workflow gap "Importing demo or live account statements", and the
  existing M6 engines.

## Current operating instruction

Milestone 5 is closed. The current milestone is **Milestone 6 — Advanced
Research**. Its bounded What-If, Monte Carlo, single-grid optimisation evidence,
and paired-forward evidence slices are accepted. Automatic selection,
money-management research, and broader portfolio metrics remain out of scope
until separately approved. The approved MVP dashboard track is specified in
`MVP_FAST_TRACK.md` and is not blocked by deferred M6 work. On 2026-09-22 the
owner approved **MVP-P Portfolio Lab** (concurrent single-account combination
of EA backtests, "as reported"; `PORTFOLIO_LAB_SPEC.md`, decisions PL-001 to
PL-006). Weights/rescaling, money management, and multi-account portfolios
remain out of scope. Prop-firm rule checks follow Portfolio Lab and require an
equity evidence source.

## Required roadmap maintenance

When a future milestone is formally specified or an approved scope/status
changes, update this file and the current operational handoff in the same
change. Do not place a second full roadmap in handoffs, specifications, or
agent instructions; link here instead.
