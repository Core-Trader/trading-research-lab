# Local MT5 Report Picker

**Date:** 2026-09-20  
**Scope:** Milestone 0 development-vault usability only.

## Change

The MT5 Excel report field now has a **Browse…** button. It opens the desktop
file picker, accepts `.xlsx` reports, resolves the selected local path, and
places that path in the existing input. Pasting a path remains supported.

## Boundary

The selected path is used only by the existing local Python subprocess. The
plugin does not upload the file, enumerate the disk, or add a cloud dependency.

## Compatibility approach

The implementation first supports Electron's current selected-file path API and
then the legacy Electron file-path property used by older desktop runtimes. If
the Obsidian runtime exposes neither mechanism, analysis does not run; the user
gets a clear message and may still paste the full local path.

## Manual review required

After rebuilding and reloading the plugin, use **Browse…** to select one
approved MT5 `.xlsx` report from a location outside the vault. Confirm the path
appears in the field, run the analysis, and confirm the existing results match
the source. Also press **Cancel** in the file picker and confirm the prior path
remains unchanged.
