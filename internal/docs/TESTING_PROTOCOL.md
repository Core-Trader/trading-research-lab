# Testing Protocol

## Test layers

| Layer | Owner | Purpose |
| --- | --- | --- |
| Python unit | Research Core | Decimal/economic rules, schema validation, canonical transformations |
| Python deterministic integration | Research Core | Source fixture through canonical data, analysis, and manifests |
| Plugin unit | TypeScript | Application services, protocol client, entitlement provider, vault boundary logic |
| Plugin integration | TypeScript/Obsidian dev vault | Worker lifecycle, commands, views, generated-note safety |
| End-to-end golden fixture | Both | MT5 source → expected canonical/result artifacts → rendered/linked note |

## Deterministic fixture contract

Every golden case records raw source hash, importer version, canonical schema,
core version, configuration, source-time policy, random seed where applicable,
expected quality state, and expected result hashes/tolerances. Tests locate the
earliest divergent layer: raw intake, canonical output, calculation, protocol,
or presentation binding.

## Mandatory invariants

- Raw source hash never changes during import or analysis.
- Same canonical dataset + same configuration + same core version yields the
  same result manifest and deterministic data checksum.
- Financial source values use Decimal-safe representation and retain source
  precision metadata.
- Unknown time/mark/currency data blocks or labels the affected metric; it is
  never silently filled.
- Generated Markdown updates only between registered markers and preserves text
  outside them byte-for-byte where practical.
- Plugin views render worker output and do not contain financial formula tests.

## Fixture governance

Synthetic fixtures are preferred for public/unit tests. Proprietary reports stay
local and ignored; if a redacted derivative is required, record transformation,
hash, legal status, and limitations. A fixture is changed only with an explicit
reason and expected-result review.

## Tooling direction

Use pytest for the reset Research Core. Evaluate Vitest (or an equivalent) in
Milestone 0 for plugin logic. Exact dependency versions and compatibility with
Python 3.14.7/Obsidian are spike evidence, not assumptions.
