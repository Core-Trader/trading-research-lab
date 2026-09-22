# Repository Layout and Release Boundaries

## Recommended future tree

```text
trading-research-lab/
├── CLAUDE.md                         # Internal coding-agent entry point
├── README.md                         # Repository overview, not product help
├── LICENSE                           # Deferred owner choice
├── THIRD_PARTY_LICENSES.md           # Dependency inventory template
├── .gitignore
├── internal/                         # PRIVATE: never product-packaged
│   ├── docs/
│   ├── adr/
│   ├── handoffs/
│   ├── playbooks/
│   ├── development-journal/
│   └── references/                    # Private external-reference records
├── plugin/                           # Product-distributable Obsidian plugin
│   ├── manifest.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── esbuild.config.mjs
│   ├── src/
│   │   ├── main.ts
│   │   ├── application/
│   │   ├── components/
│   │   ├── views/
│   │   ├── services/
│   │   ├── entitlements/
│   │   ├── engine/
│   │   └── vault/
│   └── styles.css
├── research-core/                    # Product-distributable engine source
│   ├── pyproject.toml
│   ├── src/trading_research_core/
│   │   ├── importers/
│   │   ├── canonical/
│   │   ├── analytics/
│   │   ├── portfolio/
│   │   ├── monte_carlo/
│   │   ├── money_management/
│   │   ├── risk/
│   │   ├── protocol/
│   │   └── entitlements/             # Interface only; no commercial logic
│   └── tests/
├── tests/                            # Controlled cross-package fixtures/integration
│   ├── fixtures/{mt5,canonical,expected}/
│   └── integration/
├── product-docs/                     # Future distributable operational help only
├── scripts/                          # Reproducible dev/release support scripts
└── legacy-pre-reset/                 # Optional future archive; not packaged
```

The disposable development vault is deliberately outside the repository at
`C:\DEV\vaults\TRL-Dev-Vault\`. Its plugin load path is
`C:\DEV\vaults\TRL-Dev-Vault\.obsidian\plugins\trading-research-lab\`.
The older nested `dev-vault/` is preserved as ignored legacy local staging and
is not the authoritative development vault.

## Source control and local material

| Category | Source controlled | Product release | Notes |
| --- | --- | --- | --- |
| `plugin/`, `research-core/`, controlled tests | Yes | Yes, subject to licence review | Product code and test source |
| `internal/` | Yes, private repository | No | Development-only material |
| `product-docs/` | Yes | Potentially | Only user operational documentation |
| `C:\DEV\vaults\TRL-Dev-Vault\`, raw reports, worker cache, compiled output | No | No | Local/generated and ignored |
| Personal research vault | No, separate | No | Never treated as repository content |

## Release packaging rule

Future release tooling must use an explicit allowlist: plugin build assets,
approved bundled worker assets, and `product-docs/` only. It must not package by
copying the repository root. The release check fails if `internal/`, test data,
development vault material, raw data, journals, handoffs, or private course
material is present.

## Current reset handling

The current root `docs/`, `journal/`, `src/`, and `tests/` remain intact as
pre-reset evidence. They are not yet moved or deleted. The new baseline under
`internal/` is authoritative for subsequent work.
