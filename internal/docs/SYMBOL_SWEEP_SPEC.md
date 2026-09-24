# Symbol sweep import: specification (draft for owner decisions)

**Status:** DRAFT 2026-09-24. Nothing is built. S2 (the optional `.set`) is
confirmed by the owner; S1 and S3–S8 are pending.

**Builds on:**
- Research workflow guide step 2 (DOC-001), gap 1
- The M6 optimisation decision package: a multi-symbol table "may be
  supported later as a distinct qualified source type. It must never be
  presented as parameter optimisation."
- PX-001/PX-002 (descriptive Pareto; the owner chooses)
- ADR-005/013 (Parquet/JSON storage; immutable raw snapshots with
  provenance)

## 1. The source (owner files, 2026-09-24)

`data/raw/SYMBOL-SWEEP-1..3.xml` are MT5 "Tester Optimizator Results"
exports (SpreadsheetML) of optimisation mode **"All symbols selected in
Market Watch"** (`Optimization=3`).

**Columns:** `Symbol, Pass, Result, Profit, Expected Payoff, Profit Factor,
Recovery Factor, Sharpe Ratio, Custom, Equity DD %, Trades`.

- There is **no input-parameter column**: every row ran the same fixed
  inputs.
- **Symbol** comes first; the existing optimisation importer expects
  **Pass** first, which is why it rejects these files today.
- The title (`<EA> <symbol>,<TF> <from>-<to>`) names the tester's selected
  chart symbol (CADCHF in all three), **not** the symbols tested.
- **Document properties:** server, deposit, leverage, build, and a
  `Condition` field.
- The **modelling mode** and the **input values** are not in the file (as
  with every MT5 optimisation XML).

| File | EA | Period | Symbols | Trades per symbol |
| --- | --- | --- | --- | --- |
| 1 | EA_DCA_CENT_V1 | H4, 2025.03.01–2026.03.01 | 20 | all > 0 |
| 2 | Jagfx-DCA_V2.0.4 | same | the same 20 | all > 0 |
| 3 | DCA_EA | same | the same 20 | all > 0 |

All three files: RoboForex-Pro, 15 000 USD, leverage 1:1000, 20 forex
symbols.

## 2. What TRL would do

1. **Import** (`sweep.intake_mt5_symbol_sweep`):
   - Snapshot the file (SHA-256; never edited) and parse the title and
     properties.
   - Keep every metric **exactly as MT5 reported it** (strings, no
     recomputation), and store the rows as Parquet with a manifest.
   - The user declares the modelling mode, as for optimisations.
   - The `.set` that was used can optionally be attached. It is recorded as
     "the declared inputs" and cannot be verified against the sweep, which
     lists no inputs; it is labelled as such.
2. **Checks:**
   - A Symbol column is present, and each symbol appears only once.
   - A file with input-parameter columns is refused as "this is a
     parameter optimisation; use the Parameters page".
   - Rows with 0 trades are kept but marked.
   - Two sweeps are "comparable" only with the same period, timeframe,
     deposit, and leverage; otherwise the comparison lists the differences.
3. **Show one sweep:**
   - A sortable table, plus the trade-off scatter (default axes: Equity DD %
     against Profit) with symbol labels.
   - Optional user constraints (for example Trades ≥ n, Profit Factor ≥ x)
     and the shared Pareto layer's frontier.
   - Nothing is called "best", and every threshold is the user's.
4. **Compare sweeps** (several EAs on the same symbols): a symbol × EA
   matrix for one chosen metric, shaded by value, for example where each EA
   made money and at what drawdown. Rows only in some sweeps are shown as
   "not tested".
5. **Shortlist:**
   - The user ticks symbols. The shortlist and the reasons are recorded in
     the Experiment note, like the parameter choice.
   - The page shows the next step (workflow step 3): a single test per
     shortlisted symbol with real ticks, then import the reports.

## 3. What it does not do

- It does not rank or pick symbols.
- It does not compare metrics across different deposits or periods without
  saying so.
- It does not infer the inputs used.
- It does not treat sweep rows as trades: there are no deals, so there are
  no drawdown curves, prop checks, or Monte Carlo from a sweep. Those need
  the per-symbol single-test reports (step 3).

## 4. Tests (Core)

- **Parse:** the three owner files: 20 rows each, exact metric strings,
  title and properties.
- **Refusals:** a parameter-grid XML sent to the sweep importer, and a
  sweep sent to the parameter importer (a clear message pointing to the
  Symbol scan page); duplicate symbols; a missing Symbol column.
- **Comparability:** same vs different period, deposit, and leverage.
- **Pareto/constraints:** go through the shared `pareto.py`, compared
  against a brute force.
- **Determinism and immutability** of the snapshot.

## 5. Plugin

- A **Symbol scan** page in the sidebar (Research group, first entry),
  holding:
  - import (Browse XML, the modelling mode, an optional `.set`)
  - the table and scatter, constraints, and the compare matrix
  - the shortlist, plus "record in Experiment note"
- The Research workflow guide (step 2) is updated from "MT5 only" to point
  to the page, and gap 1 is removed.

## 6. Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| S1 | A new **Symbol scan** page (Research group), separate from Parameters | **Yes** |
| S2 | A distinct source type `MT5_SYMBOL_SWEEP`: metrics kept as reported, the modelling mode declared, an optional `.set` recorded as declared (unverifiable) | **Yes**; owner confirmed the optional `.set` on 2026-09-24 |
| S3 | Descriptive only: a sortable table, user constraints, and the Pareto frontier on two chosen metrics; no ranking or "best" | **Yes** |
| S4 | A multi-EA compare matrix (symbol × EA) when sweeps share period, timeframe, deposit, and leverage; mismatches are listed, not hidden | **Yes** |
| S5 | The shortlist is recorded in the Experiment note, with the next-step reminder | **Yes** |
| S6 | Rows with 0 trades are kept and marked, never dropped | **Yes** |
| S7 | Sweeps with a Forward period (if MT5 exports one) are deferred until a real export exists | **Yes, defer** |
| S8 | Sweep rows cannot feed prop checks, Monte Carlo, or Portfolio: those need single-test reports | **Yes** |
