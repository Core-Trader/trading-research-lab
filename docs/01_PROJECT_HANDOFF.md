# Project Handoff

**Status:** Approved Step 1 context package  
**Version:** 0.1  
**Date:** 2026-09-20

## Purpose

Trading Research Lab is a local-first research application for analysing historical MT4/MT5 strategy results. Its first proof point is to take a small set of existing MT5 backtests, normalise their trade/event data, replay them chronologically against a single simulated account, and explain the resulting equity, drawdown, and daily-loss outcomes.

The product must distinguish imported historical facts from calculations performed under user-selected assumptions. A promising backtest is not, by itself, proof that a strategy is robust or suitable for trading.

## Roles

| Role | Accountability |
| --- | --- |
| Product owner | Objectives, source data, acceptance decisions, risk-rule choices |
| Product/quant consultant | Specifications, financial semantics, architecture review, validation criteria |
| Implementation agent | Repository changes, tests, tooling, documentation updates, implementation evidence |

## First milestone

Import 2–5 representative MT5 exports; preserve their raw files; normalise supported trade data; replay all events in timestamp order under one account configuration; show the equity curve, drawdown curve, worst daily loss, and the events/positions responsible. Reconcile a single-strategy baseline before trusting multi-strategy results.

## Approved baseline decisions

- Local single-user application first; no SaaS, brokerage execution, billing, or multi-user collaboration in V1.
- React/TypeScript browser GUI over a Python backend.
- SQLite is the V1 system of record; analytics may use temporary in-memory tables but persisted results remain traceable.
- MT5 is the initial importer target. Input formats are adapter-specific and are not assumed interchangeable.
- The engine is event-sourced: immutable normalised events feed deterministic projections and replay runs.
- UTC is the canonical stored instant. Display timezone and daily-risk timezone are explicit configuration.
- Cloud folders are supported only when fully available offline. A non-synchronised local working folder is preferred; Git, not cloud sync, is the source of truth.

## Out of scope now

- Live trading or order routing
- Predictive performance claims
- Automatic strategy generation
- General optimisation, Monte Carlo, walk-forward analysis, and prop-firm templates beyond their architectural preparation
- Copying code from external reference projects

## Documentation map

| Document | Authority |
| --- | --- |
| `02_PRODUCT_SPEC.md` | Product scope and acceptance criteria |
| `03_ARCHITECTURE.md` | Component boundaries and delivery constraints |
| `04_DATA_MODEL.md` | Canonical persisted concepts |
| `05_REPLAY_ENGINE_SPEC.md` | Replay semantics |
| `06_VALIDATION_AND_DETERMINISM.md` | Reconciliation and reproducibility contract |
| `07_TEST_STRATEGY.md` | Required verification layers |
| `08_RESEARCH_METHODOLOGY.md` | How claims and experiments are framed |
| `09_DEVELOPMENT_PLAYBOOK.md` | Repeatable delivery process |

## Definition of done for Step 1

This package is complete when the documents are mutually consistent, record known unknowns instead of concealing them, and give an implementation agent an unambiguous first milestone. Step 2 begins only after the owner selects representative MT5 export files and confirms the initial account and daily-drawdown conventions.
