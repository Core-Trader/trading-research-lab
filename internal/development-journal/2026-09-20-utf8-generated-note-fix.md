# UTF-8 Generated-Note Fix — 2026-09-20

## Evidence

The first successful EURUSD M0 run produced the correct source-preserving data,
balance metrics, chart, and generated note. Review identified a duplicate
analysis-run line and one replacement character in the generated Markdown
heading.

## Cause

On Windows, the Python worker inherited a local console output encoding while
the Node subprocess client decoded stdout as UTF-8. The protocol requires UTF-8
NDJSON, so the worker boundary—not the Markdown reader—needed correction.

## Correction

- Removed duplicate dataset/source fields and the duplicate Markdown analysis-run
  line.
- Configured worker stdout as strict UTF-8 and stderr as UTF-8 with safe
  backslash replacement.

## Verification

A subprocess IPC test queried the existing EURUSD canonical dataset and verified
that the emitted NDJSON decodes as UTF-8, includes the expected em dash, and
contains no replacement characters.

## Manual review required

Restart or reload the Obsidian plugin, rerun the same EURUSD report, and inspect
the generated block. The plugin must preserve the note's frontmatter and all
text outside `TRL:GENERATED` markers.
