# 2026-09-23 — Independent MVP hardening (PL-007, MVP-C, MVP-D)

Done without owner input after the owner asked to "proceed with steps that
don't require my input".

## Saved combinations persist (PL-007)

- Core `portfolio_lab.py`: `save_combination`, `list_saved_combinations`, and
  `delete_saved_combination`, with worker methods of the same names under
  `portfolio.*`. Only the setup is stored (name, labels, tracks, capital,
  window, day boundary) in `<workspace>/portfolio-combinations/<key>.json`.
  Results are recalculated on every list, so saved numbers can never drift
  from the current calculation version.
- Saving an identical setup replaces the earlier entry (a rename, or a key
  from an older calculation version).
- A setup whose reports are missing is listed with its error; the plugin shows
  it with a Remove button.
- Plugin: loads on open, saves and removes through the Core, and shows
  "Rename saved combination" when the setup is already saved.
- Tests: 6 new Core tests and 1 plugin IPC-mapping test.

## Narrow width (MVP-C)

A harness with real Core output (IS 2020–2024 study, forward 2025, and four
2025 reports) at 420 px and 320 px found these problems, now fixed:
- the period select and the save-name input overflowed the pane
- the objective editor had a 20rem minimum
- the hover card pushed the page to 466 px wide
- the long y-axis title squeezed the plot to about 40 px

Fixes: `min()`-bounded flex bases, and a container query on `.trl-tradeoff`
(below 30rem, the card spans the plot top and the y-axis title turns
vertical). The forward hover line now shows only profit, drawdown, and the
plotted metrics instead of all 9. After the fix the page is 320 px wide at
320 px, and only the intended tables scroll.

## Release readiness (MVP-D)

- `scripts/build_release.py` and its tests: an explicit allowlist, a blocking
  check, and a hash manifest (see `internal/docs/MVP_D_RELEASE_READINESS.md`).
- The real repository assembles clean: 33 files.
- The worker runs from the release folder alone (IPC capabilities, a real
  report import, and the saved list).
- Product help: `product-docs/INSTALL.md`, `MT5_EXPORT_GUIDE.md`, and
  `README.md`.
- A portability bug was found and fixed: the worker workspace path used a
  literal `\`.
- The internal doc reference was removed from the `portfolio_lab.py`
  docstring.

## Owner items prepared, not decided

- `internal/docs/MVP_OWNER_REVIEW_CHECKLIST.md`: a guided 30–45 minute
  Obsidian review.
- Release decisions R-D1 to R-D4 (licence, Python distribution, notices,
  channel).
- Multi-XML studies (recommended: defer) and the neighbourhood-analysis spec
  (recommended: after the release).
