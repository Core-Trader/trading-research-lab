# Active Decision Log

| ID | Decision | Status |
| --- | --- | --- |
| ADR-001 | Obsidian Desktop is the V1 shell | Locked |
| ADR-002 | V1 is desktop-only | Locked |
| ADR-003 | Python 3.14.7 Research Core is the sole calculation authority | Locked |
| ADR-004 | Local subprocess + versioned JSON IPC; no default HTTP/FastAPI | Locked |
| ADR-005 | Parquet + JSON + Markdown/YAML, not default SQLite | Locked |
| ADR-006 | Repository, dev vault, and personal vault are separate | Locked |
| ADR-007 | TypeScript/React/esbuild/npm/Obsidian API plugin stack | Locked |
| ADR-008 | Milestone 0 validates the complete vertical path first | Locked |
| ADR-009 | Personal-first with an entitlement boundary, no commercial system | Locked |
| ADR-010 | Internal development material is private and excluded from releases | Locked |
| ADR-011 | Local-first, zero telemetry, no mandatory network | Locked |
| ADR-012 | Deterministic versions/manifests/seeds are required | Locked |
| ADR-013 | Raw source is immutable with provenance | Locked |
| ADR-014 | Dependencies require compatibility and licence review | Locked |
| M2-POL-001 | Regular MT5 Excel supports only source-verified close events by default; optional inferred lifecycles require a displayed `USER_SUPPLIED` `HEDGING` declaration | Approved for M2 |
| M2-POL-002 | Inferred M2 pairing uses `mt5-excel-hedging-fifo-v1`: chronological FIFO within identical symbol and direction, Decimal allocation, and quality-separated presentation | Approved for M2 |
| M2-ACC-001 | M2 implementation and manual Obsidian review accepted; Milestone 2 closed | Closed |
| M3-POL-001 | Source-reported-clock analysis is the default; optional broker-time profiles are used only when a user selects a conversion or policy-specific calendar | Approved for M3 |
| M3-POL-002 | Basic M3 daily drawdown is realised-balance-only; intratrade equity is unavailable without timestamped floating-P/L/mark evidence | Approved for M3 |
| M3-POL-003 | Broker- and prop-firm-specific rules are deferred as optional versioned overlays | Approved for M3 |
| M3-ACC-001 | M3 implementation and manual Obsidian review accepted; Milestone 3 closed | Closed |
| M4-POL-001 | M4 creates only explicit strategy/experiment/report documents with UUIDv7 identities and explicit relationships; it does not scan or infer unrelated vault content | Approved for M4 |
| M4-POL-002 | Report regeneration is change-aware: unchanged managed content makes no write/revision and returns `NO_CHANGES_DETECTED`; changed content requires confirmation and increments the revision manifest | Approved for M4 |
| PL-001 | Portfolio Lab (concurrent single-account combination of EA backtests) is the primary multi-import workflow and part of the MVP; M5 sequential preflight becomes the step that chains one EA's consecutive reports into a track | Approved 2026-09-22 |
| PL-002 | Each track contributes only during its own active period (union window), with an "active tracks" band and an optional common-window view | Approved 2026-09-22 |
| PL-003 | The combination explorer may enumerate and plot all subsets (bounded) with an optional Pareto overlay; descriptive only, no "best" label. This relaxes no-selection for portfolio membership only, not for EA parameters | Approved 2026-09-22 |
| PL-004 | Combined starting capital is declared by the user per combination (`USER_SUPPLIED`) | Approved 2026-09-22 |
| PL-005 | v1 combines trades as reported: no weights, lot rescaling, or margin simulation | Approved 2026-09-22 |
| PL-006 | An equity evidence source (MQL5 tester logger + adapter) precedes the prop-firm module; any realised-balance-only prop check is labelled an optimistic preview | Approved 2026-09-22 |
| PL-007 | Saved Portfolio combinations persist as setups only (tracks, capital, period, name) in the worker workspace `portfolio-combinations/`; results are always recalculated by the Core on load, and an unrecalculable setup is shown with its error | Implemented 2026-09-23; owner review pending |
| MVP-R1 | Owner review of the Portfolio and Parameters pages: OK. Follow-ups: numbered tracks (done); the stagnation shading explained with a visible legend (done) | Owner 2026-09-23 |
| PX-008 | Multi-XML parameter studies are deferred (POST-MVP); collect forward data with MT5's built-in forward period instead | Owner 2026-09-23 |
| PX-009 | Draft the neighbourhood-analysis spec (`PARAMETER_NEIGHBOURHOOD_SPEC.md`, decisions N1–N7 pending) | Owner 2026-09-23 |
| R-D | Release decisions R-D1 to R-D4 (licence, Python distribution, notices, channel) and the clean-machine install check are deferred | Owner 2026-09-23 |
| PX-010 | Neighbourhood analysis N1–N7 accepted as recommended. This amends PX-007: TRL may write a new neighbourhood `.set` (never overwriting). | Owner 2026-09-23 |
| DS-001 | The report library uses **archive**, not removal: archived reports are hidden from the library and pickers but nothing is deleted, and their users (saved combinations, studies) keep working. They are listed under "Archived reports" with Restore, and re-importing a report restores it. Permanent deletion is not offered. | Owner 2026-09-23 |
| UIX-1 | UI/UX pass approved in full (D1 legacy Advanced viewers become a link to Parameters; D2 Lucide via `setIcon`; D3 diagnostics behind a setting; D4 the Core interpretation facts; D5 the seed stays visible). Guidance text comes only from Core fields; missing data is flagged. | Owner 2026-09-23 |
| NAV-1–3 | TRL navigation panel in Obsidian's left sidebar (grouped pages plus a current-report card with quick actions). The top tab strip is replaced by a compact page header with a Pages switcher and a Sidebar button. There is one command per page. Pages as separate tabs (NAV-4) is deferred. | Owner 2026-09-23 |
| HELP-001 | An in-plugin **Help & downloads** page saves `TRL_EquityLogger.mqh` and a TRL-authored example EA (`TRL_EquityLogger_Example.mq5`; it compiles 0/0 in build 6182) to an MQL5 folder or any folder, never overwriting. **No `.ex5` is shipped:** the logger is an include with no standalone binary, EAs should be compiled in the terminal that runs them (playbook §1), and a shipped binary cannot be inspected. The owner asked for `.ex5`; this is a deliberate deviation with that reason. | Owner request 2026-09-23 |
| UX-002 | The Data page is split into steps: 1. Browse and **validate** the report (or use a library report), with nothing analysed yet. 2. Optional companion files, each checked against the report: the equity log, and a `.set` compared input by input with the inputs the report ran with. 3. **Start analysis**, which states where results appear. The typed-path analyse box is removed. All charts share one frame with an Expand (full-screen) toggle; the equity section is collapsible like its neighbours, with the balance chart's axes, size, and hover. | Owner feedback 2026-09-23 |
| PL-008 | The equity logger spec (E1–E8) is approved: a `TRL_EquityLogger.mqh` include (EAs with source), interval rows with tick-level min/max, logs linked to their report by balance after every deal, a warning-only cross-check against MT5's equity drawdown, a conservative combined portfolio low, the include shipped with the product, and validation on a logged copy of the owner's DCA EA. | Owner 2026-09-23 |
| DEV-002 | The first MT5 test corpus is built (`data/raw/corpus`, git-ignored) and checked by `scripts/corpus_check.py`. It exposed three parser biases from the single-EA evidence, now fixed: the `Inp`-prefix input rule, EA names with spaces, and built-in forward exports misread as overlapping. | 2026-09-23 |
| DS-003 | Reports can also be **deleted permanently**, alongside archiving. A preview lists TRL-managed dependents (saved combinations, study single tests, sequential batches, report data) and linked vault notes (`trl_dataset_id`). The owner chooses to keep or delete linked items; kept is the default. Deleted notes go to Obsidian's trash (recoverable). The original source file is never touched, and every deletion is appended to `registry/deletions.jsonl`. Amends DS-001 ("permanent deletion not offered"). | Owner 2026-09-23 |
| UX-001 | Messages can be dismissed (×) on the Portfolio, Parameters, Neighbourhood, and Data pages. Blocked single-test attempts are reported but no longer stored (they cleared nothing and lingered). | Owner 2026-09-23 |
| DS-002 | MT5 Strategy Tester HTML reports are a supported source (adapter `mt5-strategy-tester-html`), producing the same canonical events as `.xlsx` and verified against the HTML Deals totals row. TradingView and MT4 reports are deferred. | Owner 2026-09-23 |
| DEV-001 | A separate backtest agent may later run MT5 (demo/portable terminal) to build a test corpus; development tooling only, once the owner provides the terminal path and best-practices file. | Proposed 2026-09-23; deferred |
| PROP-0 | Prop-firm rule check spec drafted (`PROP_FIRM_SPEC.md`); decisions P1–P10 pending. UI fixes after the UI/UX pass: sidebar stays left-aligned when pressed, bar hover uses the slot under the cursor, Monte Carlo fan shows paths by default with the 90% band optional. | Drafted 2026-09-24 |
| PX-001 | Parameter sets may carry descriptive Pareto status (feasibility, rank, dominated-by); the owner chooses; no automatic winner. Amends the 2026-09-22 selection deferral along its option 3 | Approved 2026-09-23 |
| PX-002 | Parameter exploration is an Experiment type under a Strategy, with a Core module and a shared `pareto` layer (also used by Portfolio Lab) | Approved 2026-09-23 |
| PX-003 | MVP objectives use MT5-reported metrics (Profit, Equity DD %, Profit Factor, Recovery Factor, Expected Payoff, MT5 Sharpe, Trades); default axes Equity DD % × Profit | Approved 2026-09-23 |
| PX-004 | `.set` files are the MT5-verified parameter schema and default; a single-test Results-summary parser follows | Approved 2026-09-23 |
| PX-005 | Ordinal is inferred from `.set` steps; the owner may mark parameters categorical for neighbourhood purposes | Approved 2026-09-23 |
| PX-006 | Build order: shared Pareto core and scatter, then Portfolio slices 3–4, then parameter exploration | Approved 2026-09-23 |
| PX-007 | The chosen candidate is recorded in the Experiment note only; `.set` export needs a separate decision | Approved 2026-09-23 |

Historical decisions in `journal/` remain evidence but do not override this
reset. Valid domain decisions—such as decimal precision, broker-time provenance,
and optional prop-firm overlays—are retained through the new data/model docs.
