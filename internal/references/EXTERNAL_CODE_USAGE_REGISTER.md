# External Code Usage Register

**Status:** authoritative private running register for direct or substantial
external code derivation. This document is development-only and must never be
bundled in Free, Pro, public, or other product artifacts.

## Operating rule

Journalit and Strategy Factory code may be reused, adapted, translated, ported,
or incorporated only where technically justified and with mandatory provenance
tracking. **No untracked external code reuse.**

Create an entry when code is copied, adapted, translated/ported, substantially
or structurally derived, algorithmically derived from an identifiable
implementation, or partially reused. Ordinary conceptual inspiration does not
need an entry. If uncertain, record it.

For each direct reuse, add a concise nearby source comment when technically
appropriate, for example:

```text
External implementation reference: Journalit
commit: <commit>
source: <path>
usage-id: EXT-001
```

The detailed record belongs here. Quantitative correctness remains independent
of permission and requires TRL specification compliance, deterministic fixtures,
and regression validation.

## Current entries

**None.** As of 2026-09-21, no Journalit or Strategy Factory code, assets, or
substantially derived implementation has been incorporated into Trading Research
Lab. Previous architecture and Monte Carlo reviews were concept/pattern study
and independently implemented work only.

## Entry template

### EXT-XXX — Short descriptive title

| Field | Record |
| --- | --- |
| Date introduced | `YYYY-MM-DD` |
| External repository | Journalit / Strategy Factory |
| External repository URL | `https://...` |
| Exact external commit | `<40-character commit>` |
| External source path | `<path>` |
| External symbol/component | `<class/function/module/component>` |
| Source purpose | `<what original code does and why relevant>` |
| TRL destination | `<TRL path and symbol>` |
| Reuse type | copied with minor modifications / adapted / translated/ported / structurally derived / algorithmically derived / partially reused |
| Extent | whole function / partial function / class structure / algorithm / UI component / styling pattern / data structure / helper / configuration / other; include approximate original/resulting lines where practical |
| Changes made | `<refactoring, renamed variables, integration, bugs fixed, platform adaptation, performance, removed functionality>` |
| Reason for reuse | `<quality, reliability, efficiency, compatibility, risk reduction>` |
| Dependencies / licence considerations | `<packages, assets, APIs, formal terms or none>` |
| Product scope | Free / Pro / both / internal tooling only / undecided |
| Validation | `<tests, fixtures, build, manual review, quantitative regression evidence>` |
| Source-level provenance comment | `<path/line or not applicable with reason>` |

## Final reporting

At development completion, prepare separate repository-specific reports from
these entries using [`EXTERNAL_CODE_USAGE_FINAL_REPORT.md`](EXTERNAL_CODE_USAGE_FINAL_REPORT.md).
Do not expose one developer's information to the other unless expressly needed.
