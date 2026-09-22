# Journalit Reference Note

## Metadata

| Field | Record |
| --- | --- |
| Repository URL | https://github.com/Cursivez/journalit |
| Repository owner | `Cursivez` GitHub account shown by the repository URL; legal rights holder not independently verified. |
| Clone path | C:\DEV\TRL_External_References\journalit |
| Default branch | main |
| Date reviewed | 2026-09-20 — pinned architecture review. |
| Commit/hash reviewed | 098d27747df1b3a5fb177ff3a147d9a5cfbe0dcb |
| Working tree at review | Clean |
| Current licence / reuse status | Pinned licence observation: proprietary source-available. The developer/owner subsequently approved direct reuse subject to mandatory provenance tracking and a final usage report. |
| Role in Trading Research Lab | **Primary Obsidian/plugin architecture and trading-dashboard reference.** |

## Areas worth studying

- Obsidian custom views and dashboard architecture.
- Widget registration, draggable/resizable widgets, and widget persistence.
- Settings architecture, local-first patterns, and vault/file handling.
- Trading-dashboard UX, account/prop-firm views, and review templates.
- MT4/MT5-related workflows where documented.
- Build/release structure, performance/load behaviour, migration logic, and
  error handling.
- Premium/entitlement separation where visible.

## Areas not to copy

Do not copy, adapt, translate, port, or bundle any Journalit source code, tests,
comments, assets, styles, templates, build files, licence text, or release
artefacts. Do not treat its implementation as authoritative for Trading Research
Lab.

## Notes and actions

- If a concept or pattern is useful, write a Trading Research Lab specification
  and implement it independently with our own tests.
- If a particular implementation would materially help, stop first and identify
  the exact repository, commit, file/module/function, and intended use for the
  owner to seek permission or suitable licensing.
- See [JOURNALIT_ARCHITECTURE_MAP.md](JOURNALIT_ARCHITECTURE_MAP.md) and
  [TRL_REFERENCE_FINDINGS.md](TRL_REFERENCE_FINDINGS.md).
