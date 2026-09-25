import assert from "node:assert/strict";
import test from "node:test";
import { legacyKind, recordedKinds, upsertRecordBlock } from "../src/vault/record-block.ts";

const A = "11111111-1111-5111-8111-111111111111";
const B = "22222222-2222-5222-8222-222222222222";
const C = "33333333-3333-5333-8333-333333333333";
const note = "---\ntrl_type: experiment\n---\n\n# My experiment\nOwner notes.\n";

test("different kinds get their own blocks; neither overwrites the other", () => {
  const first = upsertRecordBlock(note, "significance", A, "### Significance checked\n- conclusion A").text;
  const second = upsertRecordBlock(first, "costs", B, "### Costs checked\n- conclusion B");
  assert.equal(second.replaced, false);
  assert.ok(second.text.includes("conclusion A") && second.text.includes("conclusion B"));
  assert.ok(second.text.startsWith(note));
  assert.deepEqual(recordedKinds(second.text).sort(), ["costs", "significance"]);
});

test("recording the same kind again replaces only that kind's block", () => {
  let text = upsertRecordBlock(note, "significance", A, "### Significance checked\n- old").text;
  text = upsertRecordBlock(text, "costs", B, "### Costs checked\n- keep").text + "\nOwner text after.\n";
  const again = upsertRecordBlock(text, "significance", C, "### Significance checked\n- new");
  assert.equal(again.replaced, true);
  assert.ok(again.text.includes("- new") && !again.text.includes("- old"));
  assert.ok(again.text.includes("- keep") && again.text.endsWith("\nOwner text after.\n"));
});

test("a legacy shared block is upgraded only by its own kind, never overwritten by another", () => {
  const legacy = `${note}\n<!-- TRL:CHOICE:START evaluation_id=${A} -->\n### Windows checked (same settings over time)\n- my windows conclusion\n<!-- TRL:CHOICE:END -->\n`;
  assert.equal(legacyKind("### Windows checked (same settings over time)\n- x"), "windows");
  assert.equal(legacyKind("## Chosen parameter set\n- x"), "parameter-choice");
  const other = upsertRecordBlock(legacy, "costs", B, "### Costs checked\n- c");
  assert.equal(other.replaced, false);
  assert.ok(other.text.includes("my windows conclusion"));                       // not lost any more
  const same = upsertRecordBlock(other.text, "windows", C, "### Windows checked (same settings over time)\n- updated");
  assert.equal(same.replaced, true);
  assert.ok(!same.text.includes("TRL:CHOICE") && same.text.includes("- updated") && same.text.includes("- c"));
});

test("malformed markers of the kind being written block the write; others do not", () => {
  const broken = `${note}<!-- TRL:RECORD:START kind=costs id=${A} -->\nno end`;
  assert.throws(() => upsertRecordBlock(broken, "costs", B, "x"), /malformed/);
  assert.equal(upsertRecordBlock(broken, "significance", B, "x").replaced, false);
  assert.throws(() => upsertRecordBlock(note, "costs", "not-a-uuid", "x"));
});
