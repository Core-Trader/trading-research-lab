import assert from "node:assert/strict";
import test from "node:test";
import { CHECKLIST_STEPS } from "../src/components/help/optimisation-checklist.ts";
import { SOURCES, WORKFLOW_STEPS } from "../src/components/help/research-workflow.ts";

// The owner's sourcing rule applies to the checklist as to the Research workflow.
test("every sourced point cites a known source, and only sourced points cite one", () => {
  for (const step of CHECKLIST_STEPS) for (const point of step.points) {
    if (point.label === "S") assert.ok(point.source && point.source in SOURCES, `${step.number}: ${point.text}`);
    else assert.equal(point.source, undefined, `${step.number}: only sourced points carry a source`);
  }
});

test("seven steps in order, each mapped to a TRL tool and existing Research workflow steps", () => {
  assert.deepEqual(CHECKLIST_STEPS.map((step) => step.number), [1, 2, 3, 4, 5, 6, 7]);
  const known = new Set(WORKFLOW_STEPS.map((step) => step.number));
  for (const step of CHECKLIST_STEPS) {
    assert.ok(step.tool && step.question && step.points.length > 0, String(step.number));
    assert.ok(step.workflowSteps.length > 0 && step.workflowSteps.every((number) => known.has(number)), `${step.number}: workflow steps`);
  }
});

test("user-defined thresholds explain a trade-off instead of giving a number", () => {
  for (const step of CHECKLIST_STEPS) for (const point of step.points.filter((item) => item.label === "U")) {
    assert.doesNotMatch(point.text, /\d/, `${step.number}: ${point.text}`);
  }
});

test("the Monte Carlo step does not claim reordering can change the final result", () => {
  const monteCarlo = CHECKLIST_STEPS.find((step) => step.title === "Monte Carlo")!;
  assert.equal(monteCarlo.coverage, "FULL");  // reorder plus resampling (PROPOSAL_BOOTSTRAP.md)
  assert.ok(monteCarlo.points.some((point) => /never changes the final total/.test(point.text)));
});

test("the shipped Markdown checklist is generated from the same content", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { checklistMarkdown } = await import("../src/components/help/optimisation-checklist.ts");
  const path = resolve(import.meta.dirname, "..", "..", "product-docs", "OPTIMISATION_CHECKLIST.md");
  assert.equal(readFileSync(path, "utf8"), checklistMarkdown());
});
