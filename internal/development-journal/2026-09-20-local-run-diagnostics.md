# Local M0 Run Diagnostics

**Date:** 2026-09-20  
**Scope:** local non-financial performance observations.

## Change

The M0 view now reports per-run elapsed time for worker readiness, MT5 import,
verified-statistics calculation, report-payload generation, note writing, view
presentation, and total local run time.

## Boundaries

- Measurements use the plugin's local monotonic clock only.
- They do not alter the worker protocol, quantitative results, raw source,
  canonical data, or generated research Markdown.
- They are not persisted, transmitted, or treated as a product performance
  guarantee.
- Peak Python-worker memory remains explicitly unavailable in M0 because the
  project does not add privileged system inspection or a new dependency merely
  to obtain it.
- Responsiveness remains a qualitative observation. Very short runs can finish
  before a person can interact with the view; that is not a failed check.

## Manual review required

Reload the plugin, run an approved report once, and check that the local run
diagnostics panel appears after completion. Record the displayed values in the
M0 acceptance evidence if they are needed for a future course or comparison.
