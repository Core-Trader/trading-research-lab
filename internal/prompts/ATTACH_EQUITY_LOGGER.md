# Reusable prompt: attach the TRL equity logger to an EA

Paste this into a session working on an MT5 Expert Advisor. Replace <EA source path>.

---

Attach the Trading Research Lab (TRL) equity logger to the EA at <EA source path>,
so its Strategy Tester runs write a floating-drawdown log that TRL can import.

Reference files (read first):
- C:\DEV\Trading_Research_Lab\mql5\Include\TRL_EquityLogger.mqh (the logger; do not edit it)
- C:\DEV\Trading_Research_Lab\mql5\Experts\TRL_EquityLogger_Example.mq5 (the four marked "TRL" lines)
- C:\DEV\Trading_Research_Lab\product-docs\EQUITY_LOGGER.md (placement rules and pitfalls)

Rules:
1. Never edit the original EA. Work on a copy named TRL_<EAName>_Logged.mq5, and keep an
   unmodified copy TRL_<EAName>_Control.mq5 for the comparison in step 5.
2. Add exactly four lines, each marked with a `// TRL` comment:
   - `#include <TRL_EquityLogger.mqh>` near the top
   - `TrlEquityInit();` just before `return(INIT_SUCCEEDED)` in OnInit. If OnInit has
     several returns, put it only before the successful one.
   - `TrlEquityOnTick();` as the FIRST line of OnTick, above any new-bar filter or early
     `return`
   - `TrlEquityFinish();` in OnDeinit (add OnDeinit if the EA has none)
   - For timer-driven or multi-symbol EAs, also call `TrlEquityOnTick();` at the start
     of OnTimer (add `EventSetTimer(1);` in OnInit if there is no timer). The default
     interval is M5; use `TrlEquityInit(PERIOD_M1)` only if asked.
3. Change nothing else: no inputs, no trading logic, no formatting.
4. Copy TRL_EquityLogger.mqh into the terminal's MQL5\Include folder, and the logged and
   control copies into MQL5\Experts\TRL_Corpus\. Compile both. Report any compiler
   errors verbatim.
5. Verify that the logger does not change trading. Run the logged and the control copies
   as single tests with identical settings (same .set, symbol, period, dates, deposit,
   leverage, Model 4 "Every tick based on real ticks"). The deal lists and the final
   balance must be identical. If they differ, stop and report.
6. The log is written to %APPDATA%\MetaQuotes\Terminal\Common\Files\TRL\ as
   TRL_equity_<EA>_<SYMBOL>_<TF>_<start>.csv. Repeated runs add _2, _3 and so on, so
   take the newest file. Its header must show `format: trl-equity-log-1` and the
   logger_version.
7. Report: the four inserted lines with their line numbers, the compile result, the
   comparison between the logged and control runs, and the report and log file paths.
   In TRL, import the report on Data & import, then attach the log under Companion files.

MT5 safety rules (always):
- Before any launch, check `Get-Process terminal64`. If MT5 is running, stop and ask.
- Use the portable terminal (/portable) with a [Tester]-only ini. Never enter passwords,
  trade, enable algo trading, attach EAs to charts, or change [Experts] or other
  terminal settings.
- Create only TRL_-prefixed files. Never edit other projects' files or the owner's
  original EAs.
- Never commit .ex5 files or real data (data/raw).
- Optimisations: the logger stays silent. Log only single tests.
