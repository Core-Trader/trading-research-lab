import React, { createContext, useContext, useState, useSyncExternalStore } from "react";
import { EMPTY_LAYOUTS, isDefaultLayout, moveBy, moveNextTo, resolveLayout, setHidden, setSpan, type Span, type SurfaceLayout, type WidgetDefinition } from "../../layout/layout-model";
import type { LayoutStore } from "../../layout/layout-store";

/** Provided by the workspace; without it a surface shows the default layout and no Customise button. */
export const LayoutContext = createContext<LayoutStore | null>(null);

const SPAN_LABEL: Record<Span, string> = { 1: "One third", 2: "Two thirds", 3: "Full width" };
const shown = (content: React.ReactNode): boolean => content !== null && content !== undefined && content !== false;
const noStore: Pick<LayoutStore, "snapshot" | "subscribe"> = { snapshot: EMPTY_LAYOUTS, subscribe: () => () => undefined };

/**
 * A page area whose widgets the user can reorder, hide and (on grid surfaces)
 * resize (LAYOUT-1). `widgets` maps each widget id to its content, or to null
 * when it has nothing to show yet; widgets missing from `widgets` are also null.
 * "grid" uses three columns; "stack" is one column.
 */
export function WidgetSurface({ surface, label, definitions, widgets, variant, unavailableNote = "Appears when its data is available." }: {
  surface: string;
  label: string;
  definitions: readonly WidgetDefinition[];
  widgets: Record<string, React.ReactNode | null>;
  variant: "grid" | "stack";
  unavailableNote?: string;
}): React.ReactElement {
  const store = useContext(LayoutContext);
  const saved = useSyncExternalStore(store?.subscribe ?? noStore.subscribe, () => (store ?? noStore).snapshot.surfaces[surface]);
  const layout = resolveLayout(definitions, saved);
  const [editing, setEditing] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const save = (next: SurfaceLayout): void => store?.set(surface, isDefaultLayout(next, definitions) ? null : next);
  const hiddenCount = layout.items.filter((item) => item.hidden).length;

  const bar = store && <div className={`trl-layout__bar${editing ? " is-editing" : ""}`}>
    {editing
      ? <>
        <span className="trl-m0__note">Drag a widget, or use ↑ ↓, to reorder.{variant === "grid" ? " Choose a width for each." : ""} Changes are saved as you go.</span>
        <button type="button" disabled={isDefaultLayout(layout, definitions)} onClick={() => store.set(surface, null)}>Reset to default</button>
        <button type="button" className="mod-cta" onClick={() => { setEditing(false); setDrop(null); }}>Done</button>
      </>
      : <>
        {hiddenCount > 0 && <span className="trl-m0__note">{hiddenCount} hidden</span>}
        <button type="button" className="trl-layout__customise" aria-label={`Customise the ${label} layout`} onClick={() => setEditing(true)}>Customise layout</button>
      </>}
  </div>;

  if (!editing) {
    return <div className="trl-layout">
      {bar}
      <div className={`trl-layout__items trl-layout--${variant}`}>
        {layout.items.map((item) => {
          const content = widgets[item.id];
          if (item.hidden || !shown(content)) return null;
          return <div key={item.id} className="trl-layout__item" data-widget={item.id} style={{ "--trl-span": item.span } as React.CSSProperties}>{content}</div>;
        })}
      </div>
    </div>;
  }

  const onDragOver = (event: React.DragEvent<HTMLDivElement>, id: string): void => {
    if (!dragged || dragged === id) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    const after = variant === "grid" ? event.clientX > box.left + box.width / 2 : event.clientY > box.top + box.height / 2;
    if (drop?.id !== id || drop.after !== after) setDrop({ id, after });
  };
  const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (dragged && drop) save(moveNextTo(layout, dragged, drop.id, drop.after));
    setDragged(null);
    setDrop(null);
  };

  return <div className="trl-layout is-editing">
    {bar}
    <div className={`trl-layout__items trl-layout--${variant}`} role="list" aria-label={`${label} widgets`}>
      {layout.items.map((item, index) => {
        const definition = byId.get(item.id)!;
        const available = shown(widgets[item.id]);
        const dropClass = drop?.id === item.id ? (drop.after ? " is-drop-after" : " is-drop-before") : "";
        return <div key={item.id} role="listitem" data-widget={item.id}
          className={`trl-layout__item trl-layout__tile${item.hidden ? " is-hidden" : ""}${dragged === item.id ? " is-dragging" : ""}${dropClass}`}
          style={{ "--trl-span": item.span } as React.CSSProperties}
          draggable onDragStart={(event) => { setDragged(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
          onDragEnd={() => { setDragged(null); setDrop(null); }}
          onDragOver={(event) => onDragOver(event, item.id)} onDrop={onDrop}>
          <span className="trl-layout__handle" aria-hidden="true">⠿</span>
          <div className="trl-layout__tile-text">
            <strong>{definition.title}</strong>
            <span className="trl-m0__note">{item.hidden ? "Hidden" : available ? SPAN_LABEL[item.span] : unavailableNote}</span>
          </div>
          <div className="trl-layout__tile-actions">
            {variant === "grid" && definition.spans.length > 1 && <select aria-label={`Width of ${definition.title}`} value={item.span} onChange={(event) => save(setSpan(layout, definitions, item.id, Number(event.currentTarget.value) as Span))}>
              {definition.spans.map((span) => <option key={span} value={span}>{SPAN_LABEL[span]}</option>)}
            </select>}
            <button type="button" aria-label={`Move ${definition.title} up`} disabled={index === 0} onClick={() => save(moveBy(layout, item.id, -1))}>↑</button>
            <button type="button" aria-label={`Move ${definition.title} down`} disabled={index === layout.items.length - 1} onClick={() => save(moveBy(layout, item.id, 1))}>↓</button>
            {definition.canHide !== false && <button type="button" onClick={() => save(setHidden(layout, definitions, item.id, !item.hidden))}>{item.hidden ? "Show" : "Hide"}</button>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
