# 2026-09-24: per-window comparison, multi-import, and research-note access

The owner accepted W1–W6 and N1–N6 as recommended
(`internal/docs/PROPOSAL_WINDOWS_AND_NOTES.md`).

## Symbol scan multi-import (SWEEP-2, commit fc4b37c)

- Browse XML now takes several files. They are imported in turn, and each
  file gets its own result: imported, already in the library, or refused
  with the reason.
- A `.set` applies only to a single-file import.
- After a partial failure, only the refused files stay selected.

## Windows (WIN-1, commits 736c12e and 5ebc1ea)

- **Core (`windows.py`, `windows-1`):**
  - split mode: calendar windows of 1–24 months; a trade counts in its
    closing window; drawdown is measured from each window's start; a window
    is partial when the report's own test period does not cover it
  - separate mode: 2–12 reports; EA, symbol, deposit, timeframe, and inputs
    must match; overlap is BLOCKED and gaps are a NOTE
  - no balance continuity is required, unlike the sequential batch
  - summary, the user's thresholds, and the note Markdown
- **Tests:** Core 270.
- **Real data (P1, USDJPY 2024):**
  - the quarterly windows sum exactly to the report's closed total
  - Q3 lost 30 101 USD, while the other three quarters made money
- **Plugin:**
  - an Analysis section with a split / separate choice and the thresholds
  - summary tiles, a per-window bar chart (slot hover), the table, guidance,
    the audit trail, and a record block
  - harness checks: tooltip, bars, record, no overflow at 1100 px

## Research notes (NOTES-1)

- **N6:** the index lists only notes with `trl_type` plus `trl_id`
  frontmatter, read through Obsidian's metadata cache. It refreshes (with a
  debounce) on metadata changes, deletes, and renames.
- **N2:** new Experiments are `trl_schema: 2` with a `trl_experiment_kind`:
  report-analysis, symbol-scan, parameter-study, or general. Older ones are
  read as report-analysis when they carry a dataset, otherwise as general.
  Report-analysis creation needs the loaded dataset and analysis.
- **N1:** "Record to" in Symbol scan, Parameters, and Windows:
  - it lists compatible Experiments; report-analysis ones must match the
    loaded analysis
  - it defaults to the most recent
  - inline "New experiment…" has a name check and a Strategy picker (or a
    new strategy)
  - "Open note" is available
  - recording writes a marked block, with a confirmation before replacing
- **N3:** a notes browser on Research notes:
  - the tree, search, and type and kind filters
  - open, use (a strategy, or the Experiment matching the loaded analysis),
    and rename through Obsidian's file manager, so links update
  - orphans are listed as "Not linked"
- **N4:** the sidebar card with the 5 most recently changed TRL notes, and
  "All research notes".
- **N5:** the create and rename dialogs show existing names as you type,
  block an exact clash, and warn on a near clash.
- **Harness checks:**
  - compatible filtering, near and exact name checks, inline creation that
    selects the new note
  - the tree, search, use buttons, and the unlinked group
- **Tests:** plugin 111; the build is clean.

**Still needs the owner:** a visual review in Obsidian, especially of the
live index on a real vault (rename and delete refresh) and the sidebar card.
