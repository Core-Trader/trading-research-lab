# Environment and Development-Vault Baseline

## Development environment

- Windows desktop with Obsidian Desktop.
- Python 3.14.7 target runtime; Milestone 0 verifies exact runtime and packages.
- Node.js/npm for the Obsidian plugin; exact supported versions are recorded by
  the spike after compatibility checks.
- Git for source, excluding personal vaults, raw data, caches, and build output.
- Existing portable MT5 remains an optional local source/evidence tool, not a
  runtime dependency of the plugin.

## Observed workstation status — 2026-09-20

- The project target Python 3.14.7 was not discoverable through the standard
  Windows launcher, registry, or usual installation locations. An isolated
  bundled Python 3.12.14 exists for Codex tooling only and is not an approved
  project runtime.
- A Codex-bundled Node runtime and `pnpm` exist, but system `node`, `npm`, and
  `corepack` were not available in the working PowerShell session. This does not
  satisfy the locked npm development toolchain.
- Obsidian Desktop was not found in standard local or roaming installation
  locations. No automatic software installation was attempted.

The required owner review and installation steps are maintained in
`MILESTONE_0_EXECUTION_STATUS.md`.

## Development vault

`C:\DEV\vaults\TRL-Dev-Vault\` is the disposable Obsidian development vault.
It is outside the source repository and used only for plugin development and
tests. It contains controlled test notes, never the user's production research.
The plugin load path is
`C:\DEV\vaults\TRL-Dev-Vault\.obsidian\plugins\trading-research-lab\`.

The repository's historical nested `dev-vault/` remains ignored and preserved;
it is not the authoritative vault and must not be used for new development.

## Worker environment abstraction

The plugin receives a worker launch contract rather than assuming a user-managed
Python installation forever. Development launches the project Python environment;
future distribution may replace it with a packaged executable while preserving
the same IPC protocol. No packaged runtime is built in Milestone 0.

## Setup-tool revision requirement

Before product development, revise the legacy setup specification into a
versioned bootstrap that detects/validates Python 3.14.7, Node/npm, Git,
Obsidian, the external development-vault path, and worker launch contract. It must remain safe to
rerun and must not silently install software, change settings, or use a personal
vault.
