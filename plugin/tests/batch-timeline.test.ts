import assert from "node:assert/strict";
import test from "node:test";
import { batchTimeline } from "../src/components/data/batch-timeline.ts";

const member = (ref: string, first: string, last: string) => ({ dataset_ref: ref, dataset_id: ref, source_sha256: ref, filename: `${ref}.xlsx`, currency: "USD", first_timestamp: first, last_timestamp: last, opening_balance: "1", final_reported_balance: "1", event_count: 2 });

test("timeline positions spans on a shared axis and marks only Core-blocked members", () => {
  const timeline = batchTimeline({
    members: [member("a", "2026-01-01T00:00:00", "2026-01-11T00:00:00"), member("b", "2026-01-06T00:00:00", "2026-01-21T00:00:00"), member("c", "2026-01-21T00:00:01", "2026-01-21T00:00:02")],
    findings: [
      { severity: "BLOCKED", code: "COVERAGE_OVERLAP", message: "", members: [{ dataset_ref: "a", filename: "a.xlsx" }, { dataset_ref: "b", filename: "b.xlsx" }] },
      { severity: "WARNING", code: "DEAL_ID_REUSED", message: "", members: [{ dataset_ref: "c", filename: "c.xlsx" }] },
    ],
  });
  assert.ok(timeline);
  assert.equal(timeline.start, "2026-01-01T00:00:00");
  assert.equal(timeline.rows[0]!.left, 0);
  assert.equal(Math.round(timeline.rows[0]!.width), 50);
  assert.equal(Math.round(timeline.rows[1]!.left), 25);
  assert.deepEqual(timeline.rows.map((row) => row.conflict), [true, true, false]);
  assert.ok(timeline.rows[2]!.width >= 0.8);
});

test("unparseable timestamps give no timeline rather than a wrong one", () => {
  assert.equal(batchTimeline({ members: [member("a", "bad", "2026-01-01T00:00:00")], findings: [] }), null);
});
