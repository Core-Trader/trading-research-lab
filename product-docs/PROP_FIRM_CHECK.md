# Prop-firm check

The **Prop-firm check** page (in the sidebar, under Research) answers one
question: would this backtest have broken my prop firm's rules, and if so,
when and by how much? When a run stays within the rules, it shows how close
it came.

## Your rules, not a firm's

TRL does not include rules for any named firm, because firms change their
terms. Create a **profile** with the numbers from your firm's current rules.
You can set:
- daily loss
- overall loss (fixed, trailing, or trailing until it reaches the starting
  balance)
- profit target
- minimum trading days
- maximum calendar days
- the time the day resets

A profile is never overwritten. Editing one saves a new version.

The profile's account size must equal the report's starting balance, or a
saved combination's starting capital. TRL does not rescale results.

## Reset time and time zones

MT5 test times are in the broker's **server time**. If your firm resets at a
time in its own zone (for example midnight in Prague), you must also enter
the report's server time zone. Many MT5 servers use EET with EU daylight
saving, entered as `Europe/Athens`. If you are unsure, check the server time
in MT5 against a clock.

## How far to trust the result

The result depends on the evidence available:
- **Equity log attached:** the check uses the lowest equity reached, tick by
  tick, in each logged interval. The result reads "Broken on …" or "Not
  broken in the logged evidence".
- **Saved combination with every report logged:** TRL adds each report's
  lowest point in each interval, even if the lows happened at different
  moments. This can overstate a loss.
  - When only this worst case breaks a rule, the result says **Possibly
    broken**.
  - The less pessimistic figure is shown next to it.
- **No equity log:** the check sees closed trades only. Every result is
  labelled an **optimistic preview**, because open-position losses are
  invisible. See [EQUITY_LOGGER.md](EQUITY_LOGGER.md) to add a log.

A loss exactly equal to a limit counts as a breach. The run is not cut off
at the first breach: you see when it happened and how the run continued.

This checks a past run. It does not predict whether a live challenge will
pass.
