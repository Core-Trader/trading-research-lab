# Milestone 0 Foundation — 2026-09-20

## Objective

Create the first implementation boundary for the architecture spike without
starting product Milestone 1 or changing legacy reference material.

## Created components

- `research-core/`: Python 3.14-targeted source package and local NDJSON worker.
- `plugin/`: desktop-only Obsidian TypeScript/React/esbuild source package.
- `dev-vault/`: isolated development vault and manual acceptance dashboard.

## Decisions implemented

1. The worker uses protocol major `1` with `protocol`, `request_id`, `success`,
   `result`/`error`, and `engine_version` fields. Stdout is protocol-only.
2. The plugin starts the worker on demand, requires a capabilities handshake,
   applies a local request timeout, sends target-request cancellation, and
   terminates/restarts after a broken worker.
3. MT5 source files are read without modification. The worker exposes only
   source filename, hash, byte count, and worksheet name; it does not return
   the input's absolute filesystem path.
4. Canonical output is stored under the worker-owned workspace as Parquet plus
   a JSON manifest. The plugin receives logical artifact references, not
   canonical filesystem paths.
5. Reported balance is rendered as `VERIFIED`. Intratrade equity is explicitly
   `UNAVAILABLE` because the supported MT5 Deals export does not provide the
   mark-to-market facts required to reconstruct it.
6. The USDJPY fixture preserves the numeric price `158.425`. Its workbook does
   not provide usable display-format scale; therefore scale remains unavailable
   instead of inferring a JPY convention.
7. Generated notes use `trl_` frontmatter and a strict generated-content marker
   pair. Missing, duplicate, malformed, or unmatched markers block automatic
   update. Text outside the marker remains user-owned.

## Verification performed

- Parsed all Research Core Python source files successfully.
- Validated protocol-major handshake and structured cancellation output.
- Validated basic statistics: reported balance change agrees with signed closing
  event economics; equity remains unavailable.
- Imported the read-only USDJPY reference export: 153 source events and first
  trading price `158.425`.

These checks ran with Codex's isolated Python 3.12.14 for source/protocol
verification only. They do not substitute for Python 3.14.7 compatibility,
Parquet, plugin build, or Obsidian lifecycle acceptance.

## Manual review required next

Follow `internal/docs/MILESTONE_0_EXECUTION_STATUS.md` before declaring M0
accepted: install Python 3.14.7, Node.js with npm, and Obsidian Desktop; build
and enable the plugin only in `dev-vault/`; then run the controlled fixture and
perform the generated-note preservation check.
