# Trading Research Lab

Trading Research Lab is a local-first quantitative trading-research environment
for Obsidian Desktop. An Obsidian plugin provides the research workspace and
React views; an isolated Python Research Core performs the authoritative import,
canonical-data, and quantitative-analysis work through versioned local JSON IPC.

## Current status

Milestones 0 (Architecture Spike) and 1 (Intake Foundation) are closed.
Milestones 0–3 are closed. Milestone 4 (Experiments and Research Documents) is
in implementation and owner validation. See the authoritative roadmap for the
complete status and the distinction between formally defined and proposed
milestones.

## Start here

- [Architecture](internal/docs/ARCHITECTURE.md)
- [Authoritative roadmap](internal/docs/ROADMAP.md)
- [Architecture Spike](internal/docs/MILESTONE_0_ARCHITECTURE_SPIKE.md)
- [Repository and release boundaries](internal/docs/REPOSITORY_LAYOUT_AND_RELEASE_BOUNDARIES.md)
- [Claude Code handoff](internal/docs/HANDOFF.md)
- [Baseline audit](internal/docs/BASELINE_AUDIT.md)

## Core principles

- Obsidian Desktop plugin, desktop-only V1.
- Python 3.14.7 is the single quantitative calculation authority.
- Local child-process JSON IPC; no required HTTP server or cloud service.
- Parquet for analytical tables, JSON for metadata, Markdown/YAML for research.
- Immutable raw evidence, deterministic canonical datasets, and reproducible
  result manifests.
- Private engineering documentation is structurally excluded from releases.

The legacy root documents and Python prototypes are retained for historical
evidence but are not current architecture authority.
