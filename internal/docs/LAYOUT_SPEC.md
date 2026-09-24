# Customisable layouts (LAYOUT-1)

**Status:** APPROVED and BUILT 2026-09-24 (the owner accepted the recommendation
and asked that it stay open to a grid and to custom analysis dashboards).

## Scope now

| Page | Surface | Grid | What can change |
| --- | --- | --- | --- |
| Overview | `overview` | 3 columns | order, hide/show, width (allowed widths per widget) |
| Analysis | `analysis` | 1 column | order, hide/show |
| Help & downloads | `help` | 1 column | order, hide/show (sections also fold) |

Data & import, Symbol scan, Parameters, Portfolio, and Prop-firm check keep a
fixed order. Their numbered sections are steps that depend on the step before.

## Behaviour

- **Opening edit mode:** a "Customise layout" button opens it for that page.
  Widgets become compact tiles that keep their width, so the grid's shape
  stays visible.
- **Tile controls:** drag handles (HTML5 drag and drop, no dependency), ↑/↓
  buttons for keyboard use, Hide/Show, and a width choice on grid surfaces.
- **Bar:** "Reset to default" and "Done".
- **Saving:** changes save immediately. A layout equal to the default is not
  stored, so future default changes still reach users who never customised.
- **Unavailable widgets:** a widget with nothing to show yet (for example,
  before an import) is still listed in edit mode, with a note.
- **Narrow panes:** below 58rem the grid folds to one column, as before.

## Model (plugin only; no calculations)

- **`plugin/src/layout/layout-model.ts` (pure, tested):**
  - `WidgetDefinition`: `id`, `title`, `defaultSpan`, `spans`, `canHide`
  - `SurfaceLayout`: `schema: 1`, `items [{id, span, hidden}]`
  - `resolveLayout`:
    - keeps the saved order and drops unknown or duplicate ids
    - replaces invalid widths with the default
    - inserts a widget added in a later version after its default predecessor
- **`layout-store.ts`:** persists `LayoutSettings` in the plugin's `data.json`
  (`settings.layouts`), read defensively.
- **`layout/widgets.ts`:** the registry. Widget ids are **global and
  stable**, for example `analysis.windows`.
- **`components/layout/widget-surface.tsx`:** the shared surface.
  `LayoutContext` is provided by the workspace view.
- The fold state of the Help sections is a per-device convenience in local
  storage. It is not a layout.

## Path to custom analysis dashboards (future; needs its own proposal)

1. A dashboard is a new surface id, such as `dashboard:<uuid>`, whose items
   may come from any page's registry. The ids are already global.
2. Widgets must render from shared state, not page-local state. The Analysis
   panels already take their data as props from the workspace; page-local
   tools (Windows, Prop check) would need their inputs lifted to a shared
   store.
3. Free 2D placement (rows and heights, as Journalit does with a
   `react-grid-layout`-style grid) would add `x`, `y`, and `h` to
   `LayoutItem` under `schema: 2`. `readLayoutSettings` would then migrate
   schema 1 in order.
4. Journalit reference (pinned `098d277`, concepts only, no code reused):
   - an explicit edit mode
   - layouts stored in the plugin settings
   - a per-breakpoint layout for the grid
   - `@dnd-kit/sortable` for lists
