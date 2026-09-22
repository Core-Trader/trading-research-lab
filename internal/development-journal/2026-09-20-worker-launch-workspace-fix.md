# Worker Launch Workspace Fix — 2026-09-20

## Symptom

The Obsidian research view showed a correct Python executable path but reported
`ENOENT` when it attempted its first local worker launch.

## Cause

The plugin supplied `.trl-data` as the Python child process working directory
before that directory existed. On Windows, Node reports this launch failure as
`spawn <python-path> ENOENT`, even when the executable itself exists.

## Correction

The plugin now creates only its own local derived-data workspace with
`mkdirSync(workspaceRoot, { recursive: true })` immediately before spawning the
worker. No source report, personal vault, server, or remote service is involved.

## Verification

The TypeScript type-check and esbuild production bundle completed successfully
after the correction. Obsidian reload and first worker handshake remain a manual
acceptance check.

## Privacy follow-up

Because Obsidian writes plugin settings through the development-vault junction,
`plugin/data.json` is now ignored as local machine configuration.
