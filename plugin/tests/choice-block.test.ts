import assert from "node:assert/strict";
import test from "node:test";
import { upsertChoiceBlock } from "../src/vault/choice-block.ts";

const ID_A = "11111111-1111-5111-8111-111111111111";
const ID_B = "22222222-2222-5222-8222-222222222222";

test("appends a bounded block without touching existing text", () => {
  const note = "---\ntrl_type: experiment\n---\n\n# My experiment\nOwner notes.";
  const { text, replaced } = upsertChoiceBlock(note, ID_A, "## Chosen parameter set\n");
  assert.equal(replaced, false);
  assert.ok(text.startsWith(note));
  assert.ok(text.endsWith(`<!-- TRL:CHOICE:START evaluation_id=${ID_A} -->\n## Chosen parameter set\n<!-- TRL:CHOICE:END -->\n`));
});

test("replaces only the existing block and preserves text before and after", () => {
  const before = "# Notes\nkeep this\n";
  const after = "\n## Later notes\nand this\n";
  const note = `${before}<!-- TRL:CHOICE:START evaluation_id=${ID_A} -->\nold\n<!-- TRL:CHOICE:END -->${after}`;
  const { text, replaced } = upsertChoiceBlock(note, ID_B, "new choice");
  assert.equal(replaced, true);
  assert.equal(text, `${before}<!-- TRL:CHOICE:START evaluation_id=${ID_B} -->\nnew choice\n<!-- TRL:CHOICE:END -->${after}`);
});

test("duplicated or malformed markers block the write", () => {
  const block = `<!-- TRL:CHOICE:START evaluation_id=${ID_A} -->\nx\n<!-- TRL:CHOICE:END -->`;
  assert.throws(() => upsertChoiceBlock(`${block}\n${block}`, ID_B, "y"), /duplicated|malformed/);
  assert.throws(() => upsertChoiceBlock(`<!-- TRL:CHOICE:START evaluation_id=${ID_A} -->\nno end`, ID_B, "y"));
  assert.throws(() => upsertChoiceBlock("stray <!-- TRL:CHOICE:END --> marker", ID_B, "y"));
  assert.throws(() => upsertChoiceBlock("note", "not-a-uuid", "y"));
});
