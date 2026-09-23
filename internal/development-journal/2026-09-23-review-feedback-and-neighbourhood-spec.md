# 2026-09-23 — Owner review feedback; neighbourhood spec drafted

## Owner answers

- Review: OK.
- Multi-XML studies: deferred (PX-008).
- Neighbourhood analysis: draft the spec (PX-009).
- Release decisions R-D1 to R-D4 and the clean-machine install check:
  deferred.

## Feedback implemented

- **Track numbers.** Each track in "2. Tracks" shows its panel number. The
  number carries into the combination labels ("1. EURUSD_2025", or
  "Track 3" when unnamed), the library column ("In track 2 · …"), and the
  chain menu. The numbers stay stable when tracks are unticked: excluding
  track 2 gives labels 1, 3, 4. Model test updated; 63 plugin tests pass.
- **Stagnation shading.** The owner asked whether the grey area is the
  longest stagnation. It is (Core `stagnation.longest_by_time`), but it was
  explained only in the caption. The chart now has a visible legend with a
  swatch: "Shaded: longest stagnation (N days), the longest stretch without a
  new balance high". This applies to the Overview and Portfolio charts.
- Verified in the harness from the DOM only; the screenshots timed out while
  the owner was remote.

## Neighbourhood spec

`internal/docs/PARAMETER_NEIGHBOURHOOD_SPEC.md` (draft; N1–N7). Measured on
the real IS 2020–2024 study (173 genetic passes):
- at ±1 step, the median tested neighbours is 0 of 17 possible
- 9 of 19 frontier passes have none
- 116 of 216 logic cells were tested, with a median of one pass per cell

The spec therefore:
- puts coverage first
- lists the nearest tested settings without statistics
- requires at least 4 tested neighbours before showing statistics
- adds a "held fixed" parameter role (for lot size)
- proposes a targeted neighbourhood `.set` export for a full-grid MT5 run
  (amends PX-007)
