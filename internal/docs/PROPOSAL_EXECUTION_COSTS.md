# Proposal: modelling spread, slippage, and execution delay

**Status:** DRAFT 2026-09-24. Awaiting the owner (X1–X7).

This is workflow gap 1 of the 4 that remain. The sources are in
`internal/references/REFERENCE_REGISTER.md`.

## Why

A backtest pays the spread in its price history. A real account can pay more:
- a wider or floating spread
- slippage when a market order fills at a worse price
- a delay between the request and the fill

Today TRL's What-If adds one fixed cost per closed trade. That fits a flat
commission, but spread and slippage grow with lot size, so for DCA or grid
EAs with growing lots a per-trade cost understates them.

## What TRL can and cannot model from a report

- **Can:**
  - each deal's volume and symbol, and whether it opened or closed a
    position
  - so an extra cost **per lot, per deal** is exact to apply: every opening
    and closing deal pays `extra per lot × its volume`
- **Cannot:**
  - the price path during a delay, or which fills would have been
    requoted; that needs ticks
  - MT5 already simulates delays in the tester: a random delay of 0–18 s
    (90 % within 0–8 s), or a fixed one, during which the price can change
    (MT5 Help: Strategy Testing)
  - so TRL does not invent a delay model; it guides you to run MT5 with a
    delay and compare

## What TRL would add

On **Advanced → What-If**:

1. **Extra cost per lot (X1):**
   - an extra cost in account currency per 1.0 lot, charged on every deal
     (opening and closing), for all symbols or overridden per symbol
   - two inputs, **extra spread** and **slippage**, which the Core adds
     together
   - the result is recomputed on closing-deal P/L plus the charges on
     opening deals: net, profit factor, win rate, expectancy, and maximum
     realised drawdown, each before and after
2. **Break-even cost (X2):** the extra cost per lot per deal at which the net
   result reaches zero (net ÷ total lots dealt). It is exact because the cost
   is linear. It answers "how much worse can execution get before the edge is
   gone?".
3. **Points-to-money helper (X3, optional):**
   - enter the extra spread in points plus the symbol's tick size and tick
     value from MT5's contract specification (Market Watch → Specification;
     MT5 defines tick size as the "minimum price change step" and tick value
     as the "cost of a single price change point")
   - TRL converts: points × point size ÷ tick size × tick value, per lot
   - labelled as TRL's derivation from those definitions; you can always
     type the money amount directly
   - the tick value must be in your account currency, which the page states
4. **Keep the per-trade What-If (X4):** today's fixed cost per closed trade
   stays as a second mode (for flat per-trade fees).
5. **Delay guidance (X5):** a sourced "How to test delay" note:
   - run the same test in MT5 with **Random delay**, import it, and compare
     it with the zero-delay report (both appear in Portfolio as tracks, or
     side by side on Analysis)
   - MT5 applies delays to EA trade requests; for pending orders only to
     placing them, not to their execution
6. **Real ticks note (X6):** with "Every tick based on real ticks" the test
   already paid the recorded, varying spread (MT5 Help: Real and Generated
   Ticks). The extra cost here is only what a real account adds on top: a
   wider broker spread, news, or slippage.
7. **Guidance and record (X7):**
   - labelled, sourced, hideable reading and tips (for example, "the edge
     survives up to X per lot; your broker's typical extra spread is Y")
   - "Execution costs checked" recorded to the Experiment note

## Not included

- Simulating the delay or requotes: MT5 does this with ticks.
- Spread that varies by time of day or news inside TRL (no tick data);
  per-symbol overrides only.
- Recomputing the significance test or Monte Carlo on the costed results;
  a later step if wanted.

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| X1 | An extra cost per lot per deal (extra spread plus slippage), for all symbols or per symbol, applied to opening and closing deals; before-and-after metrics | **Yes** |
| X2 | Break-even extra cost per lot (net ÷ lots dealt) | **Yes** |
| X3 | An optional points-to-money helper using the contract specification's tick size and tick value, labelled as TRL's derivation | **Yes** |
| X4 | Keep the fixed cost per closed trade as a second What-If mode | **Yes** |
| X5 | Delay is not modelled in TRL; sourced guidance to run MT5 with Random delay and compare the reports | **Yes** |
| X6 | State that real-tick tests already include the recorded spread; the extra cost is on top | **Yes** |
| X7 | Labelled, sourced, hideable guidance; record to the note | **Yes** |

## Build order

1. Core: an `execution_costs.py` scenario over the canonical events.
   Tests:
   - the per-lot charge by hand on opening and closing deals
   - per-symbol overrides
   - break-even: net after exactly the break-even cost is zero
   - the drawdown recomputed on the costed balance path
   - the points-to-money helper by hand
   Then the worker method and the note.
2. The plugin: a mode switch on What-If, the inputs, the before-and-after
   tiles, a break-even marker, the guidance model, and the record.
3. Update the Help guides: close the gap; Research workflow steps 3 and 7.
