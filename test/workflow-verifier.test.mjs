import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { parseArgs, verify } from "../scripts/verify-workflow-artifacts.mjs";

const projectRoot = resolve(import.meta.dirname, "..");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "osd-workflow-test-"));
  cpSync(join(projectRoot, ".ai"), join(root, ".ai"), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(root, ".ai/workflow-manifest.json"), "utf8"));
  const entryTemplate = readFileSync(join(root, ".ai/templates/agent-entry.md"), "utf8").trim();
  for (const entry of manifest.discovery.managed_entry_files) {
    const frontmatter = entry.endsWith(".mdc") ? "---\nalwaysApply: true\n---\n\n" : "";
    write(root, entry, `${frontmatter}<!-- osd-workflow:start -->\n${entryTemplate}\n<!-- osd-workflow:end -->\n`);
  }
  return root;
}

function write(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function writeLiteDelivery(root, feature = "small-fix") {
  write(root, `openspec/changes/${feature}/spec.md`, "# Spec\n\n## Acceptance Criteria\n\n- Expected behavior is defined.\n");
  write(root, `knowledge/archive/${feature}/stage-report.md`, deliveryRecord({ feature }));
}

function deliveryRecord({
  feature,
  taskType = "bug_fix",
  strategy = "test_first",
  extra = "- Red evidence: regression test failed before fix\n- Green evidence: node --test passed after fix\n",
}) {
  return `# Delivery Record\n\n- Task type: ${taskType}\n- Mode: lite\n- Development strategy: ${strategy}\n- OSD controller: osd_workflow\n- OpenSpec participation: validated openspec/changes/${feature}/spec.md\n- Superpowers participation: applied ${strategy} execution discipline\n- Result: pass\n- Specification: openspec/changes/${feature}/spec.md\n- Verification: node --test, exit 0\n${extra}`;
}

test("structural verification passes for the repository contract", () => {
  const result = verify({ target: projectRoot, structuralOnly: true, feature: "", mode: "", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("delivery verification requires a feature argument", () => {
  assert.throws(() => parseArgs([]), /--feature is required/);
  assert.throws(() => parseArgs(["--feature"]), /requires a value/);
});

test("valid lite delivery passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root);
  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("mode contracts scale artifact requirements", () => {
  const manifest = JSON.parse(readFileSync(join(projectRoot, ".ai/workflow-manifest.json"), "utf8"));
  const lite = manifest.modes.lite.required_outputs.length;
  const standard = manifest.modes.standard.required_outputs.length;
  const strict = manifest.modes.strict.required_outputs.length;
  assert.ok(lite < standard);
  assert.ok(standard < strict);
  assert.equal(lite, 2);
  assert.equal(standard, 4);
  assert.equal(strict, 7);
  assert.ok(manifest.modes.lite.required_outputs.includes("openspec/changes/{feature}/spec.md"));
  assert.ok(!manifest.modes.standard.required_outputs.includes("knowledge/archive/{feature}/test-report.md"));
  assert.deepEqual(manifest.development_strategies.tdd.required_evidence, ["red", "green", "refactor"]);
});

test("OSD remains the top-level workflow controller", () => {
  const manifest = JSON.parse(readFileSync(join(projectRoot, ".ai/workflow-manifest.json"), "utf8"));
  const workflow = readFileSync(join(projectRoot, ".ai/workflows/feature-development.yaml"), "utf8");

  assert.equal(manifest.orchestration.controller, "osd_workflow");
  assert.equal(manifest.orchestration.specification_authority, "openspec");
  assert.equal(manifest.orchestration.execution_method, "superpowers");
  assert.equal(manifest.orchestration.external_methods_may_reorder_stages, false);
  assert.equal(manifest.sdd_required[0], "osd_orchestration");
  assert.equal(manifest.delegation.specification.owner, "openspec");
  assert.equal(manifest.delegation.implementation.owner, "superpowers");
  assert.ok(!manifest.modes.standard.stages.includes("intake"));
  assert.equal(manifest.conditional_stages.intake.before, "specification");
  assert.match(workflow, /orchestration_precedence:/);
  assert.match(workflow, /id: spec-review/);
  assert.doesNotMatch(workflow, /flow: "Superpowers routing/);
});

test("installed projects require complete agent discovery entries", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  rmSync(join(root, "AGENTS.md"));

  const result = verify({ target: root, structuralOnly: true, feature: "", mode: "", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Missing or empty managed agent entry: AGENTS.md")));
});

test("delivery requires OpenSpec and Superpowers participation evidence", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root);
  const report = join(root, "knowledge/archive/small-fix/stage-report.md");
  writeFileSync(report, readFileSync(report, "utf8").replace(/^- Superpowers participation:.*\n/m, ""), "utf8");

  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Superpowers participation")));
});

test("TDD requires red, green, and refactor evidence", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "business-rule");
  write(root, "knowledge/archive/business-rule/stage-report.md", deliveryRecord({ feature: "business-rule", taskType: "new_feature", strategy: "tdd", extra: "- Green evidence: test passed\n- Refactor evidence: tests remained green\n" }));
  const result = verify({ target: root, structuralOnly: false, feature: "business-rule", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Red evidence for tdd")));
});

test("complete TDD evidence passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "pricing-rule");
  write(root, "knowledge/archive/pricing-rule/stage-report.md", deliveryRecord({ feature: "pricing-rule", taskType: "new_feature", strategy: "tdd", extra: "- Red evidence: pricing rule test failed with missing behavior\n- Green evidence: pricing rule passed after minimum implementation\n- Refactor evidence: focused suite remained green after cleanup\n" }));
  const result = verify({ target: root, structuralOnly: false, feature: "pricing-rule", mode: "lite", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("verification-only requires a strategy reason", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "docs-update");
  write(root, "knowledge/archive/docs-update/stage-report.md", deliveryRecord({ feature: "docs-update", taskType: "maintenance", strategy: "verification_only", extra: "" }));
  const result = verify({ target: root, structuralOnly: false, feature: "docs-update", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Strategy reason for verification_only")));
});

test("verification-only with a reason passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "style-update");
  write(root, "knowledge/archive/style-update/stage-report.md", deliveryRecord({ feature: "style-update", taskType: "maintenance", strategy: "verification_only", extra: "- Strategy reason: pure styling change has no meaningful unit-test boundary\n" }));
  const result = verify({ target: root, structuralOnly: false, feature: "style-update", mode: "lite", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("a directory cannot satisfy a required file", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root);
  rmSync(join(root, "openspec/changes/small-fix/spec.md"));
  mkdirSync(join(root, "openspec/changes/small-fix/spec.md"));
  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("not a regular file")));
});

test("an empty artifact fails", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root);
  write(root, "knowledge/archive/small-fix/stage-report.md", "   \n");
  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("is empty")));
});

test("unsafe feature paths are rejected", () => {
  assert.throws(() => parseArgs(["--feature", "../escape"]), /safe directory name/);
});
