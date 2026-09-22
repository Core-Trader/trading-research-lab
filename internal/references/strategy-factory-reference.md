# Strategy Factory Reference Note

## Metadata

| Field | Record |
| --- | --- |
| Repository URL | https://github.com/moyger/strategy_factory/ |
| Repository owner | `moyger` GitHub account shown by the repository URL; legal rights holder not independently verified. |
| Clone path | C:\DEV\TRL_External_References\strategy_factory |
| Default branch | main |
| Date reviewed | 2026-09-20 — pinned architecture review. |
| Commit/hash reviewed | 31e778a78b465ce1a0e16e232f762ebe8ca80b52 |
| Working tree at review | Clean |
| Current licence / reuse status | No repository LICENSE file found in the pinned review. The developer/owner subsequently approved direct reuse subject to mandatory provenance tracking and a final usage report. |
| Role in Trading Research Lab | **Secondary quantitative/research implementation reference.** |

## Areas worth studying

- Python package and module structure.
- Strategy analysis, optimisation, Monte Carlo, portfolio analysis, and risk
  management.
- Walk-forward analysis, result schemas, and data-loading patterns.
- Metric definitions, dependency choices, documented failure cases, and
  debugging notes.

## Quantitative validation boundary

No quantitative implementation from Strategy Factory is assumed correct merely
because it exists. Any idea adopted by Trading Research Lab must be independently
validated against this project's specifications, deterministic fixtures, verified
metric definitions, and regression tests.

## Direct-reuse control

Do not reuse Strategy Factory source, tests, comments, assets, styles,
templates, build files, licence text, or release artefacts indiscriminately.
Direct reuse is allowed only when technically justified and is recorded
immediately in `EXTERNAL_CODE_USAGE_REGISTER.md`, with the exact commit/source,
TRL destination, changes, validation, dependencies, and product scope.

## Notes and actions

- Treat this only as a secondary research reference; Trading Research Lab's own
  deterministic, provenance, and qualification rules remain authoritative.
- If a particular implementation would materially help, identify the exact
  repository, commit, file/module/function, intended use, and validation plan;
  record the reuse in the authoritative usage register in the same change where
  practical.
- See [STRATEGY_FACTORY_ARCHITECTURE_MAP.md](STRATEGY_FACTORY_ARCHITECTURE_MAP.md)
  and [TRL_REFERENCE_FINDINGS.md](TRL_REFERENCE_FINDINGS.md).
