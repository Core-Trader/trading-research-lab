# JPY Precision and Multi-Symbol Optimizer Reference

**Status:** Read-only reference evidence. It expands the future import contract but does not widen Step 3 implementation scope.

## USDJPY Strategy Tester report

| Field | Observed value |
| --- | --- |
| File | `USDJPY_2025.xlsx` |
| SHA-256 | `6800A706159CD9F5B110377BF3F3B09401A2F91363C913AF0D2CB956DAA06D17` |
| Symbol | USDJPY |
| Expert | EA_DCA_CENT_V1 |
| Period | H4, 2025-01-01 to 2026-01-30 |
| Currency / deposit / leverage | USD / 15,000.00 / 1:1000 |
| Total net profit | 244.92 |
| Total trades / deals | 76 / 152 |
| Equity drawdown maximal | 404.36 (2.68%) |

### Precision finding

The `Deals` price cells use the report display format `0.000`. Sample values are `158.425`, `158.552`, `157.951`, and `158.123`. The apparent number of decimals in a stored numeric value may vary because trailing zeros are not significant in a number; the display-format scale is three.

**Approved design rule:** parse prices as decimals and retain source precision metadata. Do not hard-code a five-decimal FX convention or derive precision from a hard-coded list of JPY symbols. The USDJPY fixture becomes a mandatory importer regression test.

## Optimizer report

| Field | Observed value |
| --- | --- |
| File | `ReportOptimizer-52010662.xml` |
| SHA-256 | `34813334B4685DBF1486AFDEBE02AE37E298EC1A6374A79C89AA110C3E46355F` |
| XML worksheet | `Tester Optimizator Results` |
| Server / deposit / leverage | RoboForex-Pro / 15,000 USD / 1000 |
| Table columns | Symbol, Pass, Result, Profit, Expected Payoff, Profit Factor, Recovery Factor, Sharpe Ratio, Custom, Equity DD %, Trades |
| Summary rows | 7 |
| Symbols represented | USDJPY, CADCHF, GBPUSD, USDCHF, USDCAD, AUDUSD, EURUSD |

The XML title names `EURUSD,H4`, while the results table contains seven symbols. The report is therefore evidence of a multi-symbol optimization output, but its title alone does not establish the exact Market Watch selection or explain whether any selected symbols produced no output.

### Boundary

This XML contains optimization summary metrics only. It does not contain trade/deal events, timestamps, balance history, or marks. It may later be imported as an `OptimizerResultSet` for comparison and selection research; it must be rejected as input to the event replay engine.

## Manual review required

- [ ] Confirm that the optimizer was run using the intended `all symbols selected in Market Watch` option and state whether the seven result rows are the complete expected universe.
- [ ] Confirm whether USDCHF, USDCAD, and AUDUSD should be collected as individual Strategy Tester reports for later portfolio replay.
- [ ] Confirm whether the initial product needs optimizer-summary import in its first post-replay phase, or whether this XML remains reference-only until then.

## Step 3 remains narrow

The approved first implementation target remains the single-report EURUSD Excel Deals adapter. USDJPY is added as a precision regression fixture after the EURUSD cash reconciliation passes. The optimizer XML is not part of Step 3 code.
