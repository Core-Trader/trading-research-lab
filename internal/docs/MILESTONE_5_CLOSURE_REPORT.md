# Milestone 5 — Sequential Same-Account Balance Analysis Closure Report

**Status:** Closed, 2026-09-21  
**Scope:** Evidence-qualified sequential same-account realised-balance analysis
for an explicitly selected batch of MT5 Strategy Tester Excel reports.

## Delivered

- Independent M1 intake or reuse for every explicitly selected source report.
- Python-owned sequential batch preflight that retains source membership and
  reports eligibility, ordering, currency/clock compatibility, duplicate,
  overlap, gap, and balance-continuity findings without guessing.
- Explicit eligible-only creation of a bounded Parquet combined
  realised-balance artifact and JSON manifest. No Markdown research document is
  created by this action.
- A separate, qualified source-reported-clock daily realised-balance drawdown
  result. It retains gap warnings and does not claim intratrade equity,
  continuous coverage, prop-firm compliance, or broker-time conversion.
- An Obsidian batch panel supporting both one-by-one and multi-file selection,
  visible retained member lists, removals, preflight review, and the explicit
  artifact boundary.

## Validation evidence

| Area | Outcome |
| --- | --- |
| Research Core | 27 pytest tests pass, including preflight, artifact, daily-drawdown, and worker-IPC coverage. |
| Plugin | 7 automated tests and the production TypeScript/esbuild build pass. |
| Technical representative pair | `s1_EURUSD.xlsx` + `s2_EURUSD.xlsx` was eligible; the bounded artifact contained 116 source balance rows, `10,000.00 → 10,237.25 USD`, and `+237.25 USD`. The qualified worst observed daily realised-balance drawdown was `16.85 USD` on `2026-01-30`. |
| Owner review | The owner confirmed the visual Obsidian review, including the selected-batch workflow and the qualified daily-drawdown presentation. |

## Boundaries retained

M5 does not support multi-account/shared-capital aggregation, currency
conversion, inferred funding, intratrade equity or equity drawdown, broker-time
conversion, prop-firm compliance, optimisation, Monte Carlo, automatic vault
scanning, or automatic research-document creation. A reused deal ID in a
non-overlapping report is a warning; overlap and exact source-time/deal-ID event
collisions remain blocking evidence conditions.

## Next milestone

Milestone 6 — Advanced Research remains proposed only. Before any implementation
begins, its scope, reproducibility rules, fixtures, acceptance criteria, and
owner review package must be explicitly approved.
