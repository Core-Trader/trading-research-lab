# Development Environment Setup — 2026-09-20

## Scope

Prepared the existing Trading Research Lab development scaffold so Obsidian can
load it from the dedicated disposable vault. No quantitative or product feature
was implemented in this setup step.

## Verified prerequisites

- Node.js `v24.21.0` from `C:\Program Files\nodejs\node.exe`.
- npm `11.19.0`.
- Python `3.14.7` through `py -3.14`.
- Git `2.55.0.windows.3`.

## Installed local dependencies

- `research-core\.venv` created with Python 3.14.7.
- Python: `openpyxl 3.1.5`, `pyarrow 25.0.1`, and editable
  `trading-research-core 0.0.1`.
- Plugin: package-lock version 3 created; the resolved direct package inventory
  and checksum are recorded in `THIRD_PARTY_LICENSES.md`.

## Build and linkage

- Plugin TypeScript compile and esbuild bundle passed.
- Required output exists: `plugin\manifest.json`, `plugin\main.js`, and
  `plugin\styles.css`.
- Created and then repeat-validated the Windows junction:

  ```text
  C:\DEV\vaults\TRL-Dev-Vault\.obsidian\plugins\trading-research-lab
    -> C:\DEV\Trading_Research_Lab\plugin
  ```

## Setup-script improvements

- Validates the system Node 24 runtime and keeps npm child processes on that
  runtime for the script invocation.
- Requires Python 3.14.7 exactly; it does not substitute another version.
- Uses a pip dry run before installation, performs import verification, and
  uses `npm ci` whenever the package lock exists.
- Refuses to replace invalid virtual environments or conflicting/broken plugin
  junctions.

## Manual review required

Open only `C:\DEV\vaults\TRL-Dev-Vault` in Obsidian, enable Community Plugins,
and enable **Trading Research Lab**. The npm install reported a non-blocking
notice about esbuild's post-install script approval policy; the build completed
successfully, but retain that notice for dependency-policy review.
