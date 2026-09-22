# Step 5 — Forensic Position Audit Implementation

## Outcome

Implemented a separately named, test-only forensic copy of the approved frozen
EA and a read-only Python validator for its future audit artifacts. This is
reference-evidence tooling only. It does not change the frozen EA, ordinary MT5
Excel imports, event normalisation, trade pairing, replay, risk calculations, or
the browser UI.

## Files created

| Role | Location |
| --- | --- |
| Frozen source, unchanged | `C:\RoboForex MT5 Terminal\MQL5\Experts\EA-DCA-V1.0\EA_DCA_CENT_V1.mq5` |
| Forensic EA copy | `C:\RoboForex MT5 Terminal\MQL5\Experts\EA-DCA-V1.0\Forensic\EA_DCA_CENT_V1_FORENSIC.mq5` |
| Audit-only include | `C:\RoboForex MT5 Terminal\MQL5\Experts\EA-DCA-V1.0\Forensic\TRL_PositionAuditExport.mqh` |
| Python audit validator | `src/trading_research_lab/forensic_audit.py` |
| Validator tests | `tests/test_forensic_audit.py` |

The frozen source SHA-256 remains:

```text
C1B3E0002D3B2A1B313F0C7A3B4E85948B71993C4662ACEC6D8885B8A74D7237
```

## Forensic-copy behaviour

- `InpEnableForensicAudit` defaults to `false`; no audit artifact is written
  unless the owner explicitly enables it.
- `InpForensicAuditRunId` is required and accepts only letters, digits, hyphens,
  and underscores. Existing files with the same ID are never overwritten.
- At `OnTester`, the copy reads MT5 Deal history, writes one CSV row per Deal,
  writes a JSON manifest, and calculates a SHA-256 of the finished CSV.
- It emits `DEAL_POSITION_ID`, account mode, millisecond Deal time, signed cash
  components, and the approved non-sensitive metadata.
- Trade comments are always omitted. The module neither sends nor changes an
  order or position.
- It writes through MT5 `FILE_COMMON` to the approved relative staging folder
  `TradingResearchLab\forensic\`, then logs the resolved folder path and CSV
  hash in the Tester Journal.

## Verification performed

1. The forensic source was created as a byte-identical copy of the frozen EA
   before the audit-only changes.
2. MetaEditor compiled the forensic copy in the portable MT5 environment with
   **0 errors and 0 warnings**.
3. The Python suite has **9 passing tests**, including forensic CSV/manifest
   validation, SHA-256 mismatch rejection, raw-comment rejection, and
   deterministic binding to a matching hedging MT5 report.

No Strategy Tester run has been launched and no forensic artifact has been
created. An actual run needs owner-selected historical settings and a unique
audit run ID.

## Owner runbook — manual review and action

1. In `C:\RoboForex MT5 Terminal\terminal64.exe /portable`, open Strategy
   Tester and select `EA_DCA_CENT_V1_FORENSIC` from the `Forensic` folder.
2. Use the exact settings, date range, symbol, modelling mode, deposit, and
   `.set` configuration of one known ordinary report. Start with the report you
   want to use as the first pairing reference; do not use an optimization run.
3. Set `InpEnableForensicAudit = true` and choose a new run ID such as
   `eurusd-2025-audit-001`. Do not reuse an ID.
4. Run the single backtest. In the Tester Journal, confirm the success line,
   Deal-row count, CSV SHA-256, and the printed shared staging folder.
5. Review both generated artifacts before moving them. Keep the staging source
   unchanged; copy the selected CSV and manifest into
   `C:\DEV\Trading_Research_Lab\data\raw\forensic\` for retention.
6. From the project `src` directory, validate and bind them to the matching
   regular report:

```powershell
python -m trading_research_lab.forensic_audit `
  ..\data\raw\forensic\position-audit-<run-id>.csv `
  ..\data\raw\forensic\position-audit-<run-id>.manifest.json `
  --report ..\data\raw\<matching-report>.xlsx
```

The command is read-only. It prints the artifact hashes and a deterministic
binding ID; it does not move, alter, pair, or replay data.

## Manual review required before any subsequent scope

1. Run exactly one known, non-optimization reference test using the runbook.
2. Check that the ordinary report and forensic audit agree on account mode,
   symbol, Deal count, relevant Deal IDs, source-signed costs, and final balance.
3. Confirm the staged and retained artifacts contain no raw comments or account
   credentials.
4. Review the validator output and binding ID before authorising the separate
   position-pairing algorithm specification.
