# Trading Research Core

The local Python calculation authority for Trading Research Lab. It is deliberately
separate from the Obsidian plugin and communicates over UTF-8 NDJSON on standard
input/output.

## Milestone 0 contract

- Python `3.14.x` is required; do not use a lower version as a project substitute.
- `stdout` is reserved exclusively for one protocol response per line.
- `stderr` is reserved for diagnostics.
- MT5 input files are read-only source evidence. Canonical Parquet data is written
  only below the worker workspace supplied at launch.
- The M0 import supports the observed MT5 Strategy Tester `.xlsx` Deals layout.
- The M0 chart series is a verified reported-balance series. MT5 exports do not
  provide enough mark-to-market information to reconstruct intratrade equity, so
  equity is reported explicitly as unavailable.

## Developer commands

After Python 3.14.7 has been installed and selected:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m pytest
```

The dependency lock is intentionally deferred until that exact interpreter is
available. See `../internal/docs/ENVIRONMENT_AND_DEV_VAULT.md`.
