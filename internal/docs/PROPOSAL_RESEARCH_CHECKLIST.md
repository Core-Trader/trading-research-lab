# Proposal: a research checklist in Experiment notes

**Status:** DRAFT 2026-09-25. Awaiting the owner (K1–K6).

This is workflow gap 1 of the 3 that remain. It depends on NOTES-2 (one
record block per kind of check, fixed 2026-09-25).

## Why

The Research workflow (Help, steps 0–10) is a guide, but nothing records
where an EA stands in it. The evidence is spread across Experiment notes
(recorded checks) and the owner's memory. The owner asked for "a checklist in
Research notes that tracks steps 0–10".

## What TRL would add

1. **A checklist inside the Experiment note (K1):**
   - "Add research checklist" writes the eleven workflow steps once, as an
     Obsidian task list inside a marked block (`TRL:RECORD kind=checklist`)
   - you tick steps in Obsidian itself:
     - `[x]` done
     - `[-]` not applicable
     - `[ ]` open
   - Obsidian shows any character in the brackets as complete (Obsidian
     Help: task lists)
   - TRL **never rewrites it on its own**; "Reset checklist" replaces it only
     after you confirm
2. **Evidence from recorded checks (K2):**
   - TRL reads which checks are recorded in the same note (NOTES-2 blocks)
     and shows them against the steps they support
   - evidence is shown next to a step but **never ticks it for you**: a
     recorded check is evidence, not a decision
   - the map of steps to recorded checks:

   | Step | Recorded checks that count as evidence |
   | --- | --- |
   | 2 Broad scan | Symbol shortlist |
   | 3 Check the shortlist realistically | Significance, Costs, Combined equity |
   | 4 Same settings over time | Windows |
   | 5 Optimise with an internal forward period | Chosen parameter set |
   | 7 Stress costs and trade order | Execution costs, Monte Carlo, Costs |
   | 0, 1, 6, 8, 9, 10 | none yet (ticked by you) |

3. **Where you see progress (K3):**
   - **Research notes browser:** each Experiment shows "done / applicable"
     (for example 5 of 10, with one step marked not applicable) and a small
     progress bar.
   - **Checklist panel:** selecting an Experiment shows the steps with their
     state, the evidence badges, and an "Open step in Help" link to the
     Research workflow step.
   - **Sidebar card:** the most recent Experiment's progress.
4. **Mismatches shown, not fixed (K4):** TRL flags these, and changes
   nothing:
   - a step ticked without evidence where evidence is possible (for example,
     step 4 ticked but no Windows check recorded)
   - evidence recorded for a step that is still open
5. **Existing notes (K5):** the checklist is added only when you press the
   button. Notes without one show "no checklist" and are not counted.
6. **Steps follow the Help guide (K6):** the step titles come from the
   same source as the Research workflow guide. If the guide gains a step
   later, "Add missing steps" appends it to the block after you confirm;
   your ticks are kept.

## Not included

- Ticking steps from inside TRL. Ticks are written by you in the note, so
  TRL never edits your text outside marked blocks, and inside the block only
  when you ask it to.
- Checklists for Strategy notes (one Experiment per research question).

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| K1 | The checklist is an Obsidian task list in a marked block, written once on request; you tick `[x]` or `[-]` in Obsidian | **Yes** |
| K2 | Recorded checks show as evidence next to steps (the map above) but never tick them | **Yes** |
| K3 | Progress in the notes browser, a checklist panel on Research notes, and the sidebar card | **Yes** |
| K4 | Mismatches (ticked without evidence; evidence but open) are flagged, not changed | **Yes** |
| K5 | Added only on request; notes without a checklist are not counted | **Yes** |
| K6 | Step titles come from the Help guide's content; missing steps are appended only after you confirm, keeping your ticks | **Yes** |

## Build order

1. Plugin model `research-checklist.ts` (pure, tested):
   - render the block
   - parse the ticks (`[ ]`, `[x]`, `[-]`, others treated as complete, as
     Obsidian does)
   - read the step ids from a hidden `<!-- trl-step:N -->` marker per line
   - map evidence from `recordedKinds`
   - compute progress and mismatches
2. The notes index reads each Experiment note's checklist and records.
   Obsidian's cached read is used, and TRL notes only (N6).
3. UI: "Add research checklist" (on the Research notes page and the
   Record-to area), the browser progress, the checklist panel, and the
   sidebar.
4. Update the Help guide and the product docs; close the gap.
