# Milestone 0 — Architecture Spike

## Objective

Prove one complete, local, deterministic vertical slice before product work:

```text
MT5 report → Python importer → canonical Parquet dataset → basic statistics
→ balance/equity series → JSON IPC → Obsidian React view
→ interactive display → linked experiment Markdown note
```

## Included scope

- One controlled MT5 Excel fixture already approved for local use (EURUSD is
  the preferred first fixture), with its SHA-256 and expected totals.
- Python 3.14.7 environment assessment and the smallest compatible dependency
  set required for `openpyxl`, Parquet, and basic tabular calculation.
- One versioned canonical trade/event dataset written as Parquet plus a JSON
  provenance manifest.
- Basic deterministic completed-deal statistics and balance series. Equity is
  displayed only where marks/supporting evidence make it comparable; otherwise
  the result states its limitation.
- Stdio NDJSON worker handshake, one analysis request, structured error, worker
  restart, and cancellation behaviour.
- A minimal Obsidian plugin command/view rendered in the isolated external
  `C:\DEV\vaults\TRL-Dev-Vault\`.
- One chart-library comparison/prototype sufficient to judge interaction,
  performance, licensing, and Obsidian fit.
- One experiment Markdown note with versioned `trl_` frontmatter and generated
  content bounded by stable markers.

## Explicit exclusions

No portfolio replay, trade-pairing algorithm, Monte Carlo, money management,
prop-firm calculation, optimizer import, commercial features, production vault
use, automatic updates, telemetry, database, migration, or broad dashboard.

## Fixtures and expected evidence

- Original fixture remains immutable; use a controlled derivative only where
  test packaging requires redaction.
- Known source hash, row count, initial balance, signed cash total, and JPY
  precision regression remain test assertions.
- A deterministic golden canonical manifest and expected basic-statistics JSON.
- Development-vault test note checked for frontmatter validity and non-generated user
  text preservation.

## Acceptance criteria

1. Same source hash, core version, schema, and configuration produce byte-stable
   canonical/result manifests and equivalent Parquet content checksums.
2. The worker starts, handshakes, handles a valid request, returns a structured
   validation error, shuts down, crashes/restarts cleanly, and does not crash
   Obsidian.
3. The plugin remains responsive during worker activity and startup does no
   analysis.
4. The view displays basic statistics and a chart from worker output only.
5. The generated note updates only the bounded plugin-owned section.
6. Windows paths with spaces and portable-development locations work.
7. Candidate Parquet and chart dependencies pass compatibility/licence review.

## Failure criteria

- Plugin must duplicate a financial calculation to render a result.
- Stdio framing loses/corrupts messages or cannot recover a worker crash.
- Canonical output changes without an input/configuration/version change.
- Generated content overwrites user prose.
- A dependency is incompatible with Python 3.14.7, Obsidian, or intended
distribution and has no acceptable replacement.

## Measurements

Record plugin activation time, worker startup/restart time, fixture import time,
canonical Parquet size, analysis time, view render time, peak worker memory,
and chart interaction responsiveness. Establish baselines; do not invent
product-scale targets before the spike produces evidence.

## Deliverables

- Spike source under the new package boundaries.
- Protocol transcript fixtures and deterministic golden outputs.
- Dependency/licence inventory.
- Development-vault workflow guide.
- Architecture-spike report: pass/fail for each criterion, measurements,
  unresolved risks, and a recommendation to proceed, amend, or replace a
  component.
