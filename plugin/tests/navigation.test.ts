import assert from "node:assert/strict";
import test from "node:test";
import { ALL_PAGES, NavigationStore, PAGE_GROUPS, pageInfo } from "../src/application/navigation.ts";

test("every page appears once, grouped for the sidebar", () => {
  const ids = ALL_PAGES.map((page) => page.id);
  assert.deepEqual([...new Set(ids)].sort(), ["advanced", "analysis", "data", "help", "overview", "parameters", "portfolio", "research"]);
  assert.equal(ids.length, 8);
  assert.deepEqual(PAGE_GROUPS.map((group) => group.label), ["Home", "Data", "Research", "Documents", "Help"]);
  assert.equal(pageInfo("help").label, "Help & downloads");
});

test("the store notifies on real changes only and routes quick actions", () => {
  const store = new NavigationStore();
  const seen: string[] = [];
  const unsubscribe = store.subscribe((snapshot) => seen.push(snapshot.page));
  store.setPage("portfolio");
  store.setPage("portfolio");
  store.update({ busy: false });
  assert.deepEqual(seen, ["portfolio"]);
  assert.equal(store.request("analyse"), false);  // no workspace open yet
  const actions: string[] = [];
  const release = store.handleActions((action) => actions.push(action));
  assert.equal(store.request("validate"), true);
  release();
  assert.equal(store.request("analyse"), false);
  assert.deepEqual(actions, ["validate"]);
  unsubscribe();
  store.setPage("help");
  assert.deepEqual(seen, ["portfolio"]);
});
