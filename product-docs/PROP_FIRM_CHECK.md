# Prop-firm check

The **Prop-firm check** page (in the sidebar, under Research) answers one
question: would this backtest have broken my prop firm's rules, and if so,
when and by how much? When a run stays within the rules, it shows how close
it came.

## Firm presets and your own rules

When you create a profile, you can **start from a firm preset**; FTMO 2-Step
and 1-Step are included. A preset is copied from the firm's published rules
on the date shown, and every value stays editable. Firms change their terms,
so check the preset against your firm's current rules. Each preset also lists
what TRL cannot check (for example news restrictions).

You can also start from a blank profile and set:
- daily loss
- overall loss (fixed, trailing, or trailing until it reaches the starting
  balance)
- profit target
- minimum trading days
- maximum calendar days
- the time the day resets
- what counts as a trading day (a position opened, or any deal)
- whether exactly reaching a limit counts as a breach
- a best-day (consistency) rule: pass only once your best day is at most a
  given share of the positive days' profit

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
