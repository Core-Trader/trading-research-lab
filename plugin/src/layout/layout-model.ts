/**
 * Customisable layouts (LAYOUT-1): which widgets a surface shows, in which
 * order, and how wide. Pure and tested; the plugin persists the result in its
 * settings. Widgets have globally unique ids ("analysis.windows") so a future
 * custom dashboard can place widgets from several pages on one surface.
 */

/** Columns a widget spans on a surface's grid (1–3; single-column surfaces use 3). */
export type Span = 1 | 2 | 3;

export type WidgetDefinition = {
  /** Globally unique and stable; stored in layouts, never renamed. */
  id: string;
  title: string;
  defaultSpan: Span;
  /** Widths the user may choose; one entry means the width is fixed. */
  spans: readonly Span[];
  /** Some widgets (for example guidance the page depends on) cannot be hidden. */
  canHide?: boolean;
};

export type LayoutItem = { id: string; span: Span; hidden: boolean };

export const LAYOUT_SCHEMA = 1;

export type SurfaceLayout = { schema: typeof LAYOUT_SCHEMA; items: LayoutItem[] };

/** All saved layouts, keyed by surface id ("overview", "analysis", "help", later custom dashboards). */
export type LayoutSettings = { schema: typeof LAYOUT_SCHEMA; surfaces: Record<string, SurfaceLayout> };

export const EMPTY_LAYOUTS: LayoutSettings = { schema: LAYOUT_SCHEMA, surfaces: {} };

export function defaultLayout(definitions: readonly WidgetDefinition[]): SurfaceLayout {
  return { schema: LAYOUT_SCHEMA, items: definitions.map((definition) => ({ id: definition.id, span: definition.defaultSpan, hidden: false })) };
}

/**
 * The layout to show: the saved order, widths and visibility for widgets that
 * still exist; widgets added in a later TRL version appear after the widget
 * that precedes them by default; unknown ids and invalid values are dropped.
 */
export function resolveLayout(definitions: readonly WidgetDefinition[], saved: unknown): SurfaceLayout {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const savedItems = isSurfaceLayout(saved) ? saved.items : [];
  const items: LayoutItem[] = [];
  const seen = new Set<string>();
  for (const item of savedItems) {
    const definition = byId.get(item.id);
    if (!definition || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push({
      id: item.id,
      span: definition.spans.includes(item.span) ? item.span : definition.defaultSpan,
      hidden: definition.canHide === false ? false : item.hidden === true,
    });
  }
  definitions.forEach((definition, index) => {
    if (seen.has(definition.id)) return;
    let at = 0;
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const found = items.findIndex((item) => item.id === definitions[previous]!.id);
      if (found >= 0) { at = found + 1; break; }
    }
    items.splice(at, 0, { id: definition.id, span: definition.defaultSpan, hidden: false });
    seen.add(definition.id);
  });
  return { schema: LAYOUT_SCHEMA, items };
}

/** Moves a widget to a position in the full list (hidden widgets included). */
export function moveTo(layout: SurfaceLayout, id: string, toIndex: number): SurfaceLayout {
  const from = layout.items.findIndex((item) => item.id === id);
  if (from < 0) return layout;
  const items = [...layout.items];
  const [moved] = items.splice(from, 1);
  const target = Math.max(0, Math.min(items.length, toIndex));
  items.splice(target, 0, moved!);
  return { ...layout, items };
}

/** Moves a widget one place up (-1) or down (+1); no change at either end. */
export function moveBy(layout: SurfaceLayout, id: string, delta: -1 | 1): SurfaceLayout {
  const from = layout.items.findIndex((item) => item.id === id);
  if (from < 0 || from + delta < 0 || from + delta >= layout.items.length) return layout;
  return moveTo(layout, id, from + delta);
}

/** Moves a dragged widget to where another was dropped (before or after it). */
export function moveNextTo(layout: SurfaceLayout, id: string, targetId: string, after: boolean): SurfaceLayout {
  if (id === targetId) return layout;
  const without = layout.items.filter((item) => item.id !== id);
  const target = without.findIndex((item) => item.id === targetId);
  if (target < 0) return layout;
  return moveTo(layout, id, after ? target + 1 : target);
}

export function setHidden(layout: SurfaceLayout, definitions: readonly WidgetDefinition[], id: string, hidden: boolean): SurfaceLayout {
  if (hidden && definitions.find((definition) => definition.id === id)?.canHide === false) return layout;
  return { ...layout, items: layout.items.map((item) => item.id === id ? { ...item, hidden } : item) };
}

export function setSpan(layout: SurfaceLayout, definitions: readonly WidgetDefinition[], id: string, span: Span): SurfaceLayout {
  const definition = definitions.find((candidate) => candidate.id === id);
  if (!definition?.spans.includes(span)) return layout;
  return { ...layout, items: layout.items.map((item) => item.id === id ? { ...item, span } : item) };
}

export function isDefaultLayout(layout: SurfaceLayout, definitions: readonly WidgetDefinition[]): boolean {
  const reference = defaultLayout(definitions).items;
  return layout.items.length === reference.length && layout.items.every((item, index) => item.id === reference[index]!.id && item.span === reference[index]!.span && item.hidden === reference[index]!.hidden);
}

/** Reads saved settings defensively (a hand-edited or older data.json must not break the page). */
export function readLayoutSettings(value: unknown): LayoutSettings {
  if (typeof value !== "object" || value === null) return EMPTY_LAYOUTS;
  const surfaces = (value as { surfaces?: unknown }).surfaces;
  if ((value as { schema?: unknown }).schema !== LAYOUT_SCHEMA || typeof surfaces !== "object" || surfaces === null) return EMPTY_LAYOUTS;
  const result: Record<string, SurfaceLayout> = {};
  for (const [key, layout] of Object.entries(surfaces)) if (isSurfaceLayout(layout)) result[key] = layout;
  return { schema: LAYOUT_SCHEMA, surfaces: result };
}

function isSurfaceLayout(value: unknown): value is SurfaceLayout {
  if (typeof value !== "object" || value === null) return false;
  const { schema, items } = value as { schema?: unknown; items?: unknown };
  return schema === LAYOUT_SCHEMA && Array.isArray(items) && items.every((item) => typeof item === "object" && item !== null && typeof (item as LayoutItem).id === "string");
}
