# Claude Code Handoff — Trading Research Lab

**Prepared:** 2026-09-20  
**Project root:** `C:\DEV\Trading_Research_Lab`  
**Status:** Step 3 MT5 Excel Deals importer is the only authorized implementation scope. Initial implementation is complete and awaits owner review.

## Current code state

The following files exist and are the complete implemented slice:

```text
pyproject.toml
src/trading_research_lab/__init__.py
src/trading_research_lab/mt5_excel.py
tests/test_mt5_excel.py
```

Verification already performed:

- `python -m unittest discover -s tests -v` — 2 tests passed.
- EURUSD source hash matched the approved manifest; import yielded 121 source rows, 120 trading deals, 15,000.00 opening balance, and 166.99 net trading cash change.
- USDJPY import yielded 153 source rows, 152 trading deals, 244.92 net trading cash change, and source price scale 3.
- Python syntax compilation passed.

The source workbooks emit an `openpyxl` warning that they lack a default workbook style. This is non-blocking for the current importer because it reads values and explicit number formats; do not suppress or reinterpret it without a test and a recorded reason.

## Read first

1. `CLAUDE.md`
2. `docs/01_PROJECT_HANDOFF.md`
3. `docs/04_DATA_MODEL.md`
4. `docs/05_REPLAY_ENGINE_SPEC.md`
5. `docs/06_VALIDATION_AND_DETERMINISM.md`
6. `docs/07_TEST_STRATEGY.md`
7. `docs/11_BASELINE_INPUT_MANIFEST.md`
8. `docs/12_JPY_AND_OPTIMIZER_REFERENCE.md`
9. `docs/13_STEP_3_IMPLEMENTATION_PLAN.md`
10. `docs/15_FTMO_REFERENCE_DAILY_DRAWDOWN_POLICY.md`
11. `docs/16_BROKER_AND_PROP_FIRM_POLICY_ARCHITECTURE.md`

## Product and scope

Trading Research Lab is a local-first research application. The eventual direction is Python backend, React/TypeScript browser UI, SQLite, and deterministic shared-account event replay. Do not build that future architecture now.

The current task is a strict, read-only Python importer for one observed MT5 Strategy Tester `.xlsx` report layout. It reads Settings and Deals records, preserves raw economics and precision, and exposes a small deterministic domain object.

## Source evidence

Raw reports are in `data\raw\` and ignored by Git. Do not rename, alter, or commit them.

| File | Purpose | SHA-256 |
| --- | --- | --- |
| `EURUSD_2025.xlsx` | First cash-reconciliation fixture | `63E3D6C6737E577F1EF6335E731E74A305BCA9060D420592241F4E66DC90A523` |
| `CADCHF_2025.xlsx` | Later same-layout reference | `E815A5AD4A0B9342133FB418801828612B37D133B0CCE3015A6867E7ED911371` |
| `GBPUSD_2025.xlsx` | Later same-layout reference | `F37C372865A4306596AB7C794C814014B2692E413D132CBF2121AFE0A613B02E` |
| `USDJPY_2025.xlsx` | Required price-precision regression fixture | `6800A706159CD9F5B110377BF3F3B09401A2F91363C913AF0D2CB956DAA06D17` |
| `ReportOptimizer-52010662.xml` | Summary-only future reference; never replay input | `34813334B4685DBF1486AFDEBE02AE37E298EC1A6374A79C89AA110C3E46355F` |

All individual reports use USD 15,000.00 and leverage 1:1000. Source timestamps lack an explicit timezone. The FTMO-reference policy uses a Prague-midnight reset, but daily-drawdown output remains unavailable until source timestamps have a verified timezone/DST mapping.

## Non-negotiable financial semantics

- Use `Decimal`, not binary float, for money, volume, and price domain values.
- Source-signed cash convention: `net realised P/L = profit + commission + swap + cash adjustments`.
- EURUSD evidence: 8.10 profit plus -0.20 swap gives a 7.90 balance increase.
- Preserve source price-scale metadata; USDJPY source Deal prices use a three-decimal display format. Never hard-code five decimals for FX.
- The current reports provide Deal-level balance, not intratrade marks. Do not claim equity-drawdown reconstruction.
- The multi-symbol optimizer XML has seven summary rows but no events; reject it as replay input.

## Implementation shape

```text
src/trading_research_lab/mt5_excel.py
  SourceArtifact -> immutable source identity
  Mt5Deal       -> one source Deals row
  Mt5ExcelImport -> settings + deal collection
  import_mt5_excel_report(path) -> parser entry point

tests/test_mt5_excel.py
  synthetic fixture tests for signed costs, three-decimal price scale,
  and changed-header rejection
```

The parser should fail clearly on unsupported format changes. It must not guess alternate header names, timestamps, timezones, cost signs, or missing data.

## Local environment

- Git: installed (`git version 2.55.0.windows.3`); repository has **not** been initialized yet.
- Python: local Python 3.14 with `openpyxl 3.1.5` available.
- Node is present; npm was not found. This is not a blocker because no frontend scope is approved.
- MT5 terminal (reference only): `C:\RoboForex MT5 Terminal\terminal64.exe /portable`; terminal, MetaEditor, and MQL5 directory were verified.

Use:

```powershell
$env:PYTHONPATH = 'src'
python -m unittest discover -s tests -v
python -m trading_research_lab.mt5_excel data\raw\EURUSD_2025.xlsx
```

## Completion criteria for this slice

- Tests pass.
- Read-only EURUSD import has 121 source rows (one balance row plus 120 trading deals), 15,000.00 opening balance, and 166.99 completed-deal cash total.
- USDJPY price scale is three and price values retain decimal semantics.
- The user manually reviews the import output and code diff.
- Update `journal/DEVELOPMENT_LOG.md`, decision log if required, and this handoff when scope/status changes.

## First action after handoff

Do not expand scope. First run the commands above, verify the raw-file hashes against the manifest, and ask the owner to review the code and EURUSD source totals. If approved, write a scoped design/test plan for the next capability; do not silently start a replay engine or frontend.

## Manual decisions still open

- Initialize Git locally and choose whether/when to create a remote repository.
- Connect GitHub only if remote repository/PR/issue/CI workflow is desired. It is optional and not connected.
- Use the verified `roboforex-eet-eest-v0.1` profile for the current Forex reports when calendar-based policy work is later implemented. Add DST-boundary tests and keep US-asset session exceptions separate from timestamp-clock conversion.
- Decide when to collect individual reports for USDCHF, USDCAD, and AUDUSD.

## Safety

Never modify files in `data\raw\`. Never add source reports to Git. Do not invoke the MT5 terminal as part of this importer. Do not change system settings or install dependencies without user approval.
