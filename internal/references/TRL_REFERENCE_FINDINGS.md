# Trading Research Lab — External Reference Findings

**Review scope:** concepts and architecture only. No external source was copied,
adapted, ported, translated, or made a dependency during this review. After this
review, the developer/owners approved direct reuse subject to mandatory
provenance tracking and a final usage report; see
[`EXTERNAL_CODE_USAGE_REGISTER.md`](EXTERNAL_CODE_USAGE_REGISTER.md).

| Source and pinned module(s) | Observed concept | Classification | TRL action and consequence | Licence / reuse note |
| --- | --- | --- | --- | --- |
| Journalit: src/views/ReactView.tsx | React mount/unmount bridge for Obsidian ItemViews. | Adapt independently | Keep TRL's small view wrapper and lifecycle tests; do not generalise prematurely. | Proprietary; no code reuse. |
| Journalit: src/views/ViewManager.ts | Centralised registration/opening of many views. | Investigate later | Add a small TRL view registry only when several stable views justify it. Avoid a monolith. | Proprietary; no code reuse. |
| Journalit: src/data/widgetRegistry.ts and grid files | Declarative widget catalogue and persisted layouts. | Adopt concept | A future M4+ dashboard may use TRL-owned widget IDs, layout schema, and migrations. No M2 widget work. | Proprietary; independent specification required. |
| Journalit: SettingsManager.ts and UIStateManager.ts | Separate durable settings, UI state, validation, backup, and migrations. | Adapt independently | Separate future policy/configuration from disposable UI layout state; canonical evidence stays independent. | Proprietary; no code reuse. |
| Journalit: Markdown/template services | Bounded generated-content ownership and migration awareness. | Adopt concept | Reinforces TRL marker/frontmatter safety; no current design change. | Proprietary; no code reuse. |
| Journalit: backend, subscription, and sync services | Network-backed sync, account mapping, entitlement, and scheduled tasks. | Avoid | Retain local subprocess IPC and no-mandatory-network architecture. Keep future entitlements above the Core. | Proprietary and incompatible with V1. |
| Strategy Factory: generator/optimizer/analyzer split | Separate generation, optimisation, analysis, and validation. | Adopt concept | Retain separate Core domains; add modules only under an approved milestone. | Licence unresolved; no code reuse. |
| Strategy Factory: optimizer.py and validation_utils.py | Walk-forward and Monte Carlo as distinct validation activities. | Adapt independently | Reserve for M6 with versioned configuration, explicit seeds, manifests, and independent tests. | Licence unresolved; quantitative validation required. |
| Strategy Factory: analyzer.py and risk_management.py | Library-backed metrics, drawdown, and prop checks. | Investigate later | Build M3+ policies from TRL's evidence model, not external definitions. | Licence unresolved; independent validation required. |
| Strategy Factory: CSV loaders/result writers | Repository-relative CSV input and output workflow. | Avoid | Preserve managed raw snapshots, Parquet/JSON, bounded worker paths, and deterministic manifests. | Licence unresolved; insufficient provenance. |
| Strategy Factory: random Monte Carlo paths | Resampling without apparent explicit seed contract. | Avoid | TRL must not implement unseeded simulation. | No reuse. |
| Strategy Factory: `validation_utils.py` MonteCarloSimulator | Replacement resampling of portfolio percentage returns, compounded from supplied initial capital, with confidence/profit-probability summaries. | Partially adapt concept | Retain only explicit run count and worst/tail summary concepts. M6 uses independently specified seeded order permutation of verified monetary close-event P/L, with no probability, return-compounding, or capital/equity claim. | Licence unresolved; no code reuse. |

## Potential code reuse candidates

**None currently selected.** The reviewed work did not justify direct reuse at
the time, and no external code has been incorporated into TRL. Direct reuse is
now permitted where it materially improves quality, reliability, development
efficiency, or implementation risk, but must be recorded immediately in
`EXTERNAL_CODE_USAGE_REGISTER.md`. Independent implementation remains preferred
when it is the clearer and safer choice.

## Impact on Trading Research Lab

- **Milestone 0:** no change. It remains closed; this review found no reason to revise its acceptance criteria or implementation sequence.
- **Current M2:** no scope change. Its evidence-first, quality-separated policy remains the authority.
- **Plugin/dashboard:** no immediate widget/dashboard work. A future widget registry can be independently designed after research artifacts stabilise.
- **Research Core:** no boundary change. UI shell concerns stay out of Python; separate analysis domains do not imply external object/data coupling.
- **Storage and IPC:** no change. Parquet + JSON plus local NDJSON remains stronger for TRL provenance.
- **Testing:** no immediate tooling change. Future M6 simulation must record random seeds; all metric/risk work requires independent fixtures and documented definitions.
- **Entitlements:** no change. Network-backed entitlement/sync designs remain outside the local-first Research Core.

## Standing validation rule

Any quantitative concept suggested by Strategy Factory must pass TRL metric specification, deterministic fixtures, regression tests, provenance checks, and reproducibility requirements. Any Obsidian concept suggested by Journalit must be independently evaluated against desktop-only V1, React + TypeScript + esbuild, local subprocess IPC, release packaging, maintainability, and testability.

## 2026-09-22 M6 paired-forward comparison

The current accepted capability is a strict, source-preserving comparison of
two precomputed MT5 optimisation grids. Rows are paired only by their complete
ordered input signature; displayed metrics remain MT5 source facts. This
review checked that design against the two pinned repositories.

| Reference | Relevant observed pattern | TRL decision |
| --- | --- | --- |
| Strategy Factory `optimizer.py` and `validation_utils.py` | Rolling train/test windows, optimiser-selected parameters, direct strategy execution, and aggregate validation summaries. | Retain only the conceptual distinction between training and forward evidence. Do **not** adopt rolling re-optimisation, `best_params` selection, thresholding, library-derived portfolio metrics, or aggregate consistency claims: those require inputs and a policy the MT5 XML evidence does not provide. |
| Journalit `src/components/csv/TradeImportPreviewReview.tsx` | A visible, bounded preview before a user confirms an import. | Reinforces TRL's independently implemented scrollable, source-labelled evidence table and explicit user action. Do **not** adopt Journalit's import commit, categorisation, or broader application state. |

**Outcome:** the accepted M6 paired viewer remains appropriate as an
inspection-only capability. It must not rank, select, recommend, or generate a
parameter set. No external code was copied, adapted, or used; therefore no
entry was added to `EXTERNAL_CODE_USAGE_REGISTER.md`.

## 2026-09-22 MVP dashboard presentation review

Journalit's dashboard, template-preview, and template-editor canvas patterns
were reviewed at pinned commit `098d27747df1b3a5fb177ff3a147d9a5cfbe0dcb`.
TRL retained only three independently implemented presentation principles:

- a central workspace canvas instead of a persistent utility sidebar;
- a concise workspace header followed by a fixed summary-card hierarchy; and
- detailed controls below the summary rather than competing with it.

TRL deliberately does not adopt Journalit's configurable widget grid,
drag/drop, persisted layouts, template editor, Canvas implementation, data
contexts, or state/migration system in the MVP. They solve a larger product
problem and would add dependencies and configuration complexity before the
fixed dashboard has been validated. No code or styling was copied or adapted;
the external-code usage register remains unchanged.
