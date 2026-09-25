# Proposal: first-run onboarding

**Status:** DRAFT 2026-09-25. Awaiting the owner (O1–O8). Intended to be built
and tested in the MVP completion session (`internal/prompts/MVP_SESSION.md`),
as part of MVP-C usability and the MVP-D clean-machine install check.

## Why

- **First-run failures surface late:** a new user opens TRL with no engine
  configured and no report. Today the first sign of a missing Python path is
  an error during the first import ("Set the Python 3.14.7 virtual-environment
  executable…", `plugin/src/worker-client.ts`).
- **The features are hard to discover:** there are nine pages (Overview, Data
  & import, Symbol scan, Analysis, Portfolio, Parameters, Prop-firm check,
  Advanced, Research notes) plus Help. How they connect is explained only on
  the Help page.
- **The owner's request:** a first-run onboarding sequence that explains the
  plugin's features.

## What TRL would add

1. **A first-run welcome view (O1).** It opens once, in the TRL workspace, on
   first run. Five short steps:
   1. **Welcome.** What TRL does and does not do: it analyses MT5 backtests
      locally; it does not trade, connect to a broker, give advice, or send
      data anywhere.
   2. **Engine check.**
      - starts the Python Research Core and shows either "ready" or the
        exact fix
      - the fix covers the settings field, `INSTALL.md` step 1, and a retry
        button
      - it reuses the existing worker readiness check; no new calculation
   3. **First report.**
      - "Import an MT5 report" opens Data & import
      - alternatively, a clearly labelled synthetic sample (O4)
      - it links to the MT5 export guide
   4. **Tour.** Feature tiles grouped as in the sidebar, **generated from the
      page list** (`plugin/src/application/navigation.ts`, `PAGE_GROUPS`), so
      they never go stale. Each tile opens its page.
   5. **Where your work goes.**
      - Research notes (Strategy → Experiment → Report)
      - the Record buttons, one block per check (NOTES-2)
      - the Help guides (Research workflow, Optimisation checklist)
2. **A "Getting started" card on Overview (O2).** It is a widget in the
   customisable layout (LAYOUT-1), so it can be moved or hidden. Each item
   ticks itself off from real state that TRL already knows:
   - the engine is ready
   - a report is imported
   - it is analysed
   - an Experiment exists
   - a check is recorded
   - an equity log is attached
   - a layout is customised

   Unfinished items are clickable and open the right page. The card hides
   itself when every item is done, and can be dismissed.
3. **Reopen and skip (O3).**
   - "Skip" is available at every step
   - "Show onboarding again" in Help & downloads, and a command in the
     command palette
   - the progress state is kept in the plugin settings (`data.json`, local);
     there is no telemetry
4. **Optional synthetic sample report (O4).**
   - a small, clearly synthetic MT5-style report (made from the test
     fixtures, never from real reports), named and labelled "SAMPLE" wherever
     it appears
   - it lets the tour show real screens before the user has exports
   - it would be the first data shipped in a release, so it depends on the
     roadmap's pending publishable-fixture decision
   - it also needs a release-build check that no other data is included
5. **Existing users (O5).** If reports already exist (the owner, or anyone
   upgrading), the welcome is not forced: only the Getting started card
   appears, with "Show onboarding" in Help.
6. **Wording (O6).** Plain language (UIX-5). Tour text describes TRL
   features. Any trading statement follows the sourcing rule and labels, or is
   left out. Everything is hideable with the existing "Show interpretation and
   tips" switch where it is guidance (GUIDE-1).
7. **The Help page's sidebar description (O7)** currently reads "Equity
   logger, MT5 exports". Update it to name the workflow guides too, because
   the tour reuses these descriptions.
8. **Testing (O8).**
   - a pure state model (what to show and when; item completion) with tests
   - harness checks at narrow and normal widths
   - in the MVP-D clean-machine install check, onboarding is the first thing
     the tester follows

## Not included

- Accounts, sign-in, cloud, or any network step.
- Videos or remote images; everything ships inside the plugin.
- Translations (English only, as TRL is today).

## Owner decisions

| ID | Question | Recommendation |
| --- | --- | --- |
| O1 | A five-step first-run welcome view (welcome, engine check, first report, tour, where your work goes) | **Yes** |
| O2 | A "Getting started" card on Overview that ticks items off from real state, movable and hideable | **Yes** |
| O3 | Skip at every step; reopen from Help and the command palette; state kept locally in the plugin settings | **Yes** |
| O4 | A synthetic sample report for the tour | **Defer until the publishable-fixture decision.** Build O1–O3 without it; step 3 then offers only "Import your report" |
| O5 | Existing users see only the card, not the forced welcome | **Yes** |
| O6 | Plain-language feature text; trading statements sourced or left out; guidance hideable | **Yes** |
| O7 | Update the Help page's sidebar description | **Yes** |
| O8 | A tested state model plus harness checks; onboarding used as the first step of the clean-machine install check | **Yes** |

## Build order (in the MVP session, after approval)

1. State model: first-run detection, step progress, and card items from the
   existing state. Tests.
2. The welcome view (O1), skip and reopen (O3), and existing users (O5).
3. The Getting started card as an Overview widget (O2); the Help description
   (O7).
4. Harness checks; then the owner walks it in Obsidian and in the
   clean-machine install check.
5. Record the decisions; update `MVP_FAST_TRACK.md`, the handoff, and the
   journal.
