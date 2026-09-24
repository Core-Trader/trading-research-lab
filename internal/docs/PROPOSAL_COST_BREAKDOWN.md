# Proposal: cost breakdown, including opening commissions

**Status:** APPROVED and BUILT 2026-09-24 (the owner accepted C1–C5 as recommended; C6 deferred).

**Built:**
- Core `cost_breakdown.py` (`cost-breakdown-1`); worker `analysis.cost_breakdown` and `analysis.render_cost_note`.
- Plugin: the Analysis widget "Costs: commissions and swaps" (tiles, a before-costs-to-net step chart, reconciliation, by-symbol and by-month tables), `cost-model.ts` guidance, the Overview net P/L tile note, and record to note.
- **Checked on the dev vault's 10 real reports:** all reconcile to the cent. Four distinct reports charge the same commission on opening as on closing deals, so per-trade figures left out half the commission. A net swap credit gave a negative cost share; that is now reported as a credit, not a share.

This is workflow gap 1 of the 5 that remain. The sources are in
`internal/references/REFERENCE_REGISTER.md`.

## Why

- **Opening commissions are missed.** TRL's per-trade figures use the
  closing deal only (its profit, commission, and swap). MT5 often charges
  commission when a position **opens** too, as a separate "in" deal. Those
  commissions are in the report's balance but not in TRL's close-event net
  P/L, win rate, expectancy, SQN, or significance test.
- **No cost view.** There is no view of how much of the result went to costs.
  That matters most for high-frequency or grid EAs, where many small trades
  each pay commission.

TRL already has every number it needs. Each imported deal keeps its profit,
commission, swap, symbol, and volume, and the import checks that they add up
to the report's balances and totals row.

## What TRL would add

1. **"Costs" section on Analysis (C1),** a movable widget:
   - **Trade result before costs:** the sum of profit on closing deals.
   - **Commissions, split:** charged on opening deals and on closing deals.
   - **Swaps, split:** charged against credited.
   - **Net result** = the balance change.
   - **Reconciliation line:** opening balance + trade result + commissions +
     swaps = final balance, to the cent. A mismatch is shown as a finding,
     never hidden.
2. **Honest per-trade figures (C2):**
   - The close-event metrics stay as they are (closing-deal costs only);
     the page states this where they appear.
   - When opening commissions exist:
     - the Overview's net close-event P/L tile says "excludes X of opening
       commissions; the balance change includes them"
     - the Costs section shows the average opening commission per closed
       trade
   - No per-trade reallocation. Pairing openings to closings is only inferred
     in TRL (M2), and mixing that into verified figures would blur the
     quality labels.
3. **Breakdowns (C3):** tables by symbol and by month, each with the trade
   result before costs, commissions, swaps, net, and costs as a share of the
   trade result before costs (when that is positive).
4. **Cost intensity (C4):**
   - the average cost per closed trade
   - the commission per lot (total commission ÷ total dealt volume)
   - costs as a share of the gross profit
   - tips link these to the significance section (compare the average cost
     with the interval's lower end) and to What-If
5. **Guidance and record (C5):**
   - labelled, sourced reading and tips (MT5 Strategy Testing help on
     commission modes; MT5 Testing Report definitions) through the shared,
     hideable guidance
   - "Costs checked" recorded to the Experiment note

## Not included

- **Reports with accumulated commissions or reversal deals.** Commissions
  charged daily or monthly in one operation, and "in/out" reversal deals, are
  currently rejected at import ("Unsupported MT5 deal semantics"). Accepting
  them changes the canonical event model; see C6.
- **Spread and slippage.** They are inside the prices, not listed in MT5
  reports. That is the next workflow gap (modelling spread, slippage, or
  execution delay).
- **Reallocating opening commissions to individual trades.**

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| C1 | A Costs section on Analysis: trade result before costs, commissions (opening and closing), swaps (charged and credited), net, and an exact reconciliation to the final balance | **Yes** |
| C2 | Per-trade figures stay closing-deal only, clearly stated; the Overview net P/L tile notes the excluded opening commissions; no reallocation | **Yes** |
| C3 | Breakdowns by symbol and by month, with the cost share | **Yes** |
| C4 | Cost intensity: average cost per closed trade, commission per lot, and cost share of gross profit; tips link to significance and What-If | **Yes** |
| C5 | Labelled, sourced, hideable guidance; record to the note | **Yes** |
| C6 | Accepting accumulated daily/monthly commission deals and reversal deals at import | **Defer:** a separate proposal, because it changes the canonical event model (DATA_MODEL.md) |

## Build order

1. Core: `cost_breakdown.py` over the canonical events, with no new storage.
   Tests:
   - opening and closing commissions split correctly
   - swap charged against credited
   - an exact reconciliation, and a deliberately broken one that is flagged
   - by-symbol and by-month totals that add up to the report total
   - commission per lot by hand
   Then the worker method and the note renderer.
2. The plugin widget, the guidance model, the Overview tile note, and the
   record to the note.
3. Update the Help guides: close the gap and mention the Costs section in
   Research workflow step 7.
