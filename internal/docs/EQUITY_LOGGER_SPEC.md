# Equity evidence: MT5 tester equity logger and TRL adapter (PL-006)

**Status:** APPROVED 2026-09-23 (owner accepted E1–E7 as recommended and
E8 = yes). Implementation:
- `mql5/Include/TRL_EquityLogger.mqh`
- `research-core/.../equity_log.py`

Implementation notes:
- File names use the test start date plus a counter, because the end date
  is unknown at init.
- Linking accepts MT5 counting the opening-balance deal or not (offset 0 or
  1, chosen deterministically).
- A final state closed by MT5's "end of test" deals after the logger's last
  row is accepted when the logged final equity equals the report's final
  balance.

**Builds on:**
- PL-006: equity evidence comes before the prop-firm module
- `PORTFOLIO_LAB_RECOMMENDATION.md` §4, option B
- `internal/playbooks/MT5_BACKTESTING_BEST_PRACTICES.md` §5 ("Balance lies
  by omission")

## 1. Problem

MT5 reports give realised balance after each deal, plus report-level
drawdown figures. They do not give an equity path through time. For DCA,
grid, and martingale EAs, floating losses are where the risk sits. On the
owner's DCA EA, MT5's equity drawdown was 2.25% while the realised-balance
drawdown was 0.45%.

Prop firms measure daily and overall loss on **equity at its lowest point**,
often against a start-of-day reference at their own reset time. Any prop
check built on reports alone is systematically optimistic (PL-006).

## 2. Prior art in the owner's project

`EA_DCA_CENT_V1_EquityForensic.mq5` writes one CSV row per closed bar (time,
balance, equity, floating) with `FileWrite`. That is a useful proof of
concept, with four gaps:

- **Per-bar sampling misses intrabar troughs.** The equity low inside an H4
  bar is invisible, and that low is exactly what a prop daily-loss rule
  measures.
- **The log has no link to its report.** TRL could not prove which backtest
  a CSV belongs to.
- **It is embedded in one EA build.** The logic is not reusable across EAs.
- **It records no metadata:** EA, symbol, dates, deposit, currency, or a
  logger version.

## 3. Design

### 3.1 Delivery: a TRL include for EAs with source (E1)

TRL provides one MQL5 include file, `TRL_EquityLogger.mqh`, which is shipped
product material. An EA author adds three lines:

```
#include <TRL_EquityLogger.mqh>
OnInit:   TrlEquityInit(PERIOD_M5);
OnTick:   TrlEquityOnTick();
OnDeinit: TrlEquityFinish();
```

(An `OnTester` hook is optional.)

- **Constraint:** this needs the EA source. Closed-source or purchased EAs
  cannot be logged, and for those TRL stays realised-only, with the prop
  check labelled as an optimistic preview.
- **Alternatives rejected:**
  - an indicator: not loaded reliably by the tester outside visual mode
  - scraping HTML graphs: not machine-readable
  - a wrapper EA: cannot host another compiled EA

### 3.2 What is recorded (E2)

One row per sampling interval (default **M5**, configurable from M1 to H1).
Inside each interval the include tracks every tick **in memory** and writes
a row only when the interval closes, so there is no per-tick file I/O.

| Column | Meaning |
| --- | --- |
| `interval_start` | Server time (the same clock as the report), `yyyy.mm.dd hh:mm:ss` |
| `balance_close` | Balance at the last tick of the interval |
| `equity_close` | Equity at the last tick |
| `equity_min` | **Lowest equity seen on any tick in the interval** |
| `equity_min_time` | When that low occurred |
| `equity_max` | Highest equity on any tick in the interval |
| `margin_max` | Highest margin used (context for margin-call risk) |
| `positions_max` | The most positions open at once |
| `deals_total` | Cumulative deal count at interval close, used to link the log to its report |

Additionally, **one row is written immediately after every deal**, so every
balance change appears in the log.

The file also has a **header block** with:
- `format: trl-equity-log-1`
- the include version
- the EA name, symbol, and timeframe
- the tester start and end
- the account currency, initial deposit, and leverage
- the server name
- the interval

The account **login is not written**, for privacy.

### 3.3 Where the files go, and optimisation (E3)

- Files are written with `FILE_COMMON`, which puts them in
  `%APPDATA%\MetaQuotes\Terminal\Common\Files\TRL\`. This is shared by all
  terminals and survives the tester agent's sandbox.
- File name:
  `TRL_equity_<EA>_<symbol>_<tf>_<start>_<end>_<deposit>.csv`, with an
  incrementing suffix instead of overwriting.
- **Logging is skipped during optimisations**
  (`MQLInfoInteger(MQL_OPTIMIZATION)`), to avoid thousands of files and
  slowdowns. It runs for single tests, including visual mode. An input can
  enable it for forward runs if needed later.
- The modelling mode is not exposed to MQL5, so it is **declared at import**,
  as for optimisations. The equity path's fidelity depends on it: with
  `Model=4` (real ticks) it is the true simulated path; with 1-minute OHLC
  the intrabar path is synthetic, and TRL labels it so.

### 3.4 TRL adapter: linking and verification (E4, E5)

A new Core method, `dataset.attach_equity_log(dataset_ref, source_path,
modelling_mode)`, works as follows.

1. **Immutable snapshot and hash**, as for every raw import:
   `raw/<sha>/source.csv`.
2. **Format checks:** the header version, required columns, monotonic time,
   and plausible values. Failures are BLOCKED with row-level diagnostics.
3. **Link to the report.** Every one of these must match, otherwise BLOCKED:
   - the EA name, symbol, timeframe, currency, and initial deposit from the
     report Settings
   - the tester dates: the log must cover the report's first to last deal
   - **balance at every deal:** for each report deal *n*, the log's
     `balance_close` on the row where `deals_total` first reaches *n* equals
     the report's Balance after deal *n*
   - the final balance equals the report's final balance

   Passing all four is a deterministic proof that the log comes from the same
   run. It gives `equity_source = MT5_TESTER_LOGGED`, status LINKED_VERIFIED.
4. **Cross-check against MT5's own equity drawdown (E5).** From the log, TRL
   computes the maximum equity drawdown (from `equity_max` peaks and
   `equity_min` troughs) and compares it with the report's "Equity Drawdown
   Maximal". MT5 measures on ticks, so with `Model=4` they should agree
   closely. A difference above tolerance (proposed: 0.5% of the MT5 figure,
   or 0.01 in currency, whichever is larger) is a WARNING that shows both
   numbers. It is never silently accepted and never blocks.
5. **Storage:** Parquet under `datasets/<report sha>/equity/<log sha>/` plus
   a manifest. The registry evidence gains an `equity` block (status,
   source, interval, modelling mode, cross-check result).
   `analysis.equity_availability` becomes AVAILABLE with this evidence.

### 3.5 What TRL does with it (after the adapter)

- **Dashboard:** the equity curve (close, with a min/max band) overlaid on
  balance. Equity max drawdown in currency and %, with MT5's figure and the
  balance-vs-equity gap shown as a finding in its own right (playbook §5).
- **Daily equity loss:** per day boundary, the start-of-day reference (the
  higher of balance and equity at the boundary, configurable per the firm's
  rule) minus the day's lowest `equity_min`. The day boundary uses the
  existing configurable slot (report clock by default; a firm reset time and
  timezone later).
- **Portfolio Lab combinations (E6):**
  - The combined balance is exact, as today.
  - The combined equity at each interval close is the combined balance plus
    each track's floating P/L (equity_close minus balance_close), using the
    last known value per track.
  - The **combined equity low per interval** takes the sum of each track's
    floating minimum. These minima can occur at different moments, so the
    sum is a **conservative (pessimistic) bound**, and it is labelled so.
    Prop checks use the conservative figure by default.
  - A combination where any track lacks an equity log stays realised-only,
    with the preview label from PL-006.
- **Prop-firm module:** the next milestone, built on the daily and overall
  equity series.

## 4. Validation plan (uses the backtest agent, DEV-001)

1. Build `TRL_EquityLogger.mqh` and a TRL-owned test EA:
   `MQL5\Experts\TRL_Corpus\TRL_MA_Logged.mq5`, a copy of MT5's Moving
   Average example with the three include lines added.
2. Re-run corpus cases C1 and C6 with the logged copy (`Model=4`). Expect:
   - the report is identical to the unlogged run (same deals and balances;
     the logger must not change trading)
   - the log links as LINKED_VERIFIED
   - the equity drawdown cross-check agrees with MT5's figure
3. **Only with the owner's approval (E8):** a logged copy of the owner's DCA
   EA, on one C-style run, to reproduce the 2.25% vs 0.45% gap with real
   evidence.
4. Negative cases: an edited CSV (balance changed), a log from a different
   run, a truncated log, and M1 vs M5 intervals. Each must be BLOCKED, or
   give the expected WARNING.
5. Timing: measure the logger's overhead on test runtime. Target: under 10%
   at M5.

## 5. Tests (Core; fixture plan after approval)

- Header and format parsing, with UTF-8 and ANSI variants.
- Link verification: balance at deal *n*, final balance, metadata mismatch,
  and a log shorter than the report.
- Equity drawdown from min/max rows against a hand-computed series, and the
  cross-check tolerance boundary.
- Daily equity loss at different day boundaries.
- Portfolio conservative combined low against a brute-force per-interval sum.
- Determinism and immutability of the snapshot.

## 6. Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| E1 | Deliver equity logging as a TRL `.mqh` include that EA authors add in 3 lines. Closed-source EAs stay realised-only, with a labelled preview. | **Yes** |
| E2 | Interval rows (default M5) carrying the tick-level min/max inside each interval and the time of the min, plus a row after every deal. | **Yes** |
| E3 | Write to `Common\Files\TRL\` with a never-overwrite name. Skip logging during optimisations. The modelling mode is declared at import. | **Yes** |
| E4 | Link a log to its report by metadata plus balance at every deal and the final balance; BLOCKED on any mismatch. | **Yes** |
| E5 | Cross-check the log's equity drawdown against MT5's reported "Equity Drawdown Maximal": a WARNING above tolerance, never a block. | **Yes** |
| E6 | Portfolio combined equity low = the sum of per-track interval minima, a conservative bound labelled as such and used by prop checks by default. | **Yes** |
| E7 | `TRL_EquityLogger.mqh` becomes shipped product material: added to the release allowlist under `mql5/`, with a product-docs page on adding it to an EA. | **Yes** |
| E8 | The validation run may also use a logged **copy** of the owner's DCA EA, kept in `TRL_Corpus`; the original is never modified. | Owner's choice |

## 7. Deferred (POST-MVP)

- Logging during optimisations, e.g. equity metrics per pass.
- Tick-exact combined portfolio equity, which would need a shared tick
  clock.
- Other platforms (TradingView, MT4).
- Margin-call simulation.
