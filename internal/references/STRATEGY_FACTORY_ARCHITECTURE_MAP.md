# Strategy Factory Architecture Map

**Pinned review record.** This map describes commit
`31e778a78b465ce1a0e16e232f762ebe8ca80b52`. No source was copied during this
review. Direct reuse is now approved by the developer/owner subject to mandatory
provenance tracking and final usage reporting; see
`EXTERNAL_CODE_USAGE_REGISTER.md`.

## Repository and entry points

- A Python research/backtesting repository organised around root scripts, strategy_factory, core, strategies, indicators, examples, deployment, data, results, and Markdown reports.
- quick_start.py and run_strategy.py are practical entry scripts. The former demonstrates generation, optimisation, walk-forward, and Monte Carlo flow; the latter provides strategy-specific command-line runs.
- strategy_factory/generator.py, optimizer.py, analyzer.py, and risk_management.py form the main conceptual framework. core/data_loader.py provides data loading.
- There is no pyproject.toml, lockfile, or root LICENSE file at the reviewed commit. The requirements files are materially narrower than the README's advertised vectorbt/QuantStats/generation stack.

## Data, strategies, and pipeline

- core/data_loader.py maps a finite set of forex symbols/timeframes to repository-relative CSV files and loads data with pandas. Root scripts also directly read CSV paths.
- Strategies are Python modules. Generation and optimisation operate directly on dataframe/portfolio objects supplied by the vectorbt-oriented workflow.
- Generation evaluates parameter combinations, filters/ranks results, and emits tables. Optimisation adds evolutionary-search and walk-forward paths.
- Analysis uses vectorbt/QuantStats-style portfolio and returns objects for metrics, reports, trade exports, rolling statistics, and drawdown periods.

## Quantitative capabilities observed

- Walk-forward validation appears in optimizer.py and validation_utils.py, producing window-level return, Sharpe, drawdown, win rate, and trade-count outputs.
- Monte Carlo appears in optimizer.py, analyzer.py, and validation_utils.py, with NumPy random resampling.
- Portfolio, allocation, risk sizing, FTMO checks, session filters, and volatility filters are represented in framework code or surrounding examples/docs.
- Metrics include return, Sharpe, Sortino, Calmar, drawdown, profit factor, expectancy, trade duration, and rolling measures. Definitions are largely delegated to third-party portfolio/statistics libraries.

## Outputs, configuration, and testing

- Results are primarily CSV, HTML, images, logs, and Markdown reports under results; examples often write directly to repository result paths.
- Configuration is mostly Python parameters, dictionaries, command-line inputs, and JSON deployment files rather than one versioned research-run schema.
- Numerous example files are named as tests/validation/debugging exercises, but there is no conventional isolated tests package or clearly declared root test runner.
- Historical outputs, backup material, live-deployment adapters, and result logs share a tree with research code. This is learning evidence but increases coupling and reproducibility risk.

## Performance and failure analysis

- The design can benefit from vectorbt portfolio operations, but its performance claims require independent TRL workload benchmarks.
- The reviewed commit message fixes an allocation-return-shape issue. Bug/failure-analysis documents and debugging examples show active learning, not proof that the logic meets TRL definitions.
- Inspected Monte Carlo paths use random sampling without an obvious explicit seed contract. TRL must record a seed and deterministic result manifest before it implements simulation.
- Fixed data paths, direct output writes, broad exception fallbacks, and metric frequency assumptions are not suitable for TRL canonical evidence.

## Robust concepts

1. Separation of generation, optimisation, analysis, validation, and risk domains.
2. Keeping experiments and failure-analysis records visible.
3. Treating walk-forward and Monte Carlo as separate validation activities.
4. Reporting aggregate metrics with supporting trade/result exports.

## Fragile or overly coupled areas

- Direct vectorbt/QuantStats portfolio-object coupling ties data, metrics, and presentation to external libraries.
- CSV input paths and direct outputs do not provide immutable raw-source, manifest, or bounded-workspace guarantees.
- Missing packaging/lockfile/licence clarity and requirements/README mismatch weaken reproducibility and commercial reuse confidence.
- Randomised validation lacks TRL's required seed/provenance contract.
- Research, live deployment, credential-oriented configuration, backups, and generated results share one tree; TRL needs stronger boundaries.

## Licence observation and reuse control

No repository LICENSE file was present at the reviewed commit. The README says
“For personal use,” while some documentation calls the project open source. The
developer/owner has since granted direct reuse permission subject to a complete
final usage report. This does not resolve or replace formal licence terms, and
every direct or substantial derivation must be recorded in
`EXTERNAL_CODE_USAGE_REGISTER.md` and independently validated.
