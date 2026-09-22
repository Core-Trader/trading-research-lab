# Development Vault Separation — 2026-09-20

## Change

The authoritative disposable Obsidian development vault is now external to the
repository at `C:\DEV\vaults\TRL-Dev-Vault\`.

## Reason

The locked architecture requires a strict separation between source repository,
development vault, and personal research vault. A previously created nested
`dev-vault/` remains untouched and ignored as historical local staging; it is
not a source-controlled or authoritative development vault.

## Safety

No existing file was moved or deleted. No Obsidian plugin junction was created.
The new vault contains only the requested empty root folders and `.obsidian`
plugin parent directory.

## Manual review required

Open `C:\DEV\vaults\TRL-Dev-Vault\` in Obsidian only after Obsidian Desktop is
installed. Do not select a personal research vault during plugin testing.
