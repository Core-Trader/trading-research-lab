# Product Specification

**Version:** 0.1 — specification phase

## Product objective

Provide an auditable local workspace where a trader can import historical strategy backtests, inspect data quality, combine strategies in a shared-account replay, and understand how timing, floating equity, costs, and configurable risk rules affected historical outcomes.

## Primary user

A technically engaged discretionary or systematic trader who owns the backtest exports and needs a repeatable research workflow rather than a live-trading terminal.

## MVP user journey

1. Create a workspace and account scenario.
2. Import an MT5 export and see parsing/validation findings.
3. Review normalized trades and unresolved fields.
4. Select one or more backtests for a replay scenario.
5. Run a deterministic replay using a saved configuration.
6. Review equity, balance, drawdown, daily drawdown, exposures, and event-level explanations.
7. Export a reproducibility bundle containing identifiers, configuration, results, and warnings.

## Functional requirements

### Import and provenance

- Accept a versioned, explicitly supported MT5 input adapter; unsupported layouts fail clearly rather than being guessed.
- Store raw files immutably outside the database or in a content-addressed store; record SHA-256, filename, bytes, imported timestamp, and parser version.
- Present import warnings and block replay when required fields are unavailable.

### Portfolio replay

- Support multiple strategies/backtests in one scenario and a single account currency/configuration.
- Apply a documented deterministic ordering to same-timestamp events.
- Calculate balance, equity, realised P/L, costs, and drawdown at every account checkpoint.
- Mark inputs or modelling assumptions that make a result approximate (for example, absent mark prices for an open position).

### Risk analytics

- Report absolute and percentage maximum drawdown, drawdown duration, recovery time where determinable, and recovery factor.
- Report broker-native balance/equity risk without requiring a prop-firm policy.
- Apply daily P/L, daily drawdown, and prop-firm compliance only when the scenario attaches a versioned policy and a valid broker-time profile.
- Let the user choose the policy’s timezone, reset time, baseline (balance/equity), and realised/floating treatment; show these choices beside results.
- Do not present prop-firm compliance as authoritative until a named, versioned rule set and data adequacy assessment exist.

### Browser experience

- Local browser GUI only, with clear workspace navigation: Imports, Strategies, Backtests, Replay, Risk, and Evidence.
- Charts and summary figures link back to underlying events/positions whenever the data permits.
- Warnings must be visible, exportable, and not hidden by a successful-looking chart.

## Non-functional requirements

- Re-running the same input package with the same engine version and configuration yields byte-equivalent canonical results or a documented deterministic serialization equivalent.
- Financial values preserve source precision and use decimal-safe arithmetic; display rounding is never calculation rounding.
- Runs must be explainable without network access.
- Results and raw data remain local by default.

## Acceptance criteria for milestone 1

- One representative supported MT5 export imports without unreviewed parsing ambiguity.
- Its normalised completed trades reconcile against stated source totals within an explicitly documented tolerance, or discrepancies are classified.
- A two-strategy replay produces a run record, event ledger, balance/equity series, max drawdown, and daily-drawdown result.
- Opening any reported worst-risk point identifies the governing policy and contributing event/position data.

## Deferred decisions

Exact supported MT5 export formats, account-currency conversion method, mark-price reconstruction policy, margin model, and initial prop-firm rule set require representative source files and an explicit owner decision.
