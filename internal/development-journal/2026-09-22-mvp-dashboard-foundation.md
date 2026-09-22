# MVP Dashboard Foundation — 2026-09-22

## Scope

Started the approved fast track toward a usable local-first MVP. This increment
adds a fixed presentation-only dashboard above the existing detailed research
tools and makes paired-forward declared context editable rather than hard-coded.

## Delivered

- `plugin/src/components/dashboard-summary.tsx` provides dataset, verified
  balance, verified close-event, realised daily-risk, linked-document, and
  balance-curve cards.
- The dashboard contains no financial calculation; it renders existing Core
  results and invokes existing worker-backed analysis actions.
- Paired-forward import now requires explicit user-supplied in-sample/forward
  dates and modelling mode. This removes the obsolete hard-coded `1-minute
  OHLC` declaration and supports, for example, `Open prices only`.
- The Trading Research Lab view now opens in a central Obsidian workspace tab
  rather than the right sidebar. The dashboard has a concise canvas header and
  fixed card hierarchy; import and detail tools remain below it.
- The dashboard now exposes the normal three-step workflow: Import → Analyse →
  Document. Its actions either invoke existing Core-backed analysis or open the
  appropriate detailed section. It never creates a Strategy, Experiment, or
  Report without the existing explicit user action.

## External provenance

Journalit's dashboard, template-preview, and editor-canvas presentation
patterns were reviewed. No Journalit or Strategy Factory code was copied,
adapted, or substantially derived. The external-code usage register therefore
remains unchanged.

## Validation

- Plugin tests: 7 passed.
- Plugin production build: passed.
- Research Core tests: 42 passed.

## Required owner review

Reload the development plugin in Obsidian and open Trading Research Lab from its
ribbon icon or command. Confirm it opens in a central workspace tab, then run
or reload one representative MT5 report. Inspect the dashboard at a normal and
narrow central-tab width, and confirm that it is clearer than the prior long
control-first view while detailed sections remain available below it.

Also confirm the workflow buttons open Import and Documents when applicable,
and that **Run analysis** produces the existing verified close-event result
without changing the source, report, or any research document.

## Workspace redesign

The prior long control-first panel was replaced with five focused workspace
sections: Overview, Data & import, Analysis, Research, and Advanced. Technical
source evidence is preserved under Data & import instead of competing with the
research dashboard. The design is documented in
`MVP_UI_INFORMATION_ARCHITECTURE.md`.

The normal browse flow now preserves and analyses the selected `.xlsx` report,
then opens the populated Overview. It does not generate a Markdown note; the
explicit M4 Research workflow remains the only document-creation path.
