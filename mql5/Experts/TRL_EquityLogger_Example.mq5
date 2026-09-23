//+------------------------------------------------------------------+
//| TRL_EquityLogger_Example.mq5 — Trading Research Lab              |
//|                                                                  |
//| A small, self-contained example EA showing where the TRL equity  |
//| logger's four lines go (marked "TRL"). The trading rule is only  |
//| for demonstration: a two moving-average crossover with one       |
//| position and a fixed lot. Not a trading recommendation.          |
//|                                                                  |
//| Needs TRL_EquityLogger.mqh in MQL5\Include. Compile in MetaEditor|
//| (F7), run a single Strategy Tester test, then attach the CSV     |
//| from Common\Files\TRL to the report in Trading Research Lab.     |
//+------------------------------------------------------------------+
#property copyright "Trading Research Lab"
#property version   "1.00"
#property description "Example of adding the TRL equity logger to an EA."

#include <Trade\Trade.mqh>
#include <TRL_EquityLogger.mqh>                      // TRL (1 of 4)

input int    InpFastPeriod = 10;    // Fast moving average period
input int    InpSlowPeriod = 30;    // Slow moving average period
input double InpLots       = 0.10;  // Fixed lot size

CTrade   g_trade;
int      g_fastHandle = INVALID_HANDLE;
int      g_slowHandle = INVALID_HANDLE;
datetime g_lastBar    = 0;

int OnInit()
  {
   if(InpFastPeriod <= 0 || InpSlowPeriod <= InpFastPeriod || InpLots <= 0)
      return(INIT_PARAMETERS_INCORRECT);
   g_fastHandle = iMA(_Symbol, _Period, InpFastPeriod, 0, MODE_SMA, PRICE_CLOSE);
   g_slowHandle = iMA(_Symbol, _Period, InpSlowPeriod, 0, MODE_SMA, PRICE_CLOSE);
   if(g_fastHandle == INVALID_HANDLE || g_slowHandle == INVALID_HANDLE)
      return(INIT_FAILED);
   TrlEquityInit();                                  // TRL (2 of 4): just before the successful return
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   TrlEquityFinish();                                // TRL (3 of 4)
   if(g_fastHandle != INVALID_HANDLE) IndicatorRelease(g_fastHandle);
   if(g_slowHandle != INVALID_HANDLE) IndicatorRelease(g_slowHandle);
  }

void OnTick()
  {
   TrlEquityOnTick();                                // TRL (4 of 4): FIRST, before the new-bar filter below
   datetime bar = iTime(_Symbol, _Period, 0);
   if(bar == g_lastBar)
      return;                                        // the EA itself only acts once per bar
   g_lastBar = bar;

   double fast[2], slow[2];
   if(CopyBuffer(g_fastHandle, 0, 1, 2, fast) != 2 || CopyBuffer(g_slowHandle, 0, 1, 2, slow) != 2)
      return;
   bool crossUp   = fast[0] <= slow[0] && fast[1] > slow[1];
   bool crossDown = fast[0] >= slow[0] && fast[1] < slow[1];
   if(!crossUp && !crossDown)
      return;

   if(PositionSelect(_Symbol))
     {
      long type = PositionGetInteger(POSITION_TYPE);
      if((crossUp && type == POSITION_TYPE_BUY) || (crossDown && type == POSITION_TYPE_SELL))
         return;
      g_trade.PositionClose(_Symbol);
     }
   if(crossUp)
      g_trade.Buy(InpLots, _Symbol);
   else
      g_trade.Sell(InpLots, _Symbol);
  }
