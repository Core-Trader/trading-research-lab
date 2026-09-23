# 2026-09-23 — MT5 equity logger and adapter (PL-006 / PL-008)

The owner approved E1–E7 as recommended, and E8 = yes (a logged copy of the
owner's DCA EA may be used).

## Built

- **`mql5/Include/TRL_EquityLogger.mqh`** (now 1.0.1), shipped in releases
  under `mql5/Include`, with the help page `product-docs/EQUITY_LOGGER.md`.
  It runs in tester single tests only and writes to `Common\Files\TRL\`
  without overwriting and without the login. Each interval row carries the
  tick-level min and max equity plus the last tick's state, and there is a
  row per balance change.
- **`equity_log.py`**:
  - `dataset.attach_equity_log` snapshots the CSV and links it to its report
    by metadata, the balance after every logged `deals_total` (offset 0 or
    1), and the final balance, accepting MT5 end-of-test closes.
  - Cross-check against MT5's Equity Drawdown Maximal: a log deeper than
    MT5's figure is a NOTE; a shallower one is a WARNING.
  - Stores `MT5_TESTER_LOGGED` equity, and adds registry evidence.
  - `analysis.equity_metrics`: maximum equity drawdown, daily equity loss
    (report-clock midnight; the start-of-day reference is the higher of
    balance and equity at the previous sample; ties resolve to the earliest
    day), and a bounded display series that keeps each bucket's extremes.
  - `equity_availability` reports AVAILABLE when a verified log exists.
- **Plugin:** the equity panel on the Analysis page:
  - attach a log with a declared modelling mode
  - equity drawdown vs MT5 vs realised balance, calling out the gap
  - the worst day
  - a balance and equity chart with a min–max band
- Tests: 12 Core tests and 2 plugin model tests. The corpus check now parses
  equity logs: 39/39 files parse.

## Validation (backtest agent, owner's portable FTMO MT5, build 6182)

**Run 1 (logger 1.0.0):**
- It compiled with 0/0 errors and warnings, first time.
- The logger does **not** change trading. V1 and V2 were identical to corpus
  C1 and C6a on every deal. V3 was identical to an unlogged control run of
  the same DCA source.
- **All three logs were BLOCKED by TRL's link check.** This was correct:
  `HistorySelect(0, TimeCurrent())` misses deals stamped at the current
  second, so `deals_total` lagged the balance when a close and an open
  happened on one tick. There were also a late `equity_close`, a spurious
  first row, and 7–8 MB per year.

**Run 2 (logger 1.0.1):**
- The future bound on `HistorySelect`, last-tick row state, and skipped
  empty or flat intervals fixed it.
- 0 mismatches in 44 170, 46 144, and 29 453 rows. The files are 40–62%
  smaller.
- Trading is still unchanged.

**TRL attach (all LINKED_VERIFIED, no findings):**

| Case | Equity DD (log) | MT5 Equity DD Max | Balance DD | Worst equity day |
| --- | --- | --- | --- | --- |
| V1 MA EURUSD H1 2024 | 1 167.80 (11.51%) | 1 167.79 | 1 067.16 | 2024-08-20: 222.74 (2.23% of initial) |
| V2 MA GBPUSD H1 2024 | 1 516.23 (14.90%) | 1 513.01 | 1 372.87 | 2024-04-23: 184.11 (1.84%) |
| V3 owner's DCA EURUSD H4 2025 | 97.14 | 96.89 | 7.80 | 2026-01-19: 93.41 |

- On the DCA EA, equity drawdown is **12.5×** the realised-balance
  drawdown: the PL-006 risk, now measured with evidence.
- The logger's lows are equal to or deeper than MT5's summary figure (MT5 can
  miss tick lows).
- The owner's baseline was reproduced trade for trade. Only swap differs, by
  about 0.01 on 29 rows (+1.42 overall), most likely because FTMO's swap
  rates changed since the baseline ran.

## Next

The prop-firm rules module on top of daily and overall equity, including the
conservative combined portfolio low (E6), which is still to build in Portfolio
Lab. Owner review of the equity panel in Obsidian.
