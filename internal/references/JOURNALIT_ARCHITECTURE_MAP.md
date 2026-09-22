# Journalit Architecture Map

**Pinned review record.** This map describes commit
`098d27747df1b3a5fb177ff3a147d9a5cfbe0dcb`. No source was copied during this
review. Direct reuse is now approved by the developer/owner subject to mandatory
provenance tracking and final usage reporting; see
`EXTERNAL_CODE_USAGE_REGISTER.md`.

## Repository and plugin shape

- TypeScript Obsidian plugin with manifest.json, main.js, styles.css, esbuild configuration, pnpm workspace/lockfile, and a large src tree.
- src/main.ts is the entry. src/core/PluginInitializer.ts coordinates staged startup, service registration, migrations, and cleanup.
- The manifest identifies a trading journal, requires Obsidian 1.12.4 or newer, and is not desktop-only. TRL V1 remains desktop-only.
- Build metadata shows TypeScript, esbuild, generated styles, ESLint, Stylelint, React, react-grid-layout, react-window, charting, and drag/drop dependencies.

## Obsidian shell and views

- src/views/ReactView.tsx is a React-to-Obsidian ItemView bridge with mount, error, and unmount lifecycle handling.
- src/views/ViewManager.ts centrally registers named views: home, trading dashboard, trade log, CSV import, account pages, template builder, navigation, onboarding, economic calendar, setup, and session mode.
- src/commands/commandRegistry.ts and src/ui/ribbonManager.ts provide command and ribbon integration.
- Central registration is useful as a concept, but the large ViewManager is a coupling risk to avoid in TRL.

## Dashboard, widgets, and layout

- Home/dashboard composition is React-based. Relevant areas are src/components/home, src/components/dashboard, and src/data/widgetRegistry.ts.
- A registry/selector approach drives individual widgets. A small declarative TRL-owned widget catalogue is a useful future concept; no dashboard work belongs in M2.
- Drag/resize layouts use the grid-layout stack and are persisted with named dashboard/home layouts in settings.
- Virtualised account lists, skeleton components, debouncing, and resize observation show rendering-scale attention. These are techniques to evaluate only when TRL profiling justifies them.

## State, settings, and migrations

- SettingsManager uses Obsidian plugin storage, normalises and validates loaded settings, merges defaults, maintains backup/recovery paths, and persists named layouts.
- UIStateManager stores view state separately in ui-state.json. React contexts/hooks distribute view state and services.
- PluginInitializer contains explicit migration/version markers and cleanup for derived folders and cached state.
- TRL lesson: version future UI layout/configuration separately from canonical research data. Do not let UI state alter Parquet/JSON evidence.

## Vault, notes, templates, imports, and sync

- Dedicated Markdown codecs, template services, review transformations, and trade-note migrations illustrate bounded generated-content ownership. This reinforces TRL's marker/frontmatter safety model.
- Local CSV template/import services exist. Other import/sync flows include backend projection, account mapping, retries, acknowledgements, and scheduled broker work.
- The README describes MT4/MT5 support as paid/backend-backed sync/import. It is not a model for TRL's local Python subprocess and source-preserving MT5 workflow.

## Entitlements, errors, and performance

- Backend/authentication, subscription-tier, token, and Pro-entitlement modules are explicitly present. They remain outside TRL's local-first Research Core.
- Entry, initializer, view, and settings paths use scoped error handling, logging, and notices. Clear recovery feedback is a useful concept only.
- Periodic sync and update checks are incompatible with TRL's no-mandatory-network/no-telemetry baseline.

## Robust concepts

1. A small React ItemView lifecycle adapter.
2. Central but modular view registration as stable views grow.
3. Separate durable configuration from disposable UI state.
4. Explicit migration versioning and conflict-aware generated-content handling.
5. Skeleton, virtualisation, and debounce techniques only when measured need arises.

## Fragile or overly coupled areas

- The breadth of views, services, styles, sync providers, templates, and backend/entitlement modules creates a large integration surface.
- Very large view/settings coordinators make changes difficult to isolate and test.
- Backend and scheduled broker-sync paths combine credentials, mapping, retries, projections, and UI state; this is deliberately out of TRL V1.
- Its observed proprietary licence remains relevant release context; the
  developer/owner subsequently granted direct reuse permission conditional on a
  complete final usage report. Every direct or substantial derivation must be
  logged and independently validated.

## Licence conclusion

The pinned LICENSE is proprietary source-available and expressly prohibits
copying, modification, redistribution, and derivative works without written
permission. The developer/owner subsequently granted direct reuse permission
subject to a complete final usage report. This does not replace formal licence
terms; it requires immediate provenance recording in
`EXTERNAL_CODE_USAGE_REGISTER.md` and deliberate release-notice review.
