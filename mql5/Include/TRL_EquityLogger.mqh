//+------------------------------------------------------------------+
//| TRL_EquityLogger.mqh — Trading Research Lab equity evidence       |
//|                                                                  |
//| Records the account equity path of a Strategy Tester single test |
//| so Trading Research Lab can measure floating drawdown, which MT5 |
//| reports do not contain. Add three lines to an EA:                |
//|                                                                  |
//|   #include <TRL_EquityLogger.mqh>                                |
//|   OnInit():   TrlEquityInit();        // or TrlEquityInit(PERIOD_M1)
//|   OnTick():   TrlEquityOnTick();      // first line of OnTick    |
//|   OnDeinit(): TrlEquityFinish();                                 |
//|                                                                  |
//| Behaviour:                                                       |
//| - Strategy Tester single tests only; never in live trading and   |
//|   never during optimisations. Never places or changes orders.    |
//| - Tracks the lowest and highest equity on every tick in memory   |
//|   and writes one row per interval (default M5) that had ticks and|
//|   an open position or equity movement, plus one row whenever the |
//|   balance changes (a deal closed or was charged).                |
//| - Writes to <Common>\Files\TRL\ as UTF-8-compatible ANSI CSV,    |
//|   never overwriting an existing file.                            |
//| - Does not record the account login.                             |
//+------------------------------------------------------------------+
#ifndef TRL_EQUITY_LOGGER_MQH
#define TRL_EQUITY_LOGGER_MQH

#define TRL_EQUITY_LOG_FORMAT   "trl-equity-log-1"
#define TRL_EQUITY_LOGGER_VER   "1.0.1"

int             g_trlHandle        = INVALID_HANDLE;
ENUM_TIMEFRAMES g_trlInterval      = PERIOD_M5;
int             g_trlIntervalSecs  = 300;
int             g_trlDigits        = 2;
datetime        g_trlIntervalStart = 0;
datetime        g_trlLastTick      = 0;
double          g_trlLastBalance   = 0.0;
double          g_trlEqMin         = 0.0;
double          g_trlEqMax         = 0.0;
datetime        g_trlEqMinTime     = 0;
double          g_trlMarginMax     = 0.0;
int             g_trlPositionsMax  = 0;
int             g_trlDealsTotal    = 0;
int             g_trlTicks         = 0;      // ticks seen in the current interval
double          g_trlTickBalance   = 0.0;    // state at the last tick of the interval
double          g_trlTickEquity    = 0.0;

string TrlTime(const datetime value)
  {
   return TimeToString(value, TIME_DATE | TIME_SECONDS);
  }

string TrlMoney(const double value)
  {
   return DoubleToString(value, g_trlDigits);
  }

void TrlWriteLine(const string line)
  {
   if(g_trlHandle != INVALID_HANDLE)
      FileWriteString(g_trlHandle, line + "\r\n");
  }

int TrlCountDeals(const datetime now)
  {
   // The upper bound is in the future: deals stamped at the current second are
   // otherwise missed while the balance already includes them (1.0.1 fix).
   if(!HistorySelect(0, now + 86400))
      return g_trlDealsTotal;
   return HistoryDealsTotal();
  }

void TrlResetInterval(const datetime start, const double equity)
  {
   g_trlIntervalStart = start;
   g_trlEqMin         = equity;
   g_trlEqMax         = equity;
   g_trlEqMinTime     = g_trlLastTick;
   g_trlMarginMax     = AccountInfoDouble(ACCOUNT_MARGIN);
   g_trlPositionsMax  = PositionsTotal();
   g_trlTicks         = 0;
  }

// kind,time,balance,equity_close,equity_min,equity_min_time,equity_max,margin_max,positions_max,deals_total
// Rows carry the state recorded at `at` (never a later tick's values).
void TrlWriteRow(const string kind, const datetime at, const double balance, const double equity)
  {
   TrlWriteLine(kind + "," + TrlTime(at) + "," + TrlMoney(balance) + "," + TrlMoney(equity) + "," +
                TrlMoney(g_trlEqMin) + "," + TrlTime(g_trlEqMinTime) + "," +
                TrlMoney(g_trlEqMax) + "," + TrlMoney(g_trlMarginMax) + "," +
                IntegerToString(g_trlPositionsMax) + "," + IntegerToString(g_trlDealsTotal));
  }

// An interval is worth a row when it had ticks and something at risk or moving.
bool TrlIntervalInformative()
  {
   return g_trlTicks > 0 && (g_trlPositionsMax > 0 || g_trlEqMin != g_trlEqMax || g_trlEqMin != g_trlTickBalance);
  }

