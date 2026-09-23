# 2026-09-23 — First MT5 test corpus (DEV-001) and the biases it exposed

## Corpus

A background backtest agent ran the owner's portable FTMO MT5 terminal (build
6182) using the playbook's rules:
- a `Get-Process` check before every launch
- `TRL_` namespacing
- config paths written as all-backslash literals
- a bare `.set` name placed in `Profiles\Tester`
- three-way verification of every run

It first stopped correctly because the owner's terminal was open, and later
resumed after an API usage-limit interruption. Output is in
`data/raw/corpus/` (git-ignored), with `CORPUS_MANIFEST.md` holding the log
evidence per case.

| Case | Content |
| --- | --- |
| C1 | Moving Average, EURUSD H1, 2024, single test (HTML) |
| C5a/b/c | MACD Sample, EURUSD H4, 2022, 2023, and 2024 single tests |
| C6a/b | Moving Average, GBPUSD and USDJPY H1, 2024 |
| C3 | Complete optimisation (`Optimization=1`), MovingPeriod 8–28/4 × MovingShift 1–11/2 = 36 of 36 passes |
| C4 | The same grid with a built-in forward period (ForwardDate 2024.01.01): 36 in-sample and 36 forward passes |
| C3g | A genetic request; MT5 turned genetic off for 36 passes and reused C3's cache, so the output is byte-identical apart from `Created` |

Agent findings (in the manifest):
- `Leverage=100` in the ini is silently ignored; `1:100` works.
- FTMO's EURUSD real ticks start on 2024.02.15, so earlier periods ran on
  generated ticks despite `Model=4`.
- Both C4 exports carry the whole-range title.
- Playbook §3.1's `ps aux` check cannot see desktop-launched terminals
  (corrected earlier).

## Biases exposed and fixed (the owner's concern, confirmed)

1. **Input columns required the `Inp` prefix.** This was the naming
   convention of the owner's EA. MT5 example EAs use `MovingPeriod` and
   `MovingShift`, so every optimisation from another EA was rejected as "not
   a parameter grid". Now every column that is not a known MT5 statistic
   (`MT5_STATISTIC_COLUMNS`, including Forward Result and Back Result) is an
   input.
2. **EA names with spaces broke the title parser** ("Moving Average
   EURUSD,H1 …"). Forward, single-test, and neighbourhood context checks
   silently degraded to "unverifiable". Fixed with a lazy expert match.
3. **Built-in forward exports were flagged as PERIODS_OVERLAP.** Both titles
   show the whole range, so the recommended collection method looked like an
   overlap. A forward export with a `Forward Result` column and the same
   range is now recognised as MT5's own split: finding `BUILT_IN_FORWARD`
   (a NOTE), with a period of source `MT5_BUILT_IN_FORWARD` and the whole
   range only, because the split date is not exported. The plugin shows
   "(MT5 built-in forward, from–to)". A separate export with the same title
   and no Forward Result column still warns.

The owner's original DCA exports import unchanged (173/170/170 passes, same
inputs). The symbol-sweep export is still rejected. There are 2 new
regression tests; totals are 203 Core tests, 71 plugin tests, and a clean
build.

## Real-corpus results

- 6/6 HTML reports import, every totals check matches, and dashboard metrics
  compute.
- Portfolio Lab: C1 + C6a + C6b combine (combined max DD 2 920.46 vs a
  3 743.06 standalone sum) and explore 7 subsets.
- C5 as a sequential chain is **BLOCKED**, correctly: each yearly test
  restarts at 10 000, so it is not one continuous account. This is the use
  case for MX-3 (per-window consistency of one fixed configuration).
- C3 study: 36/36 passes on the 36-point grid. The default (12, 6) is
  correctly NOT_TESTED, because 6 is not on the odd MovingShift grid.
  **Neighbourhood coverage is complete** (3 at corners, 5 on edges, 8
  inside), with statistics for 32/36 and one isolated peak flagged. This is
  the first real validation of PX-010 on dense data.
- C4 built-in forward: 36/36 paired.
- C1 as a single test on the C3 study is BLOCKED (CONTEXT_DIFFERS: 2024 vs
  2023–2024), correctly.

## Tooling

`scripts/corpus_check.py` runs every corpus file (reports, optimisation XML,
`.set`) through the importers and prints PARSED / BLOCKED / CRASHED; it exits
1 on any crash. Current result: 19/19 parsed.
