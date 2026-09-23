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

Copy `mql5/Include/TRL_EquityLogger.mqh` from the TRL release into your
terminal's `MQL5\Include\` folder. In MetaTrader: **File → Open Data
Folder**, then `MQL5\Include`.

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

## 3. Run the test and import both files

1. Run a single test (preferably with **Every tick based on real ticks**).
   Save the report as `.xlsx` or `.html`.
2. Find the log in `%APPDATA%\MetaQuotes\Terminal\Common\Files\TRL\`. It is
   named `TRL_equity_<EA>_<symbol>_<timeframe>_<start date>.csv`. Existing
   files are never overwritten.
3. In TRL, import the report, then attach the equity log to it, stating the
   modelling mode you used.

TRL accepts the log only if it provably comes from that report's run: the EA,
symbol, timeframe, currency, and deposit must match, and so must the balance
after every deal. It then compares its equity drawdown with the report's own
"Equity Drawdown Maximal" and tells you if they differ.

The log does not contain your account login.
