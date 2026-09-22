# 2026-09-22 — MVP view modularisation and import hardening

**Track:** MVP Fast Track, MVP-B/MVP-C (`internal/docs/MVP_FAST_TRACK.md`).
**External code:** none reused; no entry in `EXTERNAL_CODE_USAGE_REGISTER.md`.

## Why

`plugin/src/research-view.tsx` still held every panel, vault helper, and worker
method name in ~1,150 lines, so any MVP UI change risked unrelated panels.
MVP-A called for splitting presentation responsibilities behind a lightweight
worker-facing application boundary; that split was incomplete.

## What changed

- `application/research-service.ts` — typed `ResearchService` over a minimal
  `WorkerTransport`. It is now the only plugin location that names worker IPC
  methods. It performs no calculation. The view resolves `plugin.worker` per
  request because saving settings replaces the worker instance.
- `application/latest-run.ts` — `LatestRun` token. A superseded import (e.g. a
  second report chosen before the first finishes) can no longer overwrite the
  newer run's dashboard results. It does not cancel worker requests.
- Import buttons are disabled during an import; Overview shows the progress
  line (`role="status"`) and states that visible cards belong to the previous
  import until the run finishes. Browsing a report no longer jumps to
  Data & import first.
- `components/dashboard-model.ts` — pure mapping from Core results to card text.
  Missing Core values render as `Unavailable`, never zero. The Verified close
  events card now shows the Core-supplied `win_rate`; the daily-risk card shows
  the Core-supplied percentage of the daily reference balance.
- Panels moved verbatim into `components/{data,analysis,research,advanced}/`,
  plus `balance-chart.tsx` and `collapsible-section.tsx`; vault helpers into
  `vault/research-vault.ts` (`useCurrentDocument` renamed `readCurrentDocument`,
  since it is not a React hook); Electron file-path lookup into
  `services/local-file-path.ts`.
- Fixed two doubly nested collapsibles: "Technical source evidence" wrapped
  "Dataset evidence", and "Local run diagnostics" wrapped itself.

## Validation

- Plugin: 15/15 Node tests pass (8 new: service method/param mapping,
  superseded-run rejection, dashboard view-model including Unavailable ≠ 0).
- `npm run build` (tsc + esbuild production) passes.
- Research Core: 42 tests pass (unchanged).
- **Not yet validated:** Obsidian visual/manual behaviour of the moved panels,
  the progress line, and the win-rate display. This belongs to the pending
  owner usability pass.

## Deferred

- **DEFERRED — POST-MVP:** cancelling superseded worker requests (they currently
  run to completion and their results are discarded).
- Whole-period realised-balance peak-to-trough drawdown is **not** provided by
  the Core (only daily and Monte Carlo drawdown exist). It would be a new Core
  calculation needing a specification and fixtures before any dashboard card.
