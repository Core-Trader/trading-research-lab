# Canonical Data Model

## Identity and versioning

Canonical identities that affect reproducible artefacts use deterministic UUIDv5
values derived by the Research Core from domain-separated source facts. Human
documents or operational receipts may use UUIDv7 where sortable uniqueness is
useful, but they must not make a canonical result non-deterministic. Display
names and filenames are editable metadata, never identifiers.

Required stable IDs include `source_import_id`, `dataset_id`, `strategy_id`,
`experiment_id`, `portfolio_id`, and `analysis_run_id`.

Every canonical table and manifest has an explicit schema version. A schema
change is additive, migration-defined, or a new dataset version; it is never
silently reinterpreted.

## Canonical trade representation

The canonical model is independent of MT5 field labels. A canonical trade is
created only when source evidence supports its lifecycle; otherwise the data
remains canonical events with an explicit quality state.

| Category | Fields |
| --- | --- |
| Required identity/provenance | `trade_id`, `dataset_id`, `source_import_id`, `source_trade_id`, `source_quality` |
| Required economics | `symbol`, `direction`, `volume`, `gross_pnl`, `commission`, `swap`, `other_fees`, `net_pnl`, `currency` |
| Required lifecycle where supported | `open_time`, `close_time`, `open_price`, `close_price`, source-time profile reference |
| Optional source fields | SL, TP, MAE, MFE, Magic number, comment policy/reference, order/deal/position identifiers |
| Derived only | holding time, R-multiple, expectancy classifications, drawdown contributions, correlations |
| Metadata | importer version, canonical schema, calculation configuration, source precision, warnings |

`net_pnl` is derived from source-signed components only under a documented
source convention. No hard-coded FX digits or binary floating point is the
financial source of truth.

## Event and quality model

Canonical events retain source order, original timestamp text, time-profile
reference, price scale, source identifiers, and signed economics. They may be
classified as `OPENING_BALANCE`, `POSITION_OPEN`, `POSITION_CLOSE`, or another
documented adapter-supported type.

Trade/position quality is one of `MT5_VERIFIED`, `INFERRED`, `UNPAIRED`, or
`AMBIGUOUS`. A regular MT5 Excel report may produce inferred groups only under
a versioned policy; it must never be relabelled as verified.

## Storage mapping

- High-volume canonical events/trades/series: Parquet with a companion JSON
  schema and manifest.
- Dataset, import, analysis, and configuration metadata: JSON.
- Human experiment/strategy/report context: Markdown plus YAML frontmatter.
- Caches and chart-ready series: disposable derived Parquet/JSON artifacts.

## Time and policy model

Source timestamps are not UTC merely because they parse. A versioned broker time
profile establishes conversion semantics. Risk policies are versioned overlays
with timezone, reset, basis, realised/floating treatment, thresholds, and
evidence. Broker-native results remain valid with no policy attached.
