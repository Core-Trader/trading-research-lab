# Step 3 — MT5 Excel Deals Importer

**Status:** Initial implementation complete; awaiting owner review.  
**Objective:** Implement a narrow, read-only Python adapter for the observed MT5 Strategy Tester Excel Deals layout, prove it with tests, and reconcile EURUSD completed-deal cash totals.

## Included

- `openpyxl` read-only loading of `.xlsx` reports
- Source SHA-256 and byte-count provenance
- Required Settings extraction
- Strict Deals-header validation
- Decimal-safe Deal records, including source-signed commission/swap/profit values
- Source price-scale metadata
- Unit tests for signed cash and three-decimal JPY prices
- Read-only command-line import summary

## Excluded

- SQLite persistence, API, React UI, replay engine, margin, equity-mark reconstruction, daily drawdown, optimizer XML import, and MT5 terminal automation

## Acceptance evidence

1. Synthetic tests pass without relying on proprietary report files.
2. EURUSD imports successfully with its recorded SHA-256, 121 source rows (one opening-balance row plus 120 trading deals), opening balance 15,000.00, and completed-deal cash total reconciling to the source net profit 166.99.
3. USDJPY imports without binary floating-point use and reports three-decimal source price scale.
4. Invalid or changed Deals headers fail clearly rather than being guessed.

## Manual review gates

- [ ] Review the initial code diff before Git is initialized or any remote is configured.
- [ ] Confirm the EURUSD import summary and reconciliation totals against the source report.
- [ ] Confirm that no future use of report timestamps treats them as timezone-aware until the deferred policy is approved.
- [ ] Approve beginning the next scope only after all acceptance evidence is recorded.

## Evidence recorded

The synthetic test suite passes. Read-only EURUSD import produced 121 source rows, 120 trading deals, USD 15,000.00 opening balance, and 166.99 net trading cash change. Read-only USDJPY import produced three-decimal source price scale and 244.92 net trading cash change. `openpyxl` reports that the source workbooks lack a default style; this is a non-blocking style warning, because the required cell values and number formats are available and preserved.
