# Recording equity in MT5 backtests (TRL equity logger)

MT5 reports list closed trades and a few drawdown figures, but not the
**equity path**: how deep open positions went while they were open. For EAs
that average into positions (DCA, grid, martingale), that is where the risk
is, and it is what prop firms measure. The TRL equity logger records it
during a Strategy Tester run, so TRL can show real floating drawdown and
daily equity loss.

You need the EA's source code (`.mq5`). EAs you only have as `.ex5` cannot
be logged; TRL then shows closed-trade results only, clearly labelled.

## 1. Install the include

The easiest way: in TRL open **Help & downloads**, choose **My MT5 MQL5
folder**, paste your MQL5 folder path (in MetaTrader: **File → Open Data
Folder**, then open `MQL5` and copy its path), and click **Save files**. TRL
puts `TRL_EquityLogger.mqh` in `MQL5\Include\` and a ready example EA,
`TRL_EquityLogger_Example.mq5`, in `MQL5\Experts\TRL\`. Existing files are
never overwritten.

To do it by hand, copy `mql5/Include/TRL_EquityLogger.mqh` from the TRL
release into your terminal's `MQL5\Include\` folder.

## 2. Add it to your EA

Work on a **copy** of your EA if you prefer to keep the original untouched.
Add these lines:

```cpp
#include <TRL_EquityLogger.mqh>        // near the top of the file

int OnInit()
  {
   // ... your existing initialisation ...
   TrlEquityInit();                    // just before return(INIT_SUCCEEDED)
   return(INIT_SUCCEEDED);
  }

void OnTick()
  {
   TrlEquityOnTick();                  // the first line of OnTick
   // ... your existing logic ...
  }

void OnDeinit(const int reason)
  {
   TrlEquityFinish();                  // add OnDeinit if your EA has none
  }
```

Compile it. The logger never places or changes orders, and it only runs in
the Strategy Tester's single tests. It does nothing in live trading or
during optimisations.

`TrlEquityInit(PERIOD_M1)` records a row every minute instead of every 5
minutes. Either way, each row holds the **lowest and highest equity of every
tick** in that interval, so no dip is missed.

## Common cases when adding it to other EAs

- **The EA filters ticks at the top of `OnTick`** (for example
  `if(!IsNewBar()) return;`). Put `TrlEquityOnTick();` **above** that line.
  Otherwise the logger only sees the ticks the EA uses and misses the lows in
  between. This is the most common mistake.
- **The EA has no `OnDeinit`.** Add the function shown above.
- **`OnInit` has several `return` statements.** Put `TrlEquityInit();` just
  before the final successful `return(INIT_SUCCEEDED);`.
- **The EA trades from a timer (`OnTimer`) or trades other symbols than the
  chart's.** `OnTick` only runs on the chart symbol's ticks. Also call
  `TrlEquityOnTick();` at the start of `OnTimer`. If the EA has no timer, add
  `EventSetTimer(1);` in `OnInit` and an `OnTimer()` that calls it, so equity
  moves on other symbols are sampled every second. TRL warns if the log comes
  out shallower than MT5's own equity drawdown figure.
- **The EA is split across several files.** Add the lines only to the main
  `.mq5` (the one you compile).
- **A name clash when compiling.** The logger's names all start with `Trl` or
  `g_trl`. If your EA already uses one, rename yours.
- **Optimisations.** The logger stays silent. Pick the pass you care about and
  run it as a single test.
- **Only a compiled `.ex5`.** It cannot be logged; TRL shows closed-trade
  results only.

## 3. Run the test and import both files

1. Run a single test (preferably with **Every tick based on real ticks**).
   Save the report as `.xlsx` or `.html`.
2. Find the log in `%APPDATA%\MetaQuotes\Terminal\Common\Files\TRL\`. It is
   named `TRL_equity_<EA>_<symbol>_<timeframe>_<start date>.csv`. Existing
   files are never overwritten.
3. In TRL, on **Data & import**: **Browse and validate report…**, then under
   **Companion files** state the modelling mode you used and press **Find this
   report's log**. TRL checks every log in the folder above against the report
   and lists the one that belongs to it, with **Attach**. This matters because
   the file name cannot tell repeated runs apart: runs of the same EA, symbol,
   and start date get `_2`, `_3` suffixes. You can also **Browse for the log
   (.csv)…** if it is saved elsewhere, or **Open logger folder** to see the
   files. The report and the log must come from the **same run**, otherwise
   TRL refuses the log.

TRL accepts the log only if it provably comes from that report's run: the EA,
symbol, timeframe, currency, and deposit must match, and so must the balance
after every deal. It then compares its equity drawdown with the report's own
"Equity Drawdown Maximal" and tells you if they differ.

The log does not contain your account login.
