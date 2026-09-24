import assert from "node:assert/strict";
import test from "node:test";
import { defaultLayout, EMPTY_LAYOUTS, isDefaultLayout, moveBy, moveNextTo, readLayoutSettings, resolveLayout, setHidden, setSpan, type WidgetDefinition } from "../src/layout/layout-model.ts";

const defs: WidgetDefinition[] = [
  { id: "a", title: "A", defaultSpan: 3, spans: [3], canHide: false },
  { id: "b", title: "B", defaultSpan: 2, spans: [1, 2, 3] },
  { id: "c", title: "C", defaultSpan: 1, spans: [1, 2, 3] },
];
const ids = (layout: { items: { id: string }[] }): string[] => layout.items.map((item) => item.id);

test("no saved layout gives the default order, widths and visibility", () => {
  const layout = resolveLayout(defs, undefined);
  assert.deepEqual(layout, defaultLayout(defs));
  assert.equal(isDefaultLayout(layout, defs), true);
});

test("saved order is kept; unknown and duplicate ids are dropped; invalid widths fall back", () => {
  const layout = resolveLayout(defs, { schema: 1, items: [{ id: "c", span: 2, hidden: true }, { id: "gone", span: 1, hidden: false }, { id: "b", span: 5, hidden: false }, { id: "c", span: 1, hidden: false }, { id: "a", span: 3, hidden: false }] });
  assert.deepEqual(ids(layout), ["c", "b", "a"]);
  assert.equal(layout.items[0]!.span, 2);
  assert.equal(layout.items[0]!.hidden, true);
  assert.equal(layout.items[1]!.span, 2);
});

test("a widget added in a later version appears after its default predecessor", () => {
  const saved = { schema: 1, items: [{ id: "c", span: 1, hidden: false }, { id: "a", span: 3, hidden: false }] };
  assert.deepEqual(ids(resolveLayout(defs, saved)), ["c", "a", "b"]);
  const first = [{ id: "z", title: "Z", defaultSpan: 3, spans: [3] } as WidgetDefinition, ...defs];
  assert.deepEqual(ids(resolveLayout(first, saved)), ["z", "c", "a", "b"]);
});

test("a widget that cannot be hidden is shown even if a saved layout hides it", () => {
  const layout = resolveLayout(defs, { schema: 1, items: [{ id: "a", span: 3, hidden: true }] });
  assert.equal(layout.items.find((item) => item.id === "a")!.hidden, false);
  assert.deepEqual(setHidden(layout, defs, "a", true), layout);
});

test("moves: by one, at the ends, and next to a drop target", () => {
  const layout = defaultLayout(defs);
  assert.deepEqual(ids(moveBy(layout, "b", -1)), ["b", "a", "c"]);
  assert.deepEqual(moveBy(layout, "a", -1), layout);
  assert.deepEqual(moveBy(layout, "c", 1), layout);
  assert.deepEqual(ids(moveNextTo(layout, "a", "c", true)), ["b", "c", "a"]);
  assert.deepEqual(ids(moveNextTo(layout, "c", "a", false)), ["c", "a", "b"]);
  assert.deepEqual(moveNextTo(layout, "a", "a", true), layout);
});

test("width changes only to an allowed width; a changed layout is not the default", () => {
  const layout = defaultLayout(defs);
  assert.deepEqual(setSpan(layout, defs, "a", 1), layout);
  const wider = setSpan(layout, defs, "c", 3);
  assert.equal(wider.items[2]!.span, 3);
  assert.equal(isDefaultLayout(wider, defs), false);
  assert.equal(isDefaultLayout(setHidden(layout, defs, "b", true), defs), false);
});

test("saved settings are read defensively", () => {
  assert.deepEqual(readLayoutSettings(undefined), EMPTY_LAYOUTS);
  assert.deepEqual(readLayoutSettings({ schema: 2, surfaces: {} }), EMPTY_LAYOUTS);
  const read = readLayoutSettings({ schema: 1, surfaces: { ok: { schema: 1, items: [{ id: "a", span: 3, hidden: false }] }, bad: { items: "x" } } });
  assert.deepEqual(Object.keys(read.surfaces), ["ok"]);
});
