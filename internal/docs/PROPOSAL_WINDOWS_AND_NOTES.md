# Proposal: per-window comparison, and research-note access

**Status:** APPROVED and BUILT 2026-09-24 (owner accepted W1–W6 and N1–N6 as
recommended).

**Windows:**
- Core: `windows.py` (`windows-1`), with `windows.split`,
  `windows.separate`, and `windows.render_note`.
- Plugin: an Analysis section, "Same settings over time (windows)".
- A split window is "partial" when the report's own test period (MT5's
  exclusive end date) does not cover it.

**Notes:**
- Plugin only:
  - `vault/research-notes-model.ts` (pure, tested)
  - `vault/research-index.ts` (live index from the metadata cache)
  - `components/research/record-to.tsx` (N1)
  - `components/research/notes-browser.tsx` (N3)
  - the sidebar "Recent research notes" card (N4)
  - name checks in the create and rename dialogs (N5)
- Experiments are written as `trl_schema: 2` with `trl_experiment_kind`.
  Older notes are read as report-analysis when they carry a dataset,
  otherwise as general.

---

## Part A. Per-window comparison (Research workflow step 4, gap 2)

### Why

Playbook §5 asks whether the **same fixed settings** hold up in each
consecutive window, not only in total: "one losing window out of five is a
different risk from none." Today the user compares window reports one by one.

The existing sequential batch (M5) does not fit. It requires each report to
start at the previous one's final balance (`BALANCE_DISCONTINUITY` is
BLOCKED), and separate MT5 window tests each start at the deposit.

### What TRL would do

1. **Two ways in (W2):**
   - **Split one long report:** the user picks one imported report and a
     window length (for example 6 months, from a first date). The Core
     slices its closed trades by date. There are no extra MT5 runs, and the
     settings are identical by construction.
   - **Separate window reports:** the user picks 2–12 imported reports
     (W3). The Core checks the same EA, symbol, timeframe, deposit, and
     inputs (from each report's Settings; a differing `.set` is flagged),
     that they are ordered, and that they do not overlap. Gaps are shown,
     not blocked.
2. **Per-window table, one row per window:**
   - net P/L, profit factor, maximum balance drawdown, trades, win rate,
     expectancy, and SQN
   - equity drawdown when the window's report has an equity log
   - every value is Core-computed on the existing close-event basis
3. **Summary:**
   - windows profitable out of the total
   - the worst window and its result
   - the spread of net P/L across windows (min / median / max, nearest rank)
   - windows below your own thresholds (W4)
4. **Chart:** net P/L per window as bars, with the drawdown per window
   alongside.
5. **Record:** "Windows checked" goes into the Experiment note.

### Limits (sourced or labelled)

- **Sourced:** fixed-parameter walk-forward (playbook §5).
- **User-defined:** the window length, the number of losing windows
  accepted, and the minimum trades per window. No published number applies.
- **Split mode:**
  - a position open across a window boundary counts in the window where it
    closes
  - each window's drawdown is measured from that window's start
  - both points are stated on the page

### Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| W1 | Where: a **Windows** section on the Analysis page (for the current report's split), plus report picking from the library for separate reports | **Yes**, no new page |
| W2 | Both inputs: split one long report (the default) and separate window reports | **Yes** |
| W3 | Separate reports: 2–12 windows; same EA, symbol, timeframe, deposit, and inputs required; overlap blocked; gaps shown | **Yes** |
| W4 | Thresholds (losing windows allowed, minimum trades per window) are the user's own, shown as filters; no default numbers | **Yes** |
| W5 | Split mode counts trades in their closing window and measures drawdown from each window's start | **Yes** |
| W6 | Record "Windows checked" in the Experiment note | **Yes** |

---

## Part B. Research-note access (the owner's feedback, 2026-09-24)

### Problems seen

1. **Recording needs an Experiment:** the Symbol scan, Parameters, and
   similar record panels need one, but today one can only be made on
   Research notes, after loading and analysing a report, creating a
   Strategy, then an Experiment.
   - This is because an Experiment is bound to one report analysis
     (`trl_dataset_id`, `trl_analysis_run_id`, M4).
   - A symbol sweep or a parameter study has no such analysis.
2. **Selecting an existing note:** it has to be the active editor note ("Use
   current note as…").
3. **Existing notes are invisible in TRL:** existing Strategies,
   Experiments, and Reports appear only in Obsidian's file explorer, which
   leads to conflicting or duplicate names.

### Suggested changes

1. **"Record to" picker in every record panel (N1)**, covering Symbol
   scan, Parameters, and Prop-firm check notes:
   - a dropdown of **compatible** Experiments
   - "New experiment…", created inline (name plus Strategy; the Strategy can
     also be created inline)
   - "Open" to jump to the note
2. **Experiment kinds (N2)**, via a `trl_experiment_kind` frontmatter
   field:
   - `report-analysis`: today's kind, bound to a report analysis
   - `symbol-scan`: records sweep refs
   - `parameter-study`: records the study ref
   - `general`: not bound to any source
   - existing notes are read as `report-analysis` (`trl_schema: 2`,
     backward compatible)
   - **"Compatible":** the same kind with a matching source, or `general`
3. **Research notes browser (N3)** on the Research notes page:
   - a tree of Strategy → Experiments → Reports, built from notes that carry
     TRL frontmatter (`trl_type`)
   - search by name, filter by kind and status
   - actions: open, select, rename (Obsidian's rename, so links update)
   - notes without TRL frontmatter are never read or listed (N6)
4. **Sidebar card (N4):** a "Recent research notes" block in the TRL sidebar
   with the 5 most recently changed TRL notes and a link to the browser.
5. **Duplicate names (N5):**
   - the create dialogs show existing names of that type as you type
   - an exact name clash is blocked with a suggested alternative, as
     today's "will not overwrite"
   - a near clash (differing only in case or spacing) is warned

### Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| N1 | A "Record to" picker, with inline "New experiment…", in every record panel | **Yes** |
| N2 | Experiment kinds (`report-analysis`, `symbol-scan`, `parameter-study`, `general`); `trl_schema: 2`; old notes read as `report-analysis` | **Yes** |
| N3 | A Research notes browser (tree, search, filters, open/select/rename) on the Research notes page | **Yes** |
| N4 | A "Recent research notes" card in the TRL sidebar | **Yes** |
| N5 | The create dialogs list existing names, block exact clashes, and warn on near clashes | **Yes** |
| N6 | Policy: TRL lists only notes with TRL frontmatter (`trl_type`), reading their frontmatter through Obsidian's metadata cache. This amends M4-POL-001 ("does not scan unrelated vault content"), and still never reads other notes. | **Yes** |

### Suggested order

1. N5 and N3 (visibility, no schema change).
2. N2 and N1 (removes the analysed-report prerequisite for recording).
3. N4.
