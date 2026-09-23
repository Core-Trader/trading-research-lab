import assert from "node:assert/strict";
import test from "node:test";
import { addToTrack, addTrack, combinationRequest, deletionConsequence, removeReport, removeTrack, renameTrack, spanTimeline, toggleIncluded } from "../src/components/portfolio/portfolio-model.ts";

test("a report can belong to only one track, and chains keep their order", () => {
  let tracks = addTrack([], "r1", "DCA_EA");
  tracks = addToTrack(tracks, "t1", "r2");
  tracks = addTrack(tracks, "r3", "CENT");
  assert.deepEqual(addTrack(tracks, "r2", "again"), tracks);
  assert.deepEqual(addToTrack(tracks, "t2", "r1"), tracks);
  assert.deepEqual(tracks.map((track) => [track.key, track.refs]), [["t1", ["r1", "r2"]], ["t2", ["r3"]]]);
});

test("removing the last report removes its track; keys are never reused", () => {
  let tracks = addTrack(addTrack([], "r1", "A"), "r2", "B");
  tracks = removeReport(tracks, "r1");
  assert.deepEqual(tracks.map((track) => track.key), ["t2"]);
  tracks = addTrack(tracks, "r3", "C");
  assert.deepEqual(tracks.map((track) => track.key), ["t2", "t3"]);
  assert.deepEqual(removeTrack(tracks, "t2").map((track) => track.key), ["t3"]);
});

test("only included tracks are sent, with labels in the same order", () => {
  let tracks = addTrack(addTrack(addTrack([], "r1", "A"), "r2", "B"), "r3", "");
  tracks = toggleIncluded(renameTrack(tracks, "t1", "Alpha"), "t2");
  assert.deepEqual(combinationRequest(tracks), { tracks: [["r1"], ["r3"]], labels: ["1. Alpha", "Track 3"] });
});

test("span timeline shares one axis", () => {
  const timeline = spanTimeline([{ key: "a", label: "A", first: "2026-01-01T00:00:00", last: "2026-01-11T00:00:00" }, { key: "b", label: "B", first: "2026-01-06T00:00:00", last: "2026-01-21T00:00:00" }]);
  assert.ok(timeline);
  assert.equal(Math.round(timeline.rows[1]!.left), 25);
  assert.equal(Math.round(timeline.rows[0]!.width), 50);
  assert.equal(spanTimeline([{ key: "x", label: "X", first: "bad", last: "2026-01-01T00:00:00" }]), null);
});

test("deletion wording states what happens to linked items", () => {
  const preview = { dependents: [{ kind: "SAVED_COMBINATION", name: "Both" }] };
  assert.equal(deletionConsequence({ dependents: [] }, [], false), "Nothing else uses this report.");
  assert.match(deletionConsequence(preview, ["Notes/a.md"], false), /^2 linked item\(s\) will be kept/);
  assert.equal(deletionConsequence(preview, ["Notes/a.md"], true), "2 linked item(s) will also be removed; 1 note(s) go to Obsidian's trash, where you can recover them.");
});
