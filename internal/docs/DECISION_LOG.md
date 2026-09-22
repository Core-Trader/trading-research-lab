# Active Decision Log

| ID | Decision | Status |
| --- | --- | --- |
| ADR-001 | Obsidian Desktop is the V1 shell | Locked |
| ADR-002 | V1 is desktop-only | Locked |
| ADR-003 | Python 3.14.7 Research Core is the sole calculation authority | Locked |
| ADR-004 | Local subprocess + versioned JSON IPC; no default HTTP/FastAPI | Locked |
| ADR-005 | Parquet + JSON + Markdown/YAML, not default SQLite | Locked |
| ADR-006 | Repository, dev vault, and personal vault are separate | Locked |
| ADR-007 | TypeScript/React/esbuild/npm/Obsidian API plugin stack | Locked |
| ADR-008 | Milestone 0 validates the complete vertical path first | Locked |
| ADR-009 | Personal-first with an entitlement boundary, no commercial system | Locked |
| ADR-010 | Internal development material is private and excluded from releases | Locked |
| ADR-011 | Local-first, zero telemetry, no mandatory network | Locked |
| ADR-012 | Deterministic versions/manifests/seeds are required | Locked |
| ADR-013 | Raw source is immutable with provenance | Locked |
| ADR-014 | Dependencies require compatibility and licence review | Locked |
| M2-POL-001 | Regular MT5 Excel supports only source-verified close events by default; optional inferred lifecycles require a displayed `USER_SUPPLIED` `HEDGING` declaration | Approved for M2 |
| M2-POL-002 | Inferred M2 pairing uses `mt5-excel-hedging-fifo-v1`: chronological FIFO within identical symbol and direction, Decimal allocation, and quality-separated presentation | Approved for M2 |
| M2-ACC-001 | M2 implementation and manual Obsidian review accepted; Milestone 2 closed | Closed |
| M3-POL-001 | Source-reported-clock analysis is the default; optional broker-time profiles are used only when a user selects a conversion or policy-specific calendar | Approved for M3 |
| M3-POL-002 | Basic M3 daily drawdown is realised-balance-only; intratrade equity is unavailable without timestamped floating-P/L/mark evidence | Approved for M3 |
| M3-POL-003 | Broker- and prop-firm-specific rules are deferred as optional versioned overlays | Approved for M3 |
| M3-ACC-001 | M3 implementation and manual Obsidian review accepted; Milestone 3 closed | Closed |
| M4-POL-001 | M4 creates only explicit strategy/experiment/report documents with UUIDv7 identities and explicit relationships; it does not scan or infer unrelated vault content | Approved for M4 |
| M4-POL-002 | Report regeneration is change-aware: unchanged managed content makes no write/revision and returns `NO_CHANGES_DETECTED`; changed content requires confirmation and increments the revision manifest | Approved for M4 |

Historical decisions in `journal/` remain evidence but do not override this
reset. Valid domain decisions—such as decimal precision, broker-time provenance,
and optional prop-firm overlays—are retained through the new data/model docs.
