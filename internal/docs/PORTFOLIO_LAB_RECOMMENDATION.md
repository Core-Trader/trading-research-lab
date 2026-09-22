# Portfolio Lab — Clarified Intent and Recommended Next Steps

**Date:** 2026-09-22. **Status:** Recommendation awaiting owner confirmation of
decisions R1–R6. It supersedes the framing of
`PORTFOLIO_CONCURRENT_COMBINATION.md` §2–§3 once confirmed.

## 1. Owner intent (as stated 2026-09-22)

> Import several EA backtests, select several tests, and see side by side how
> different combinations on one account would have balanced return against
> drawdown over the periods they were active. Later: check whether a
> combination would have held up against a prop firm's rules before paying for
> a challenge.

This is a **concurrent portfolio** workflow (FXOptimize-like), not the
sequential continuation that M5 implements. Portfolio aggregation is currently
**DEFERRED — POST-MVP** in `MVP_FAST_TRACK.md`; this intent pulls it into the
product's core purpose.

## 2. Facts from the owner's real reports

| Fact | Consequence |
| --- | --- |
| Two EAs (`EA_DCA_CENT_V1`, `DCA_EA`), all EURUSD H4 | Combinations are same-symbol, so correlation and stacked exposure will be high and must be visible |
| `InpLotSizeMode=0` (fixed lots) in all four | "As reported" combination (no lot rescaling) is a sound v1 for these EAs |
| Two `DCA_EA` reports are consecutive (Jan–May, May–Sep 2026) | That is M5's case. A portfolio member should be a **strategy track**: one report or an M5-validated consecutive chain |
| Two reports are `EA_DCA_CENT_V1` over overlapping periods with different multiplier settings | Two variants of one EA can be combined, but they are highly correlated; the duplicate-trade guard must catch identical re-runs |
| DCA with lot multipliers (settings 1 and 5) | Losing positions stay open: **equity drawdown can far exceed realised-balance drawdown.** MT5 Excel reports have no equity series |

## 3. Recommended scope (Portfolio Lab v1)

1. **Strategy tracks.** Each imported report is a track, and consecutive
   reports of the same EA can be chained into one track (reusing M5
   preflight). The M5 panel becomes the "chain reports" step instead of a
   standalone feature.
2. **Side-by-side track comparison.** The C1/C2 metrics per track in one table,
   plus overlaid cumulative P/L curves and active-period bars.
3. **Combination engine (Core).** For a user-selected set of tracks and a
   declared starting capital: merge verified close events chronologically; each
   track contributes **only during its own active period** (union window).
   Outputs: combined balance, C1 metrics, per-track contribution, drawdown
   overlap (combined versus individual maximum drawdowns), daily-P/L
   correlation, and an "active tracks over time" band.
4. **Combination comparison.** Save several named combinations and compare them
   in one table, a **return-versus-drawdown scatter**, and overlaid curves.
5. **Combination explorer (decision R3).** Optionally enumerate every subset of
   up to about 10 tracks (1,023 combinations) and plot them all on the
   return-versus-drawdown scatter, with an optional Pareto-frontier overlay.
   This is where the "no automatic selection" rule needs an explicit owner
   decision.

## 4. Prop-firm module (later), and what to prepare now

**Rules to model:** a user-declared rule profile (profit target, maximum daily
loss, maximum overall loss (static or trailing), minimum trading days, time
limit, and the daily reset time and timezone), evaluated against a
combination: breach timeline, days to target, and a seeded Monte Carlo
"pass-rate" over the same combination.

**Critical evidence gap:** most firms measure daily and overall loss on
**equity** (including floating losses) at the firm's reset time. TRL only has
realised balance from MT5 Excel reports. For DCA/martingale-style EAs a
realised-balance check is **systematically optimistic** and could approve a
combination that would fail a real challenge. Options:

- A. **Realised-balance evaluation only, clearly labelled** "optimistic lower
  bound of breach risk". Not recommended as the basis for paying for a
  challenge with DCA EAs.
- B. **Equity evidence source (recommended):** a small MQL5 logger include (or
  the retained forensic-EA approach) that writes timestamped balance and
  equity samples during Strategy Tester runs, imported by a new adapter as
  `MT5_VERIFIED` equity. Prop-firm checks then use real floating drawdown.
- C. MT5 HTML report graph data is not machine-readable; not viable.

**To lock now so the prop module fits later:**
- The combination engine emits a merged per-event stream and a daily series
  keyed by a **configurable day boundary** (the report clock by default, with a
  slot for a timezone and reset-time profile).
- Track and combination identities are deterministic, so a prop evaluation can
  cite the exact combination it tested.
- Equity is a separate optional input channel per track, never faked from
  balance.

## 5. Recommended sequence

| Step | Deliverable | Needs |
| --- | --- | --- |
| 0 | Confirm decisions R1–R6; record the scope change in `MVP_FAST_TRACK.md`, `ROADMAP.md`, and `DECISION_LOG.md` | Owner |
| 1 | Revised Portfolio Lab spec plus fixtures (tracks, union window, combination engine, comparison) | Docs |
| 2 | Tracks and side-by-side comparison (mostly plugin; reuses C1/C2 per report) | Small |
| 3 | Core combination engine plus combined dashboard | Medium |
| 4 | Saved combinations with return-versus-drawdown scatter | Small–medium |
| 5 | Combination explorer (only if R3 = yes) | Medium |
| 6 | Equity-evidence spec (logger include and adapter), in parallel | Spec + MQL5 |
| 7 | Prop-firm rules module on the combination engine | After 3 and 6 |

## 6. Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| R1 | Make Portfolio Lab (concurrent combination) the primary multi-import workflow and move it into the MVP? | **Yes** |
| R2 | Window: each track contributes only during its own active period (union)? | **Yes**, with an "active tracks" band and an optional common-window view |
| R3 | Allow the combination explorer (all subsets plotted; optional Pareto overlay, no "best" label)? | **Yes, descriptive only**. This relaxes the no-selection rule for portfolio membership, not for EA parameters |
| R4 | Starting capital | Declared by you per combination |
| R5 | Sizing | "As reported" only in v1; weights and rescaling later (money management) |
| R6 | Prop-firm evidence basis | Build the equity logger (option B) before the prop module; realised-only (A) as a clearly labelled preview |
