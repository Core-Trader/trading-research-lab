# 2026-09-23 — Report archive (DS-001) and MT5 HTML import (DS-002)

Owner decisions:
- Use "archive" with an archived section, instead of removal.
- Move on to MT5 HTML import.
- Defer TradingView and MT4.
- A backtest agent may come later (DEV-001, deferred).

## Archive (DS-001)

- Core `intake.set_archived`, and `dataset.archive` / `dataset.restore`:
  - These set or clear `archived` on the registry entry. Nothing is deleted:
    the snapshot, canonical tables, and users all keep working.
  - `list_registry` returns active `entries` plus `archived_entries`.
  - `dataset_usages` names the saved combinations and parameter-study single
    tests that reference a report (shown in the archive notice).
  - Re-importing restores the report, because the receipt is replaced.
- Plugin: an "Archive" link beside unassigned library rows (you can't archive
  a report that is in a draft track), a collapsible "Archived reports (n)"
  section with Restore, and a notice listing the report's users.
- Tests: 1 Core test (hide, restore, re-import restores, snapshot intact,
  users named, unknown ref) and 1 plugin IPC test.

## MT5 HTML import (DS-002)

- `mt5_html.py`:
  - a stdlib `html.parser` row reader that expands `colspan`, so cells sit at
    the `.xlsx` column positions
  - UTF-16 (BOM or not) and UTF-8 input
  - space and NBSP thousands separators removed from numbers
  - the price scale is taken from the digits shown
- `import_mt5_html` reuses the Excel adapter's settings and deal extraction
  unchanged. The HTML-only totals row at the end of Deals is checked against
  the deals (commission, swap, and profit sums; final balance) and then
  dropped. A mismatch raises `E_SOURCE_INVALID`. The receipt records
  `source_checks` (`HTML_DEALS_TOTALS_MATCH` or `..._ABSENT`).
- Intake:
  - `intake_mt5_report` dispatches on the file suffix. `intake_mt5_excel` is
    kept as an alias, so batch preflight and the old IPC method accept HTML
    too.
  - The snapshot is `raw/<sha>/source.htm`, and the adapter id is
    `mt5-strategy-tester-html`.
  - There is a new worker method `dataset.intake_mt5_report`.
- `read_report_summary` reads HTML too, so single-test attach works with
  HTML reports.
- Plugin: `report-files.ts` (accept list, `isMt5ReportPath`,
  `reportBaseName`) replaces every `.xlsx`-only check and picker.
  `intakeMt5Excel` is renamed to `intakeMt5Report`.
- Tests: 8 Core tests with a synthetic MT5-style HTML generator, covering:
  - the same canonical events as an equivalent `.xlsx`
  - UTF-8 input without a totals row
  - a totals mismatch blocking the import
  - non-reports rejected
  - colspan positions
  - intake, snapshot, and adapter
  - the summary
  - both worker methods

  Plus 1 plugin helper test.
- **Real data:** all 115 MT5 HTML reports in the owner's `EA-DCA-V1.0`
  project (read-only; not copied or committed) import, and every totals
  check matches.
- End to end: a real HTML report imports (117 deals), performance metrics
  compute, and it combines with an `.xlsx` track in Portfolio Lab.
- Totals: 197 Core tests, 70 plugin tests, clean build, release READY
  (35 files).

## Observation (not changed)

On the baseline HTML report, TRL's close-event profit factor is 5.78, while
MT5's reported value is 5.52. This is the existing definitional difference:
TRL uses net P/L per close event, including commission and swap, while MT5
uses gross deal profit and loss. It is not caused by the HTML adapter; the
`.xlsx` path gives the same result.
