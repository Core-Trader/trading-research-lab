# Baseline Input Manifest — MT5 Excel Reports

**Status:** Intake evidence recorded; manual approval remains required.  
**Captured:** 2026-09-20  
**Importer target:** The observed RoboForex MT5 Strategy Tester Excel-report layout only.

## Terminal environment

| Item | Recorded value | Verification |
| --- | --- | --- |
| Terminal executable | `C:\RoboForex MT5 Terminal\terminal64.exe` | File present |
| Portable invocation | `"C:\RoboForex MT5 Terminal\terminal64.exe" /portable` | Owner supplied; path verified |
| MetaEditor executable | `C:\RoboForex MT5 Terminal\metaeditor64.exe` | File present |
| MQL5 data directory | `C:\RoboForex MT5 Terminal\MQL5` | Directory present |

The application does not require the terminal to import these saved reports. The portable path is retained as provenance and for later controlled-export verification.

## Immutable source identities

| Workbook | SHA-256 | Symbol | Expert | Test period |
| --- | --- | --- | --- | --- |
| `CADCHF_2025.xlsx` | `E815A5AD4A0B9342133FB418801828612B37D133B0CCE3015A6867E7ED911371` | CADCHF | EA_DCA_CENT_V1 | H4, 2025-01-01 to 2026-01-30 |
| `EURUSD_2025.xlsx` | `63E3D6C6737E577F1EF6335E731E74A305BCA9060D420592241F4E66DC90A523` | EURUSD | EA_DCA_CENT_V1 | H4, 2025-01-01 to 2026-01-30 |
| `GBPUSD_2025.xlsx` | `F37C372865A4306596AB7C794C814014B2692E413D132CBF2121AFE0A613B02E` | GBPUSD | EA_DCA_CENT_V1 | H4, 2025-01-01 to 2026-01-30 |

All three reports identify the test company as RoboForex Ltd, account currency as USD, initial deposit as 15,000.00, leverage as 1:1000, and history quality as `100% real ticks`.

## Observed report layout

Each workbook has one worksheet, `Sheet1`, with no worksheet formulas found. The relevant sections are named `Settings`, `Results`, `Orders`, and `Deals`. The `Deals` table provides the first-adapter source fields:

```text
Time | Deal | Symbol | Type | Direction | Volume | Price | Order |
Commission | Swap | Profit | Balance | Comment
```

The first deal is a `balance` row. Trading rows use `Type` such as `buy`/`sell` and `Direction` `in`/`out`. The initial importer will use the Deals table as the evidence source. The Orders table is retained for cross-reference only because its sampled price values are zero and its volume field is a display string such as `0.01 / 0.01`.

## Source summary totals

| Report | Net profit | Total trades | Total deals | Balance DD maximal | Equity DD maximal |
| --- | ---: | ---: | ---: | --- | --- |
| CADCHF | 209.33 | 83 | 166 | 48.73 (0.32%) | 237.58 (1.57%) |
| EURUSD | 166.99 | 60 | 120 | 26.54 (0.17%) | 44.92 (0.30%) |
| GBPUSD | 213.89 | 64 | 128 | 48.32 (0.32%) | 152.33 (1.00%) |

These are source-reported reference values. They are not yet a successful importer reconciliation.

## Accounting observation

The source uses signed cash components. In the sampled EURUSD deal record, Profit is `8.10`, Swap is `-0.20`, Commission is `0.00`, and balance rises from `15,010.35` to `15,018.25`; the 7.90 change equals `8.10 + 0.00 - 0.20`. Therefore the baseline canonical convention is:

```text
net realised P/L = gross profit + commission + swap + cash adjustments
```

This conclusion applies to the observed report layout. The importer must test it across every source row and flag exceptions.

## Known limitations and blockers

- Timestamps are displayed without an explicit timezone. They cannot support an approved daily-drawdown result until the owner confirms the applicable broker/server or research timezone and daily reset time.
- Deals provide event-time balance but not enough intratrade marks to independently reconstruct every equity high/low. Initial equity reconciliation is therefore `NOT_COMPARABLE` unless another approved mark source is supplied.
- The report uses three different independently tested symbols. Their shared-account replay will be a new simulation, not a historical MT5 account result.
- Margin calculations and any cross-currency conversion must remain unavailable until their exact source semantics are specified and tested.

## Manual review required before Step 3

- [ ] Confirm the three report copies are approved for local development retention.
- [ ] Confirm the expected account baseline: USD 15,000.00, leverage 1:1000.
- [ ] Confirm the source timestamp timezone and intended daily reset time, or approve deferring daily-drawdown output.
- [ ] Confirm whether the shared replay should begin with all three reports or use EURUSD as the first single-report reconciliation fixture.
- [ ] Confirm that the source-reported totals above match the reports as you view them in MT5/Excel.

## Recommended Step 3 scope

Implement and test a read-only adapter for this specific Excel layout. Begin with `EURUSD_2025.xlsx` as the narrow reconciliation fixture because its sampled deal records clearly show opening/closing events and a signed swap. Expand to CADCHF and GBPUSD only after the adapter reproduces EURUSD completed-deal cash totals and counts.

## Approved owner decisions (2026-09-20)

- Retention: the approved report copies may remain in `data\raw` for local development.
- Baseline account: USD 15,000.00 and leverage 1:1000.
- First reconciliation fixture: `EURUSD_2025.xlsx`.
- Daily drawdown: calculation-policy semantics are now approved as `ftmo-reference-daily-loss-v0.1`, using a Prague-midnight reset; output remains deferred because the current source timestamps have no verified timezone mapping. See `docs/15_FTMO_REFERENCE_DAILY_DRAWDOWN_POLICY.md`.
- Source reference totals: approved as the current baseline evidence.

See `docs/12_JPY_AND_OPTIMIZER_REFERENCE.md` for the subsequent USDJPY precision and multi-symbol optimizer reference evidence.
