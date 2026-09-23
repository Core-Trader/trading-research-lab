# MVP-D release readiness

**Status:** allowlist tooling and product help are implemented (2026-09-23).
Owner decisions R-D1 to R-D4 below are pending. No release has been published
or distributed.

## Implemented

- `scripts/build_release.py` assembles the release from an explicit allowlist:
  - `trading-research-lab/`: plugin `manifest.json`, `main.js`, and
    `styles.css`
  - `research-core/`: `pyproject.toml` and the
    `src/trading_research_core/**/*.py` files
  - `docs/`: `product-docs/*.md`
  - `LICENSE`
- Output goes to `dist/release/trading-research-lab-<version>/` (git-ignored)
  with a `RELEASE_MANIFEST.json` that lists each file's bytes and SHA-256.
- The release check blocks the release, writing nothing, when it finds:
  - a missing required file
  - a forbidden path part (`internal`, `tests`, `data`, `raw`, journals,
    handoffs, vaults, `__pycache__`, `.venv`, `node_modules`, `.obsidian`,
    `reference`)
  - a forbidden file type (`.xlsx`, `.xml`, `.set`, `.parquet`, `.csv`,
    `.env`, `.db`, `.pyc`, `.map`, `.log`, `data.json`, `.trl-*`)
  - forbidden content: private-document references (`internal/`, handoff,
    journal, or decision-log names), local absolute paths, real e-mail
    addresses, or source maps
- Tests: `scripts/tests/test_build_release.py` (4 tests; run with
  `-o addopts=""` from the repository root).
- The only private reference in shipped code (a `portfolio_lab.py` docstring)
  was removed.
- **Smoke check (2026-09-23):**
  - the real repository assembles to 33 files, READY, with no findings
  - the worker runs from the release folder only (`PYTHONPATH` set to the
    release's `research-core/src`) and answered `core.capabilities`, a real
    `dataset.intake_mt5_excel`, and `portfolio.list_saved_combinations` over
    the versioned IPC
- Product help:
  - `product-docs/INSTALL.md`: engine environment, plugin install, and where
    the data goes (`<vault>/.trl-data`)
  - `product-docs/MT5_EXPORT_GUIDE.md`: which MT5 files TRL reads, the
    default single test, and the recommended built-in forward period
- Portability fix: the worker workspace path now uses `/` instead of a
  hard-coded `\`, which would have created a literal `vault\.trl-data` file
  name on macOS and Linux.

## Owner decisions pending

| ID | Question | Recommendation |
| --- | --- | --- |
| R-D1 | Product licence. `LICENSE` currently reads "all rights reserved, no licence selected". | Keep all-rights-reserved for a private MVP build; choose a licence before any public distribution. |
| R-D2 | How users get Python. The options are that the user installs Python 3.14 and runs `pip install ./research-core` (network access only at setup), or a bundled interpreter and wheels (offline, larger, more licence notices). | User-installed Python for the MVP; revisit bundling after owner use. |
| R-D3 | Third-party notices in the release. The current `THIRD_PARTY_LICENSES.md` is an internal review record and is not shipped. | Generate a release `THIRD_PARTY_NOTICES.md` from the lockfiles (React, React DOM, scheduler: MIT; openpyxl and et_xmlfile: MIT; pyarrow: Apache-2.0, plus its bundled components) after R-D2, because bundling changes the list. |
| R-D4 | Distribution channel. | Private zip for the owner only; the Obsidian community store is out of scope for V1. |

## Not yet done

- A clean-machine install check that follows `INSTALL.md` literally, on a
  machine or user account without the dev environment. This needs the owner or
  a clean VM.
- A macOS or Linux run, which is not verified.
- Release versioning policy: the version is currently `0.0.1` in
  `manifest.json`, `package.json`, and `pyproject.toml`.
