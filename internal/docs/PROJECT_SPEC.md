# Project Specification

## Roadmap governance

The authoritative milestone order, classification, and status are maintained in
[`ROADMAP.md`](ROADMAP.md). This specification defines product requirements and
must not be used to infer that a future capability has been approved for
implementation. Each milestone requires its own approved specification,
fixture plan, acceptance criteria, and owner manual-review checklist.

## Functional requirements

### Import and provenance

- Support versioned import adapters; the initial evidence is MT5 Strategy Tester
  Excel Deals exports.
- Preserve raw inputs and record source hash, filename, source type, import
  time, importer version, schema version, source-time context, account currency,
  and available broker/server metadata.
- Reject unsupported/ambiguous source layouts instead of guessing.

### Research Core

- Produce source-independent canonical datasets, deterministic analysis results,
  provenance manifests, and disposable derived caches.
- Progressively support trade analysis, balance/equity reconstruction, drawdown,
  MAE/MFE, distribution/expectancy, shared-balance portfolio replay,
  correlation/exposure, What-If, Monte Carlo, money management, optimization
  analysis, and generic risk/prop-firm rules.
- Daily drawdown is required but never calculated without a versioned calendar,
  time, basis, and floating-P/L policy.

### Plugin and vault

- Provide Obsidian commands, settings, React research views, and vault-linked
  Markdown experiment/report notes.
- Use `trl_` frontmatter metadata and safe generated-content markers.
- Render worker results; never reimplement financial calculation in TypeScript.

### Entitlements

- Offer a capability/limit interface, such as `hasFeature(featureId)` and
  `getLimit(limitId)`, above application workflows only.
- Never embed Free/Pro rules into the Research Core, canonical data, or research
  Markdown. The future Free/Pro matrix is deliberately undecided.

## Non-functional requirements

- Desktop-only V1 on Windows/Obsidian Desktop.
- Python target: 3.14.7; dependency compatibility is a Milestone 0 gate.
- Local worker, no HTTP requirement, no external service, no telemetry.
- Decimal-safe financial inputs; preserve source precision metadata.
- Stable IDs, schemas, protocols, manifests, deterministic ordering, explicit
  random seeds, structured errors, and rebuildable derived results.
- Lightweight plugin startup and non-blocking analysis.

## Out of scope for V1 baseline

Mobile support, hosted collaboration, broker execution, automatic trading,
payments, commercial activation, telemetry, cloud sync requirements, and a
mandatory database.