bool TrlEquityInit(const ENUM_TIMEFRAMES interval = PERIOD_M5)
  {
   if(!MQLInfoInteger(MQL_TESTER) || MQLInfoInteger(MQL_OPTIMIZATION))
      return false;
   g_trlInterval     = interval;
   g_trlIntervalSecs = PeriodSeconds(interval);
   if(g_trlIntervalSecs < 60 || g_trlIntervalSecs > 3600)
     {
      g_trlInterval     = PERIOD_M5;
      g_trlIntervalSecs = 300;
     }
   g_trlDigits = (int)AccountInfoInteger(ACCOUNT_CURRENCY_DIGITS);
   datetime now = TimeCurrent();
   MqlDateTime parts;
   TimeToStruct(now, parts);
   string stem = StringFormat("TRL\\TRL_equity_%s_%s_%s_%04d%02d%02d", MQLInfoString(MQL_PROGRAM_NAME), _Symbol,
                              StringSubstr(EnumToString((ENUM_TIMEFRAMES)_Period), 7), parts.year, parts.mon, parts.day);
   string name = stem + ".csv";
   for(int suffix = 2; FileIsExist(name, FILE_COMMON) && suffix < 10000; suffix++)
      name = stem + "_" + IntegerToString(suffix) + ".csv";
   g_trlHandle = FileOpen(name, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(g_trlHandle == INVALID_HANDLE)
     {
      Print("TRL equity logger: cannot create ", name, " (error ", GetLastError(), ")");
      return false;
     }
   TrlWriteLine("# format: " + TRL_EQUITY_LOG_FORMAT);
   TrlWriteLine("# logger_version: " + TRL_EQUITY_LOGGER_VER);
   TrlWriteLine("# expert: " + MQLInfoString(MQL_PROGRAM_NAME));
   TrlWriteLine("# symbol: " + _Symbol);
   TrlWriteLine("# timeframe: " + StringSubstr(EnumToString((ENUM_TIMEFRAMES)_Period), 7));
   TrlWriteLine("# currency: " + AccountInfoString(ACCOUNT_CURRENCY));
   TrlWriteLine("# initial_deposit: " + TrlMoney(AccountInfoDouble(ACCOUNT_BALANCE)));
   TrlWriteLine("# leverage: 1:" + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE)));
   TrlWriteLine("# server: " + AccountInfoString(ACCOUNT_SERVER));
   TrlWriteLine("# interval: " + StringSubstr(EnumToString(g_trlInterval), 7));
   TrlWriteLine("# test_start: " + TrlTime(now));
   TrlWriteLine("kind,time,balance,equity_close,equity_min,equity_min_time,equity_max,margin_max,positions_max,deals_total");
   g_trlLastTick    = now;
   g_trlLastBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   g_trlTickBalance = g_trlLastBalance;
   g_trlTickEquity  = AccountInfoDouble(ACCOUNT_EQUITY);
   g_trlDealsTotal  = TrlCountDeals(now);
   TrlResetInterval(now - (now % g_trlIntervalSecs), g_trlTickEquity);
   TrlWriteRow("START", now, g_trlTickBalance, g_trlTickEquity);
   Print("TRL equity logger: writing Common\\Files\\", name);
   return true;
  }

void TrlEquityOnTick()
  {
   if(g_trlHandle == INVALID_HANDLE)
      return;
   datetime now   = TimeCurrent();
   datetime start = now - (now % g_trlIntervalSecs);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(start != g_trlIntervalStart)
     {
      // Close the previous interval with the state recorded at its last tick.
      if(TrlIntervalInformative())
         TrlWriteRow("INTERVAL", g_trlLastTick, g_trlTickBalance, g_trlTickEquity);
      g_trlLastTick = now;
      TrlResetInterval(start, equity);
     }
   g_trlLastTick = now;
   g_trlTicks++;
   if(equity < g_trlEqMin)
     {
      g_trlEqMin     = equity;
      g_trlEqMinTime = now;
     }
   if(equity > g_trlEqMax)
      g_trlEqMax = equity;
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   if(margin > g_trlMarginMax)
      g_trlMarginMax = margin;
   int positions = PositionsTotal();
   if(positions > g_trlPositionsMax)
      g_trlPositionsMax = positions;
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   g_trlTickBalance = balance;
   g_trlTickEquity  = equity;
   if(balance != g_trlLastBalance)
     {
      g_trlLastBalance = balance;
      g_trlDealsTotal  = TrlCountDeals(now);
      TrlWriteRow("BALANCE", now, balance, equity);
     }
  }

void TrlEquityFinish()
  {
   if(g_trlHandle == INVALID_HANDLE)
      return;
   datetime now = TimeCurrent();
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance != g_trlLastBalance)
     {
      // Deals closed by the tester at the end of the test ("end of test").
      g_trlLastBalance = balance;
     }
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity < g_trlEqMin)
     {
      g_trlEqMin     = equity;
      g_trlEqMinTime = now;
     }
   if(equity > g_trlEqMax)
      g_trlEqMax = equity;
   g_trlDealsTotal = TrlCountDeals(now);
   TrlWriteRow("END", now, balance, equity);
   TrlWriteLine("# test_end: " + TrlTime(now));
   FileClose(g_trlHandle);
   g_trlHandle = INVALID_HANDLE;
  }

#endif // TRL_EQUITY_LOGGER_MQH
