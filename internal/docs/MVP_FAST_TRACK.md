# Trading Research Lab — MVP Fast Track

**Status:** Approved implementation direction, 2026-09-22.  
**Purpose:** deliver a small, clean, extensible local-first MVP quickly while
preserving the locked Obsidian + Python Research Core architecture.

## MVP outcome

A researcher can select an MT5 Strategy Tester `.xlsx` report, preserve and
verify its source evidence, view basic verified analysis in Obsidian, and link
that work to a Strategy, Experiment, and Report. The dashboard is the visible
starting point for this workflow; the Python Core remains the authority for all
financial results.

## Included

- MT5 `.xlsx` intake, immutable snapshot, canonical Parquet/JSON evidence, and
  source verification;
- verified balance curve, basic statistics, close-event analysis, and
  source-clock realised-balance daily drawdown;
- local NDJSON worker integration and clear unavailable/error states;
- a fixed, responsive Obsidian dashboard with dataset, balance, trade, daily
  risk, research-document, and balance-curve cards;
- explicit Strategy → Experiment → Report relationships and safe generated
  Markdown; and
- bounded sequential same-account batch status where useful.

## Deliberately excluded from the MVP critical path

- **DEFERRED — POST-MVP:** automatic parameter selection, scores, and `.set`
  generation;
- **DEFERRED — POST-MVP:** position sizing and money-management research;
- **DEFERRED — POST-MVP:** multi-account portfolios, currency conversion,
  weights/allocation and lot rescaling (single-account concurrent combination
  **as reported** is now in scope as MVP-P, decision PL-001);
- **DEFERRED — POST-MVP:** broker compliance, MAE/MFE, margin, and liquidation
  claims. Prop-firm rule checks follow MVP-P and require an equity evidence
  source first (decision PL-006);
- **DEFERRED — POST-MVP:** dashboard drag/drop, resize, saved layouts, and a
  custom widget marketplace; and
- **DEFERRED — POST-MVP:** cloud, accounts, telemetry, payments, and product
  entitlement enforcement.

## Implementation sequence

1. **MVP-A — UI foundation:** split presentation responsibilities from the
   original research view, add a fixed dashboard, and retain a lightweight
   worker-facing application boundary. Dashboard work begins here.
2. **MVP-B — primary workflow:** make import → dashboard → Strategy →
   Experiment → Report clear, with empty, loading, error, and recovery states.
3. **MVP-C — usability and hardening:** owner visual review, narrow-width
   behaviour, clear unsupported-data messaging, component tests, and concise
   product-facing setup help.
4. **MVP-D — release readiness:** release allowlists, internal-material
   exclusion, dependency/licence review, and local installation smoke checks.

Status 2026-09-23:
- MVP-C: the Portfolio and Parameters pages pass the 320 px harness check,
  and product help exists in `product-docs/`. The owner visual review is
  pending (`MVP_OWNER_REVIEW_CHECKLIST.md`).
- MVP-D: the allowlist tooling, release check, and release-folder worker
  smoke check are done. Licence, Python distribution, notices, and channel
  decisions are pending (`MVP_D_RELEASE_READINESS.md`).

Dashboard tiers A and B are implemented (2026-09-22). Tier C performance
metrics are specified in `MVP_TIER_C_PERFORMANCE_METRICS.md` (draft, awaiting
owner decisions D1–D7; no implementation authorised yet).

## MVP-P — Portfolio Lab (owner-approved 2026-09-22)

The primary multi-import workflow: import several EA backtests as strategy
tracks, chain consecutive reports of one EA into a track (reusing the M5
preflight), compare tracks side by side, and compare user-selected or
explored combinations on one account over each track's active period by
return versus drawdown. Specification: `PORTFOLIO_LAB_SPEC.md`. Decisions:
PL-001 to PL-006 in `DECISION_LOG.md`. A prop-firm rules module follows,
built on the combination engine and an equity evidence source.

M6 advanced-research features remain available as separately qualified tools,
but do not block this sequence.

## External-reference position

No external code is reused for MVP-A. Journalit's component/view patterns and
Strategy Factory's domain separation remain reference material only. Any later
direct or substantial reuse must be technically justified and immediately
entered in `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md` with the
pinned source, exact destination, changes, validation, and product scope.
