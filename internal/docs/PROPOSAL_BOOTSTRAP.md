# Proposal: bootstrap Monte Carlo (resampling trades)

**Status:** DRAFT 2026-09-24. Awaiting the owner (B1–B7).

This is workflow gap 1 of the 7 that remain. The sources are in
`internal/references/REFERENCE_REGISTER.md`.

## Why

TRL's Monte Carlo reorders the actual trades. That shows how deep the
drawdown could have been in another order, but the final total never
changes, so it cannot answer "how often would this have ended in a loss?"
The Optimisation checklist (step 5) and the Research workflow list this as a
gap.

## What TRL would add

On **Advanced → Monte Carlo**, next to today's method:

1. **Three methods:**
   - **Reorder** (today): the same trades in a different order.
   - **Resample:** each path draws the same number of closed trades as the
     report, with replacement, so a trade may appear several times or not at
     all (Efron 1979; NIST 1.3.3.4).
   - **Resample in blocks:** each path joins blocks of consecutive trades,
     drawn with replacement, which keeps trades that depend on each other
     together (Künsch 1989). This is for DCA or grid baskets, and for
     reports where the significance check's runs test found streaks.
2. **Outputs, all from the Core:**
   - the spread of the final result: median, 5th and 95th percentiles
   - **the share of paths ending below zero**, the statistic reordering
     cannot give
   - drawdown percentiles (median, 80th, 90th, 95th), as today
   - optionally, **the share of paths whose drawdown exceeds your own
     limit**, entered in money (user-defined; no default)
   - a fan chart and a histogram, reusing today's visuals
3. **Tail caution:** NIST warns that the bootstrap is not appropriate for
   statistics that depend heavily on the tails.
   - The 99th percentile and the single worst path are shown as "less
     reliable" and are never used in the tips.
   - The tips use the median and the 80th to 95th percentiles.
4. **Labelled, sourced guidance** in the same style as the significance
   check:
   - what "% ending below zero" means, and what it does not (it describes
     this report's trades resampled, not future markets)
   - when to prefer blocks (streaks found; DCA or grid)
   - what to do next: for example, if many paths end below zero, check the
     interval on the significance section and extend the test
5. **Reproducible:**
   - the same seeded generator as today (PCG32), with the seed, method,
     block length, and path count recorded
   - the same maximum of 10,000 paths
6. **Record:** "Monte Carlo checked" goes into the Experiment note.

## Not included

- Choosing a block length automatically. The source gives only a growth
  condition, not a number.
- Resampling with a different number of trades per path (a longer or shorter
  horizon).
- Modelling costs, spread, or slippage. That is a separate gap.

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| B1 | Three methods on one Monte Carlo panel: Reorder (today), Resample, Resample in blocks | **Yes** |
| B2 | Outputs: final-result percentiles, % ending below zero, drawdown percentiles, and an optional % above your drawdown limit | **Yes** |
| B3 | The 99th percentile and the worst path are marked less reliable (NIST tail caution) and are not used in tips | **Yes** |
| B4 | The block length is your own number, with no default; the page suggests starting near the typical number of trades in one basket (a TRL suggestion), and "Resample in blocks" stays disabled until you set it | **Yes** |
| B5 | Seeded and reproducible, up to 10,000 paths, the same seed field as today | **Yes** |
| B6 | If the significance check found streaks, the Monte Carlo panel recommends the block method | **Yes** |
| B7 | Record "Monte Carlo checked" to the Experiment note | **Yes** |

## Build order

1. Core: add the resample and block methods beside the reordering in
   `monte_carlo.py` (new policy and calculation versions; today's method
   unchanged). Tests cover:
   - identical seeds give identical paths
   - resampling can change the total, while reordering never does
   - blocks keep consecutive trades together
   - the share ending below zero, checked by hand on small inputs
2. The plugin panel (method choice, block length, drawdown limit, outputs,
   guidance), then the record to the note.
3. Update the Help guides: close the gap, and set checklist step 5 to "In
   TRL".
