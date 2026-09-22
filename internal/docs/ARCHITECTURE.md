# Architecture

## Locked system shape

Trading Research Lab V1 is a desktop-only Obsidian plugin with an isolated local
Python Research Core. Obsidian owns the application shell, vault integration,
settings, navigation, commands, and React views. The Python Core is the sole
authority for quantitative calculation and canonical-data transformation.

```text
Obsidian Desktop
  └─ Trading Research Lab plugin (TypeScript / React / Obsidian API)
       ├─ application services, view state, entitlement boundary, vault adapter
       └─ versioned JSON IPC client
              │ stdio NDJSON, local child worker only
              ▼
       Python Research Core (disposable subprocess)
       ├─ importers / canonical model / analytics / risk / portfolio
       ├─ Parquet + JSON analytical workspace
       └─ deterministic result and provenance manifests

Obsidian vault
  └─ Markdown research notes + YAML/frontmatter + generated sections
```

There is no required HTTP server, FastAPI service, remote account, telemetry, or
cloud component.

## Process and failure boundaries

- The plugin starts the worker lazily for an explicit research operation; plugin
  load and view construction stay lightweight.
- The worker is disposable. A crash returns a structured unavailable state in
  the plugin, preserves prior files, and can be restarted by the application
  service without restarting Obsidian.
- The UI never calculates financial truth. It renders worker results and sends
  user intent/configuration through the protocol.
- The worker has no Obsidian API dependency. It can be run and tested from a
  development environment independently of the plugin.

## IPC transport decision for Milestone 0

Milestone 0 uses newline-delimited JSON (NDJSON) on child-process stdin/stdout.
It gives unambiguous framing, works directly with Node child processes on
Windows, avoids port conflicts and local HTTP, and is observable in test logs.
Only protocol messages may use stdout; diagnostics use stderr. The precise
contract is in `ENGINE_PROTOCOL.md`. The spike must prove restart, cancellation,
large-result references, and malformed-message handling before this transport
is treated as production-validated.

## Data zones

| Zone | Primary format | Meaning | Mutation rule |
| --- | --- | --- | --- |
| Raw source | Original files + JSON provenance | MT5 exports and optional forensic artifacts | Immutable after intake |
| Canonical | Parquet + JSON schema/manifest | Versioned, source-independent analytical records | Rebuildable from raw source and importer version |
| Derived/cache | Parquet/JSON | Result tables, chart series, temporary indexes | Disposable and rebuildable |
| Human research | Markdown + YAML/frontmatter | User research, conclusions, experiments, generated reports | User text is preserved; plugin updates bounded generated sections only |

SQLite is not a canonical store in V1. It may be reconsidered only through a
future ADR with demonstrated database-semantic need.

## Product boundaries

- `research-core/` contains no Obsidian, licensing, payment, or vault logic.
- `plugin/` contains no duplicated statistical, trade, drawdown, or risk logic.
- `plugin/src/entitlements/` exposes capability/limit queries only. The personal
  development provider returns all capabilities and unlimited limits. No
  commercial system is implemented in V1.
- Internal engineering documents are excluded from product release allowlists.

## Vault safety

The source repository, development vault, fixtures, and personal vault are
separate. The plugin writes only to explicit, user-selected vault locations and
must never overwrite user prose. Plugin-owned frontmatter uses `trl_` keys.
Generated Markdown is bounded by stable markers and regenerated atomically only
within those markers.
