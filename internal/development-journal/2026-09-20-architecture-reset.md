# 2026-09-20 — Architecture Reset

## Change

Replaced the previous standalone browser/Python service/SQLite baseline with the
locked Obsidian Desktop plugin + Python Research Core architecture.

## Preserved knowledge

Raw-source immutability, MT5 evidence, Decimal precision, JPY regression,
broker time provenance, optional prop-firm overlays, reproducibility, and
Position-ID evidence requirements remain valid. Existing reports, documents,
code, tests, and external EA tooling were retained without deletion.

## Superseded work

The prior standalone browser, HTTP/FastAPI, SQLite, and root `src/` continuation
assumptions are no longer architecture authority. Pre-reset implementation is
paused and remains historical evidence only.

## New baseline

Created the private `internal/docs/` and `internal/adr/` baseline, including
Milestone 0, protocol, model, testing, release boundaries, roadmap, and handoff.
The next implementation, after owner review, is Milestone 0 only.

## Manual review

Review the architecture, protocol, Milestone 0 scope, repository boundaries,
and open-decision register before authorising the spike. In particular, confirm
that current pre-reset code is treated as reference rather than migrated blindly.
