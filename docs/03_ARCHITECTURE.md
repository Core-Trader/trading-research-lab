# Architecture

## Architectural principle

The browser presents results; it does not calculate financial truth. A Python domain layer turns immutable imported evidence and versioned assumptions into deterministic replay outputs.

```text
MT5 export -> import adapter -> raw evidence + normalised records
                                      |
                          validation / reconciliation
                                      |
scenario + policies -> deterministic replay engine -> run ledger / projections
                                      |
                          SQLite + local API -> React / TypeScript GUI
```

## Components

| Component | Responsibility | Must not do |
| --- | --- | --- |
| React/TypeScript UI | Local interaction, visualization, evidence navigation | Financial calculations or silent defaults |
| Python API/application service | Commands, queries, authorization boundary for future use | Embed UI behavior in domain rules |
| Import adapters | Parse one documented source layout into canonical records | Infer missing trading facts without warning |
| Validation service | Field checks, reconciliation, data-quality classification | Alter raw imports |
| Replay engine | Ordered-event account projections and risk checkpoints | Read files, call HTTP, or mutate source records |
| Analytics/reporting | Derived metrics and reproducibility exports | Replace the canonical replay ledger |
| SQLite repositories | Transactional local persistence | Act as an undocumented calculation engine |

## Deployment shape

V1 is one local process group: a Python service, SQLite database, local data directory, and a browser-accessible UI bound to loopback. No external services are required to inspect or reproduce a run.

## Domain boundaries

- **Evidence:** raw imports and parser observations.
- **Canonical data:** strategies, backtests, trades, events, and source mappings.
- **Simulation:** scenario/account configuration, optional broker-time profile, and optional versioned risk/prop-firm policies.
- **Replay:** immutable run inputs, ordered ledger, snapshots, violations, and metrics.
- **Presentation:** read models and charts derived from run outputs.

## Persistence rules

- Database records use stable IDs; raw files use content hashes.
- A replay never mutates a previous run. Changed data, engine semantics, or configuration creates a new run.
- Schema migrations, parser versions, engine version, and calculation-policy versions are stored with outputs.

## Technology constraints

Python and React/TypeScript are mandated for the initial build. SQLite is suitable for a local single-user V1. If concurrent users, server deployment, or large-scale workloads become a requirement, record a decision before adopting a different database or deployment model.

## Security and privacy baseline

Imports may contain proprietary performance information. Keep data local, exclude it from Git, avoid automatic telemetry, and require explicit action before any future upload/export integration.
