# Prop-firm check

The **Prop-firm check** page (in the sidebar, under Research) answers one
question: would this backtest have broken my prop firm's rules, and if so,
when and by how much? When a run stays within the rules, it shows how close
it came.

## Firm presets and your own rules

The **Profile** list shows your own profiles and the firm presets (FTMO and
FundedNext). Pick a preset and click **Check against the rules**: TRL saves a
copy sized to the report under **My profiles**. To change a preset's values
first, use **Edit a copy…**. To change one of your own profiles, use **Edit
(saves a new version)…**. You can also start from a preset in **New
profile…**. A preset is copied from the firm's published rules
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

By default, a loss exactly equal to a limit counts as a breach. FTMO presets
count a breach only below the limit, as FTMO does. The run is not cut off
at the first breach: you see when it happened and how the run continued.

This checks a past run. It does not predict whether a live challenge will
pass.

## Rolling start dates

**Rolling start dates** uses every day of the run as a challenge start. It
answers the question: had I started on that day, would I have passed, broken
a rule, or run out of time?

- Each start is moved to begin at the profile's account size. Profit and
  loss are not rescaled, so lots are as tested.
- The chart shows one coloured cell per start day.
- The pass share counts only starts that reached a decision. Starts where
  the backtest ended first are left out.
- The starts overlap and share one history, so the share describes this
  backtest under these rules. It is not a probability of passing.
- Without a profit target (for example a funded-account profile), each start
  is followed for 30 days and counted as survived or broken.

## Whole challenges (two or three phases)

Under **What to check**, pick a **Then phase 2** profile, and optionally a
phase 3, for example FTMO Challenge → Verification. **Rolling starts through
2 phases** then follows every start day through each phase in turn:
- A pass starts the next phase on the next trading day, as a fresh account.
- Each start ends as completed, failed (the result shows which phase), or
  not decided.
- Hover a day to see how each phase went.

## Shortcuts

- **Check prop-firm rules…** on the report card in the sidebar opens this
  page with the current report selected.
- **Prop check** next to a saved combination on the Portfolio page opens it
  with that combination selected.
