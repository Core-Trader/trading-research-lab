# Sequential Batch (M5) — Feedback Analysis

**Date:** 2026-09-22. **Trigger:** the owner reports no usable feedback from the
combined batch analysis, which they see as inspired by FXOptimize.
**Method:** ran the Core preflight, combined balance, and combined daily
drawdown on the owner's four locally stored real report snapshots in a
throwaway workspace (nothing written to the repository or vault), and reviewed
the M5 spec, Core code, and plugin panel.

## Findings

### 1. The feature solves a different problem than FXOptimize (main cause)

| | TRL M5 (as specified and built) | FXOptimize |
| --- | --- | --- |
| Question | "Continue one account's history across consecutive reports" | "What if several EAs traded **at the same time** on one account?" |
| Inputs | Reports whose date spans **do not overlap**; each report's opening balance must equal the previous report's final balance | Several backtests over the **same** period |
| Result | One continuous realised-balance curve | A combined portfolio curve, stacked drawdown, correlation, and ranked combinations |

The M5 spec states this explicitly: "only sequential reports from one account …
not … pooled/shared capital across strategies, or general portfolio
construction".

**Owner data run:** the four reports span 2024-01-01→2026-09-18,
2025-01-01→2026-01-29, 2026-01-01→2026-04-27, and 2026-05-02→2026-09-18. The
first three overlap, so the batch is `BLOCKED: COVERAGE_OVERLAP`. The two 2026
reports alone are sequential with a matching balance (10115.55): that pair is
`ELIGIBLE` and produces a combined curve (10000 → 10237.25, 116 rows) and a
combined daily drawdown. **The Core works for its specified case; the owner's
real use case is the concurrent portfolio case, which does not exist yet.**

### 2. Feedback defects in the current feature (independent of scope)

| # | Defect | Effect |
| --- | --- | --- |
| B1 | Findings do not name the reports involved. `COVERAGE_OVERLAP` stops at the first overlapping pair. | The user cannot tell which files conflict or what to remove. |
| B2 | `DEAL_ID_REUSED` repeats once per member (three identical lines) without context. | Noise that looks like an error. |
| B3 | The result is a text dump (`<dl>` of codes and joined strings). | Hard to read; the status is not prominent. |
| B4 | No guidance after `BLOCKED` (what to change, or that the feature is sequential-only). | A dead end. |
| B5 | Errors appear in the global error area at the top of the page, not in the panel. | Easy to miss while the panel is scrolled into view. |
| B6 | No busy state while intake runs (it can take seconds per file). | Looks like nothing happened. |
| B7 | The panel is collapsed by default under Data & import; results never reach Overview. | Low discoverability. |
| B8 | The combined daily drawdown % is shown unrounded (`0.16718890461004800…`). | Unreadable. |
| B9 | No visual of member date coverage. | Overlaps and gaps are invisible (audit item V7). |

## Recommendations

1. **Fix B1–B9 now** (no scope change). The Core returns member-identified
   findings for every conflicting adjacent pair and one consolidated deal-ID
   warning (preflight calculation version 2). The plugin shows a status banner,
   a coverage timeline, readable findings with next steps, in-panel busy and
   error states, rounded percentages, and a clear "sequential continuation
   only" explanation that points to the concurrent portfolio proposal.
2. **Specify the FXOptimize-style case as a new, separate package**:
   `PORTFOLIO_CONCURRENT_COMBINATION.md` (draft). It must not be squeezed into
   M5's sequential rules. Portfolio aggregation is currently classified
   **DEFERRED — POST-MVP** in `MVP_FAST_TRACK.md`, so pulling it forward is an
   owner scope decision.
