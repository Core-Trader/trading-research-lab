# FTMO Reference Daily-Drawdown Policy

**Policy ID:** `ftmo-reference-daily-loss-v0.1`  
**Status:** Time and calculation semantics approved as a research reference; implementation remains outside the current importer scope.  
**Verified:** 2026-09-20

## Purpose and boundary

This policy gives Trading Research Lab a versioned reference for FTMO 2-Step Swing daily-loss research. It is an optional overlay, not the default broker-analysis mode. It is not a claim of FTMO compliance or a substitute for FTMO’s current account-specific rules.

## Configured FTMO 2-Step Swing reference limits

| Rule | Reference value | Measurement basis |
| --- | --- | --- |
| Maximum Daily Loss | 5% of Initial Simulated Capital | Equity: balance plus open floating P/L, swaps, and commissions |
| Maximum Loss (overall) | 10% of Initial Simulated Capital | Equity; static floor at 90% of Initial Simulated Capital |

The daily floor is recalculated from the Prague-midnight balance less 5% of Initial Simulated Capital. The overall floor is `Initial Simulated Capital - 10% of Initial Simulated Capital`. These are current FTMO 2-Step reference semantics, not a reusable assumption for every FTMO product or another prop firm. [FTMO Trading Objectives](https://ftmo.com/en/trading-objectives/)

## Authoritative calculation clock

| Use | Timezone / convention |
| --- | --- |
| Daily-loss calculation | `Europe/Prague` (CET/CEST, DST-aware) |
| Reset | 00:00:00 Prague local time |
| Risk-day interval | `[00:00:00, next 00:00:00)` Prague local time |
| User display timezone | `Europe/Lisbon` (display only) |

FTMO’s published guidance states that Maximum Daily Loss resets at midnight CE(S)T/Prague time. In Lisbon, that reset is normally 23:00 on the preceding local calendar day; use timezone-aware conversion rather than a fixed UTC offset. [FTMO Academy: Maximum Daily Loss](https://academy.ftmo.com/lesson/maximum-daily-loss/)

## Reference calculation semantics

For a configured daily-loss allowance `L`:

```text
daily baseline = account balance recorded at the Prague midnight beginning the risk day
daily floor    = daily baseline - L
current equity = balance + floating P/L, including commissions and swaps
violation      = current equity < daily floor at any evaluated checkpoint
```

On the first risk day, the baseline is the configured initial simulated capital. This follows FTMO’s published example for its 2-Step Challenge; other account types/rules may differ and require their own versioned policy. [FTMO Academy: Maximum Daily Loss](https://academy.ftmo.com/lesson/maximum-daily-loss/)

## Source-clock profile for current RoboForex Forex reports

The owner confirmed, and RoboForex publishes, that its server time is EET: UTC+2 in standard time and UTC+3 in summer time. The initial profile is `roboforex-eet-eest-v0.1` and applies to the Forex reports currently in this project. [RoboForex trading accounts](https://roboforex.com/forex-trading/trading/trading-accounts/)

The owner also supplied that US and European daylight-saving transitions can create temporary 2–3 week differences in **US-asset trading hours** relative to server time. This is an instrument-session schedule issue; it must not change the timestamp-clock conversion for the Forex source events.

The owner supplied an FTMO platform-clock observation of `01:01:01` through `00:59:59`; it remains a **platform-display observation**, not the authoritative calculation interval. FTMO calculation remains Prague midnight.

The future implementation must convert source server-local timestamps to UTC using the approved EET/EEST rule, then derive Prague local timestamps. It must include fixtures around daylight-saving changes. Daily results remain out of the current importer scope, but are no longer blocked by an undecided RoboForex server-time requirement.

## Required future tests

- A position open across Prague midnight uses the new day’s balance baseline.
- Floating loss can breach the floor even if realised P/L alone does not.
- Commissions and swaps are included with their source signs.
- CET/CEST transition fixtures preserve the exact Prague reset instant.
- Lisbon display labels do not alter Prague-day grouping.

## Manual review for implementation

- [ ] Confirm the specific FTMO account/rule version and configured daily-loss allowance when prop-firm simulation is in scope.
- [ ] Supply or confirm the RoboForex MT5 server-time/DST mapping for the saved reports.
- [ ] Review the computed Prague and Lisbon boundaries for a sample report day before daily-risk outputs are enabled.
