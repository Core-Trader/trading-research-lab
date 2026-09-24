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

## Follow-up: page alignment and sweep deletion (owner feedback)

- The sidebar showed "Research notes" and "All research notes" leading to the
  same page; the second link is removed (UIX-3).
- The Research notes page is realigned: the working set is a three-column
  grid, and the browser uses fixed columns with a header row and aligned
  filters. Checked by screenshot at 1000×800.
- Symbol scan library: "Delete…" opens an inline warning that lists the TRL
  notes citing the sweep's hash, with keep (default) or trash (recoverable)
  options (SWEEP-3). Harness-checked with and without a dependent note,
  including the trash choice. Shortlists now carry the full `sweep_ref`.
- Tests: Core 270, plugin 111; typecheck clean.

**Still needs the owner:** a visual review in Obsidian, especially of the
live index on a real vault (rename and delete refresh) and the sidebar card.

## Follow-up: layouts (LAYOUT-1)

- The Data & import library picker loaded on focus, so the first press opened
  an empty list. It now loads when the page is shown and after each import.
- Help sections fold, with the state remembered per device.
- Customisable layouts are built as recommended: Overview is a grid (order,
  hide, width); Analysis and Help are single columns (order, hide). The
  design is in `LAYOUT_SPEC.md`, including the path to custom dashboards.
- Harness checks:
  - width, ↑/↓, hide, drag and drop, reset, and saving
  - edit tiles keep the grid's shape at 1200px and fold at 800px
- Tests: plugin 118 (7 new layout-model tests); the typecheck is clean.

## Follow-up: reopening with the last report (SESSION-1)

- The owner reported that the Overview was empty after TRL was reopened.
- Saved in the plugin settings, as references only: the report's
  `dataset_ref`, whether it was analysed, and the working set.
- On opening, TRL reloads the evidence from the library. An analysed report
  is recalculated by the Core, with no success pop-up and a status line
  instead. The same run id comes back (tested in Core
  `test_analysis.py`), so the linked notes still match.
- A missing engine keeps the reference. A deleted report clears it with a
  message.
- Obsidian loads background tabs lazily, so the engine starts only when the
  TRL tab is shown.
- Tests: plugin 121 (3 new last-report tests); the build is clean.
- Not yet checked in Obsidian: the view cannot mount in the harness.

## Follow-up: Optimisation checklist (DOC-002)

- The owner's tutorial was evaluated against the MT5 testing report and
  optimisation types pages (fetched 2026-09-24), the registered sources, and
  TRL's tools.
- **Valid:** the step order, real ticks, the PF and RF definitions, equity
  versus balance drawdown, the cliff check, and the pitfalls.
- **Corrected:**
  - Monte Carlo: "% ending negative" is impossible under reordering.
  - The name "walk-forward".
  - The definition of Equity Drawdown Maximal.
  - The claim about the genetic algorithm.
- **Unsourced numbers:** now user-defined thresholds.
- **Built as option A:** a Help section, a generated Markdown file, 5 tests
  (including one guarding the Monte Carlo claim), and one new gap entry.
- Plugin tests: 126.

## Follow-up: plain language (UIX-5) and significance (SIG-1)

- **Plain language:** Core codes on screen (for example `MT5_VERIFIED`,
  analysis bases, statuses, and codes inside warnings) now show their
  meaning, with the code on hover.
  - Worker errors show only the message.
  - Five Core texts that embedded codes were reworded: four warnings and the
    M0 note.
- **Significance:**
  - Core `significance-1`, tested against t-table values, a hand-worked
    interval, autocorrelation, and a NIST-formula runs example. My first
    expected Z was an arithmetic slip; the Core value was right.
  - Plugin: the widget, the guidance model (each point labelled and
    sourced), the thresholds store and settings, the Overview line, and the
    pre-filled filters.
  - Harness-checked on three Core-generated cases: an interval that
    includes zero, one above zero, and streaks. Confidence switching and the
    minimum-trade warning were also checked.
- Tests: Core 284; plugin 141.

## Follow-up: bootstrap Monte Carlo (BOOT-1) and hideable guidance (GUIDE-1)

- **Sources read:**
  - Efron 1979 (abstract), NIST 1.3.3.4 (including its tail caution), and
    Künsch 1989 (abstract; no numeric block length).
  - Politis & Romano was not reachable and is not used.
- **Core:**
  - A new module; the reorder method is untouched.
  - Tests: determinism, a total that varies, blocks that stay consecutive,
    all-win and all-loss boundaries, validation, and a note from the stored
    result.
  - Two issues found: a synthetic-hash collision in my own test, and `0E-8`
    percent formatting, which is now fixed.
- **Plugin:** the method selector, BootstrapView, the guidance model, and one
  switch for all guidance (checked: hiding and restoring).
- **Tests:** Core 296 (12 new); plugin 147.

## Follow-up: combined equity in Portfolio (EQP-1)

- **Core:**
  - `portfolio_equity.py`: a grid at the coarsest interval, carry-forward,
    and each track's change from its own deposit.
  - The combined drawdown is a range: the observed lower bound uses the
    interval highs; the conservative bound uses the summed lows.
  - Also: daily loss, margin level, and clock/interval findings.
  - Tests: a hand-worked two-track range (50 against 150), carry-forward
    with margin, intervals, a missing-log refusal, an end-to-end run on two
    logged reports, and the note.
  - Fixed on the way: an empty identity component when no stop-out level
    is set, and a test folder that needed its parents created.
- **Plugin:**
  - The section, the chart, and the labelled guidance.
  - Harness-checked on Core output from two logs with lows at different
    moments (201 to 350 USD).
  - Wording tightened after the check: "larger than any track" is claimed
    only on the observed value, and the realised-against-equity sentence
    is neutral.
- **Tests:** Core 302; plugin 153.

## Follow-up: cost breakdown (COST-1)

- **Core:** `cost_breakdown.py` over the canonical events; the Core returns
  the commission and swap totals, so the plugin does no arithmetic.
- **Real data:** read-only run on the dev vault's 10 reports.
  - All reconcile to the cent.
  - Opening commissions equal closing commissions where commission is
    charged.
  - A net swap credit (USDJPY, CADCHF) produced a negative "cost share",
    now suppressed and worded as a credit.
- **Plugin:**
  - The widget, the step chart, the guidance (including a tip for when
    swaps cost more than commissions), the Overview tile note, and record
    to note.
  - Harness-checked on the real TRL_V3b report.
- **Tests:** Core 308; plugin 160.
