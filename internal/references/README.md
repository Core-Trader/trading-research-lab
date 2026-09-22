# External Reference Repositories

This directory records external repositories that may be consulted as private
design and research references. Everything under `internal/references/` is
private development material. It is never part of a Free, Pro, public, or other
product release and must never be included in a product artefact.

## Standing external-reference code policy

> Journalit and Strategy Factory may be inspected as references and their code
> may be reused, adapted, translated, ported, or incorporated where technically
> justified. Their developer/owners have granted direct reuse permission on the
> condition that a complete final usage report identifies components actually
> used. Every direct or substantial derivation must be recorded when introduced.
> **No untracked external code reuse.**

This rule applies even if a repository is public, has a visible licence file, or
has been cloned locally. A visible licence is not automatically a suitable
commercial-distribution permission for Trading Research Lab.

## Permitted levels of use

| Level | Permitted treatment | Examples |
| --- | --- | --- |
| **Concept** | Safe to use as independent inspiration. | Draggable research widgets, dashboard layouts, modular research pipelines. |
| **Pattern / architecture** | May be studied and independently reimplemented from a Trading Research Lab specification. | Plugin view organisation, widget registration, Python module separation, settings architecture, error-handling patterns. |
| **Actual implementation code** | Permitted only for Journalit and Strategy Factory with immediate provenance tracking and independent validation. | Source, tests, comments, assets, translations, ports, adapted code, copied algorithms, or bundled artefacts. |

If the boundary is unclear, default to no reuse and flag it for owner review.

## Operating safeguards

- Keep clones outside this repository at `C:\DEV\TRL_External_References\`.
- Do not reuse external source or assets unless it is technically justified and
  an entry is added in `EXTERNAL_CODE_USAGE_REGISTER.md` in the same change where
  practical.
- Record a reviewed commit/hash only after a local clone is deliberately made.
- Record the exact external commit, source, symbol, destination, extent, changes,
  validation, dependencies, and product scope for every actual reuse.
- Do not add a reference repository to `THIRD_PARTY_LICENSES.md` merely because
  it is reviewed; release-facing notices and attribution are added deliberately
  when actual reuse and distribution requirements are known.

See `REFERENCE_REGISTER.md` for the current reference list,
`EXTERNAL_CODE_USAGE_REGISTER.md` for actual reuse, and
`EXTERNAL_CODE_USAGE_FINAL_REPORT.md` for the future reporting template.
