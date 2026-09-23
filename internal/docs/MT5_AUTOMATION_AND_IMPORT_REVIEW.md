# MT5 automation and import review (2026-09-23)

**Inputs:**
- the owner's `internal/playbooks/MT5_BACKTESTING_BEST_PRACTICES.md`
  (moved from the repository root)
- the pinned Journalit reference (commit `098d277`), import pipeline only
- a read-only inspection of the owner's portable MT5 terminal

**Status:** analysis only. No code was reused and no terminal has been
launched.

## 1. Best practices mapped to TRL

| Best-practice item | TRL today | Action |
| --- | --- | --- |
| §2 A stale `.set` silently differs from the `.mq5` compiled defaults | TRL imports `.set` as the schema and default. Single-test attach checks every report input against the `.set` (FIXED_INPUTS_DIFFER). | **Candidate feature (MX-1):** import the EA `.mq5` and diff its `input` defaults, including enums, against a `.set`, reporting every difference without judging. |
| §3.2 Verify that the report's own Settings show the intended values | The single-test attach checks inputs. Plain report intake does not compare against an intended `.set`. | Covered by MX-1 plus the report-vs-`.set` check. |
| §3.3 `Model=4` vs `Model=1` change results | The modelling mode is user-declared for optimisations. | Keep. The backtest agent defaults to `Model=4`. |
| §3.6 Verify the authorised account and server | The HTML report's header carries the server and build ("FTMO-Server4 (Build 6182)"); not yet in the receipt. | **Small follow-up (MX-2):** record the report's server line and company in `supplied_facts` for `.xlsx` and HTML. |
| §4 Genetic may evaluate the full grid on small grids | Studies report passes out of the full grid. The neighbourhood coverage adapts. | None. |
| §5 One in-sample window is not validation | Forward pairing, with periods compared. | None. |
| §5 Balance lies by omission (equity) | Realised-balance caveats everywhere. PL-006 (equity logger) is planned. | Keep PL-006 ahead of prop-firm checks. |
| §5 Cliffs near the optimum | Neighbourhood analysis, a targeted `.set`, and "Slow complete" runs (PX-010). | Done. |
| §5 Fixed-parameter walk-forward over sequential windows | M5 chaining joins consecutive reports; there is no per-window consistency view. | **Candidate feature (MX-3):** a per-window (e.g. half-year) consistency table for one fixed configuration. |
| §5 A Monte Carlo that parses only Profit excludes swap and commission | TRL's Monte Carlo resamples close-event `net_pnl` (profit + commission + swap). | Already correct; state it in the Monte Carlo caption. |
| §5 Correlation is not diversification; measure the combined curve | Portfolio Lab combines and measures directly; the correlation wording is neutral (PL decisions). | None. |

## 2. Journalit import pipeline (concept review, no reuse)

- **Architecture:** a local plugin UI over a **remote Journalit API**:
  `POST /api/v1/trade-import/analyse`, then `/preview`, then
  `/{importId}/commit`. MetaTrader (broker id `METATRADER`, with the legacy
  id `JDR` migrated) and csv/xlsx/xls/html parsing happen **server-side**.
  There is no local MT5 parser to reuse, and TRL's no-network rule excludes
  the approach anyway.
- **Patterns worth adopting as TRL-owned concepts:**
  1. **Preview before commit, with classifications** such as new,
     exact_duplicate, already_applied, likely_duplicate, conflict, and
     failed_*, each with a default action (create, skip, manual review, or
     blocked). **Candidate (MX-4):** a batch-import preview listing each
     file as new, identical to a library report, archived (restore), the
     same deals as another report, or blocked with its reason, before
     anything is written.
  2. **A capabilities contract**: file types, limits (bytes, rows, columns),
     and adapters with versions. TRL's `core.capabilities` could list its
     importers and versions (MX-5, small).
  3. **Row-level diagnostics** (severity, code, row, field) instead of one
     error string. Fits TRL's CoreError details (part of MX-4).
  4. **An import timezone.** Journalit silently uses the OS timezone. TRL
     keeps the source clock and must *declare* the zone for sources that
     need it (TradingView, deferred).
  5. **Local column-mapping templates** (header row, delimiter, date format,
     field mappings, and share codes) for generic CSV brokers. Deferred with
     TradingView and generic CSV.
- Recorded in `internal/references/REFERENCE_REGISTER.md` as a concept
  review. The code-usage register is unchanged.

## 3. Terminal inspection (read-only)

- `C:\FTMO Global Markets MT5 Terminal\` is a portable install, build 6182.
  It was not running at the time of inspection.
- **Algo trading is disabled** (`[Experts] Enabled=0`), and **no chart in any
  profile has an EA attached.**
- The stored account is `540291482` on `FTMO-Server4`. The account type
  (free trial or demo, challenge, or funded) is **unknown**, so the owner
  must confirm it.
- The terminal is shared with other projects:
  - `MQL5\Profiles\Tester` holds 20+ presets (DCA, RangeBreakout, and
    others)
  - there are several EA folders and an `llm-agent` folder
- MT5's example EAs are present: `Examples\Moving Average`,
  `Examples\MACD\MACD Sample`, `Advisors\Expert*`, and `Free Robots\*`.

## 4. Backtest agent (DEV-001): proposed operating rules

The backtest agent is a separate agent, launched at my request, following
the playbook literally:

- **One instance only.** Check `ps aux | grep -q "[t]erminal64"` before
  every launch and never launch while the owner has the terminal open.
- **Namespacing.** Presets are copied as `TRL_<case>.set` into
  `MQL5\Profiles\Tester\`. EAs written for the corpus go in
  `MQL5\Experts\TRL_Corpus\`. Other projects' files are never touched.
- **Config files** are written with literal all-backslash paths, and the
  terminal runs in the foreground: `terminal64.exe /portable /config:<ini>`.
- **Compilation** uses `MetaEditor64.exe /portable /compile`, run through
  `Start-Process -Wait`.
- **Every run is verified:**
  1. the report file exists under the exact `Report=` name
  2. the report Settings show the intended symbol, dates, and inputs
  3. the log shows the intended account authorised
- **Outputs:**
  - reports go to `data/raw/corpus/<case>/` (git-ignored), with a
    `CORPUS_MANIFEST.md` row per case (the purpose and the exact `.ini` and
    `.set` used)
  - `.ex5` binaries are never committed
- **No live trading, ever.** Only `[Tester]` configs are used, and the agent
  never changes `[Experts]` settings.

### First corpus (from the earlier wish list)

| Case | EA | Purpose |
| --- | --- | --- |
| C1 | Moving Average, EURUSD H1, 2024, single test, `.htm` report | HTML baseline from the MT5 example EA |
| C2 | Same, with the terminal language set to Portuguese | Localisation risk (needs the owner to switch the language, or skip it) |
| C3 | Moving Average, 2 inputs × 6 values, `Optimization=1` | Dense grid: neighbourhood statistics everywhere |
| C4 | Same, with a built-in forward period (`ForwardMode`) | Forward pairing with full overlap of settings |
| C5 | MACD Sample on 3 sequential windows | Portfolio union and common windows, M5 chaining, MX-3 |
| C6 | Moving Average on 3 symbols (`Optimization=3`, a symbol sweep) | Multi-symbol corpus |
