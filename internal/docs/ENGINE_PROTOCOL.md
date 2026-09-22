# Engine Protocol

## Transport and framing

Milestone 0 uses UTF-8 NDJSON on a local child process's stdin/stdout. Each line
is one complete JSON object. Worker diagnostics go to stderr, never stdout.
There is no HTTP listener. The plugin owns process start, timeout, shutdown, and
restart.

## Envelope v1

Request:

```json
{"protocol":1,"request_id":"uuid","method":"core.capabilities","params":{}}
```

Success response:

```json
{"protocol":1,"request_id":"uuid","success":true,"result":{},"engine_version":"0.1.0"}
```

Error response:

```json
{"protocol":1,"request_id":"uuid","success":false,"error":{"code":"INVALID_SOURCE","message":"...","details":{}},"engine_version":"0.1.0"}
```

Every request and response must contain the matching `protocol` and
`request_id`. Unknown methods, malformed JSON, unsupported protocol versions,
and invalid parameters return structured errors without process termination when
possible.

## Current methods

| Method | Purpose |
| --- | --- |
| `core.capabilities` | Protocol, engine, schema, and feature handshake |
| `dataset.import_mt5_excel` | Import controlled fixture into canonical data and manifest |
| `dataset.intake_mt5_excel` | Create or reuse a verified managed raw snapshot and dataset receipt |
| `dataset.list_registry` | List bounded local dataset evidence entries |
| `dataset.get_evidence` | Return evidence for one dataset |
| `dataset.verify_raw_snapshot` | Recompute the managed-snapshot SHA-256 against recorded evidence |
| `analysis.basic_statistics` | Return basic completed-deal statistics and balance/equity availability |
| `analysis.close_event_summary` | Write source-verified close-event artifact and return compact metrics |
| `analysis.reconstruct_lifecycles` | With an explicit account-mode declaration, write M2 lifecycle artifact and return compact quality-separated metrics |
| `analysis.lifecycle_summary` | Return the same deterministic lifecycle summary/artifact contract as M2 reconstruction |
| `time.validate_profile` | Return the default source-reported-clock basis and its explicit limits |
| `analysis.realised_balance_daily_drawdown` | Write source-clock realised-balance daily-drawdown artifact and return compact qualified metrics |
| `analysis.equity_availability` | State whether the selected source can support intratrade equity analysis |
| `report.prepare_payload` | Return a deterministic, compact M4 report candidate without writing a revision |
| `report.commit_revision_manifest` | After a changed vault write, record the versioned local report manifest |
| `experiment.render_payload` | Return note metadata and bounded generated Markdown payload |
| `core.cancel` | Request cancellation by target request ID |
| `core.shutdown` | Graceful worker shutdown |

## Large results and paths

Large tabular/series results are written by the worker to its controlled
analytical workspace as Parquet/JSON, then returned as versioned artifact
references with hashes and compact summaries. The plugin never receives an
unbounded dataset in one message. All paths are worker-owned logical artifact
references, not arbitrary plugin-provided filesystem paths.

## Lifecycle

- Plugin starts worker on demand and performs `core.capabilities` handshake.
- Per-operation timeouts live in the plugin application service; timeout first
  sends `core.cancel`, then terminates/restarts the worker if required.
- A broken stream marks the worker unavailable, rejects pending requests with a
  recoverable error, and leaves source/canonical files untouched.
- Protocol compatibility is negotiated by major version; incompatible majors
  fail before work begins. Additive fields must be ignored safely by older
  compatible consumers.

## Logging and privacy

Protocol logs record request ID, method, duration, versions, outcome, and safe
artifact IDs. They do not record credentials, raw comments, unbounded data, or
private research prose.
