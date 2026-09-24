import assert from "node:assert/strict";
import test from "node:test";
import { SOURCES, WORKFLOW_STEPS } from "../src/components/help/research-workflow.ts";

// The owner's sourcing rule: every sourced point names a registered source; nothing else claims one.
test("every sourced point cites a known source, and only sourced points cite one", () => {
  for (const step of WORKFLOW_STEPS) {
    for (const point of step.checks) {
      if (point.label === "S") assert.ok(point.source && point.source in SOURCES, `${step.number}: ${point.text}`);
      else assert.equal(point.source, undefined, `${step.number}: only sourced points carry a source`);
    }
  }
});

test("steps run 0 to 10 in order, each with where, inputs, and at least one check", () => {
  assert.deepEqual(WORKFLOW_STEPS.map((step) => step.number), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const step of WORKFLOW_STEPS) assert.ok(step.where && step.inputs && step.checks.length > 0, String(step.number));
});

test("user-defined thresholds explain a trade-off instead of giving a number", () => {
  for (const step of WORKFLOW_STEPS) for (const point of step.checks.filter((item) => item.label === "U")) {
    assert.doesNotMatch(point.text, /\b\d+(\.\d+)?\s*%|\bat least \d/, `${step.number}: ${point.text}`);
  }
});

test("the shipped Markdown guide is generated from the same content", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { workflowMarkdown } = await import("../src/components/help/research-workflow.ts");
  const path = resolve(import.meta.dirname, "..", "..", "product-docs", "RESEARCH_WORKFLOW.md");
  assert.equal(readFileSync(path, "utf8"), workflowMarkdown(), "Regenerate with: node --input-type=module -e \"import('./src/components/help/research-workflow.ts').then(m => require('fs').writeFileSync('../product-docs/RESEARCH_WORKFLOW.md', m.workflowMarkdown()))\"");
});
