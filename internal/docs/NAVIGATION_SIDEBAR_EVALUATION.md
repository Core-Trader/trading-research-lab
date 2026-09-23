# Navigation: Journalit-style side menu (evaluation)

**Status:** DRAFT for owner decisions NAV-1 to NAV-4 (2026-09-23).
Concept-level use of Journalit (pinned commit `098d277`); no code reuse.

## Journalit (reviewed)

- `NavigationSidebar.tsx` is its **own Obsidian view in the left sidebar**,
  opened with `workspace.ensureSideLeaf(NAV_VIEW, 'left')` from a ribbon icon
  and a command.
- It has:
  - sections (Overview, Reviews, Tools)
  - items that open each tool as its **own view/tab** (a setting controls
    new-tab vs same-tab)
  - search
  - quick links
  - drag-to-reorder items (dnd-kit)

## TRL today

- One `ResearchView` holds all state (the current report, analysis results,
  studies) and switches 7 pages with a top tab strip.
- Pages cannot be opened side by side.

## Options

| | What | Effort | Pros | Cons |
| --- | --- | --- | --- | --- |
| A | **An Obsidian left-sidebar TRL panel** that drives the existing single view (clicking an item reveals the TRL view and switches page) | Small–medium | Native Obsidian feel like Journalit; frees the top of the page; room for **context** (current report, companion checks, worker status) and quick actions; collapses with Obsidian's sidebar toggle | Two places to look when the sidebar is closed (mitigated by a small page switcher in the view header) |
| B | A left rail **inside** the TRL view | Small | Always visible with the page | Takes width from charts and tables; poor in narrow panes; not how Obsidian plugins usually navigate |
| C | Like A, but each page opens as its **own tab** (full Journalit model) | Large | Pages side by side (e.g. Portfolio next to Analysis) | Needs the shared state (current report, results) moved out of the view into a plugin-level store first |
| D | Keep the top tabs | None | — | Doesn't address the request |

## Recommendation

A now, with C kept possible later.

**Sidebar content:**
1. The TRL mark and worker status.
2. The **current report card**:
   - name and market
   - validated / analysed
   - ✓ equity log, ✓ `.set` check
   - quick actions: Browse and validate, Start analysis
3. Grouped pages:
   - **Home:** Overview
   - **Data:** Data & import
   - **Research:** Analysis, Portfolio, Parameters, Advanced
   - **Documents:** Research notes
4. Help links: the logger guide and the MT5 export guide.

**In the main view:** the top tab strip is replaced by a compact header with
the page title and a small "Pages ▾" switcher, for when the sidebar is closed.

There is also a command for each page ("TRL: Open Portfolio") and the ribbon
icon opens the sidebar.

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| NAV-1 | Add a TRL navigation panel in Obsidian's left sidebar (option A)? | **Yes** |
| NAV-2 | Replace the top tab strip with a compact header plus a "Pages ▾" switcher? | **Yes** |
| NAV-3 | Show the current-report card (status, companions, quick actions) in the sidebar? | **Yes** |
| NAV-4 | Pages as separate tabs (option C)? | **Later**: after moving shared state to a plugin-level store |
