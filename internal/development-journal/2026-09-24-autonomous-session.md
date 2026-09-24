# 2026-09-24: autonomous session while the owner was away

The owner was out of office and approved this plan:
1. Finish the prop module.
2. Verify it without Obsidian.
3. Run MT5 backtests under the standing rules.
4. Hardening.
5. Docs.

The owner later authorised closing the running MT5.

## 1. Prop module

- **Chained phases** (commit 7fedbdb, `prop.chain_starts`, `prop-chain-1`):
  - 2 or 3 profiles. Every phase except the last needs a target, and all
    phases must use the same account size.
  - After a pass, the next phase starts on the next day with data, as a
    fresh account shifted to the account size.
  - Final outcomes: COMPLETED, FAILED (naming the phase), POSSIBLY_FAILED,
    and NOT_DECIDED.
  - The summary gives the completed share of decided starts, failures by
    phase, and days to complete.
  - All phases share one loaded run (commit 1814a7c).
- **Quick actions:**
  - "Check prop-firm rules…" on the sidebar report card
  - "Prop check" on each saved combination
  - both go through `NavigationStore.requestPropCheck`, which carries a
    sequence number so a repeated request is applied again
- **Plugin:** "Then phase 2 / phase 3" selectors on the Prop-firm check
  page, and a chain result view with per-phase tooltips.
- **FundedNext presets** (commit 4897d95), 7 profiles: Stellar 2-Step
  (2 phases), Stellar 1-Step, Stellar Lite (2), and Evaluation (2).
  - **Sources:** the CFD Challenge Terms §4–§7 and two Help Center articles
    (the daily-loss formula, and the reset at 00:00 server time, GMT+2 or
    GMT+3 with daylight saving, entered as `Europe/Athens`).
  - The terms say "reaches or exceeds", so touching a limit is a breach.
  - The EA add-on note is attributed to PropFirmMatch, not FundedNext.
- **The5ers** was not added. Its High Stakes page gives the percentages, but
  not the daily-loss reference or the reset time. It also counts
  "profitable days" (a day with closed profit of at least 0.5%), which TRL
  does not model. Recorded in `REFERENCE_REGISTER.md`.
- **Cookie handling:**
  - FundedNext and FTMO banners (accept only): left untouched
  - The5ers banner: "Deny" was clicked

## 2. Verification without Obsidian

- **Tests:** Core 262, plugin 93; the build is clean.
- **Harness DOM checks with real Core output:**
  - the preset picker (FTMO 1-Step fills its rules and the report's account
    size)
  - the rolling-starts strip, tiles, and tooltip
  - the chain view (161 starts, per-phase tooltip)
- **Still needs the owner:** a visual review in Obsidian.

## 3. MT5 backtests (the P1–P3 prop corpus)

- **Closing MT5:** `terminal64` was running. The first attempt stopped, as
  the rule requires; the owner then authorised closing it. The running
  terminal was **`C:\RoboForex MT5 Terminal`**, not the FTMO one. It was
  closed gracefully (CloseMainWindow). **The owner may want to restart it.**
- **Runs:** three runs through `run.ps1`, which aborts if any MT5 is
  running:
  - the FTMO terminal, portable mode, a `[Tester]`-only ini, no password
  - `TRL_MA_Logged`, H1 2024, Model 4, 100 000 USD at 1:100
  - MaximumRisk raised: P1 USDJPY 0.10, P2 XAUUSD 0.05, P3 EURUSD 0.10
  - files are in `data/raw/corpus/P1..P3` (git-ignored), with a manifest
    section
- **Checks:** all three logs are LINKED_VERIFIED, and `corpus_check.py`
  parses all 48 corpus files.
- **Prop results** (report clock `Europe/Athens`; share of decided starts):

| Run | FTMO 2-Step phase 1 pass | FTMO 1-Step pass | FundedNext Stellar 2-Step phase 1 pass | FTMO 2-Step chain completed | FundedNext 2-Step chain completed |
| --- | --- | --- | --- | --- | --- |
| P1 USDJPY | 21.2% | 12.7% | 22.3% | 9.7% | 11.2% |
| P2 XAUUSD | 49.2% | 19.6% | 52.3% | 4.5% | 16.7% |
| P3 EURUSD | 16.4% | 3.3% | 31.1% | 0% | 0% |

- **P1 in full:** the whole run passes FTMO 2-Step phase 1 and breaks a
  rule later. This shows P9: the run is not cut at the first breach.
- **A sanity check that passed:** on P2, the FTMO 1-Step and FundedNext
  1-Step totals are identical. Per start, 60 outcomes and the mix of rules
  broken differ; the totals coincide.

## 4. Hardening

- **Rolling starts** now charge an interval that spans the reset to its
  low's own day, as `prop.evaluate` does (`prop-rolling-2`).
  - A test covers both the fast path and the full scan.
  - The P1–P3 results are unchanged, because the M5 intervals align with
    midnight.
- **Worker client restart race (a real bug):** a replaced worker's late
  `exit` event cleared the new worker and failed its pending requests.
  - Now each handler acts only on its own child process.
  - A new integration test runs the real Python worker through a crash, a
    stop, and an immediate restart.
  - The old client hung on this test.
- **Worker memory (M0 deferral):** on P1 (49k log rows) the whole-process
  peak working set is 187 MB across all the calls below.

| Call | Time |
| --- | --- |
| equity metrics | 0.4 s |
| Monte Carlo, 10 000 paths | 3.6 s |
| evaluate | 0.6 s |
| rolling starts | 0.6 s |
| two-phase chain | 0.8 s |

## Not done

- **Portfolio Lab opening-deal commissions:** a documented difference; any
  change would alter a closed calculation, so it waits for the owner.
- **Release decisions (R-D1–R-D4):** waiting for the owner.
