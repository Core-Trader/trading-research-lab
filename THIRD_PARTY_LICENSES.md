# Third-Party Licence Inventory

**Status:** Local development dependencies have passed the recorded M0 runtime
and build checks. This does not approve any dependency for Free, Pro, public, or
other distribution packaging.

Before adopting a dependency, record its name, version, source URL, licence,
commercial-distribution assessment, intended package, and owner of the review.
Milestone 0 must populate this file for every selected Python, TypeScript, build,
and charting dependency.

Do not treat a dependency as approved merely because it appears in a legacy
prototype or an external reference project.

## Milestone 0 candidate inventory

| Component | Declared range/version | Licence | Intended use | Approval state |
| --- | --- | --- | --- | --- |
| openpyxl | `>=3.1.5,<4` | MIT | MT5 `.xlsx` input adapter | Local runtime verified; release review pending |
| pyarrow | `>=25.0.1,<26` | Apache-2.0 | Canonical Parquet storage | Local runtime verified; release review pending |
| React / React DOM | `^19.1.1` | MIT | Isolated plugin view | Local build verified; release review pending |
| esbuild | `0.25.5` | MIT | Plugin bundling | Local build verified; release review pending |
| TypeScript | `^5.8.3` | Apache-2.0 | Plugin type checking | Local build verified; release review pending |
| Obsidian API package | `latest` | See upstream package/release terms | Plugin API typings | Local type-check verified; release review pending |

When a candidate passes: add the resolved version, source URL, lockfile hash,
test evidence, commercial-distribution assessment, and reviewer/date. Until
then it remains a candidate, not an approved product dependency.

## Resolved local development inventory — 2026-09-20

These versions were installed and build-validated for the local development
environment. They remain subject to the documented product/distribution licence
review; this entry does not approve them for a Free, Pro, or public release.

| Component | Resolved version | Evidence |
| --- | --- | --- |
| Python | 3.14.7 | Virtual environment created and verified. |
| openpyxl | 3.1.5 | Imported successfully from the project virtual environment. |
| pyarrow | 25.0.1 | Imported successfully from the project virtual environment; CPython 3.14 Windows wheel verified. |
| React / React DOM | 19.3.0 | Resolved in `plugin/package-lock.json`; plugin build passed. |
| TypeScript | 5.9.3 | Resolved in `plugin/package-lock.json`; type-check passed. |
| esbuild | 0.25.5 | Resolved in `plugin/package-lock.json`; plugin bundle passed. |
| Obsidian API package | 1.13.1 | Resolved in `plugin/package-lock.json`; plugin type-check passed. |
| pytest | 9.1.1 (test-only) | MIT; installed from the approved developer extra; 5 Research Core tests passed. |

- `plugin/package-lock.json` SHA-256:
  `FF8D4E7AA2BF23D38C30AF597691B2E902371FEC8DD54F8B46DF6DE39A54E0EC`
- Plugin build (`plugin/main.js`) SHA-256 at setup time:
  `D5E55F08106AA76B9AEAB3D97D0879B5E49A9F8125DE23ED66CEBE10B3F2492D`
