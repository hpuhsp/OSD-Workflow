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
  return root;
}

function write(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function writeLiteDelivery(root, feature = "small-fix") {
  write(root, `openspec/changes/${feature}/spec.md`, "# Spec\n\n## Acceptance Criteria\n\n- Expected behavior is defined.\n");
  write(root, `knowledge/archive/${feature}/test-report.md`, "# Verification\n\nResult: pass\n");
  write(root, `knowledge/archive/${feature}/stage-report.md`, `# Delivery Record\n\n- Task type: bug_fix\n- Mode: lite\n- Development strategy: test_first\n- Result: pass\n- Specification: openspec/changes/${feature}/spec.md\n- Verification: node --test, exit 0\n- Red evidence: regression test failed before fix\n- Green evidence: node --test passed after fix\n`);
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
  assert.ok(manifest.modes.lite.required_outputs.includes("openspec/changes/{feature}/spec.md"));
  assert.deepEqual(manifest.development_strategies.tdd.required_evidence, ["red", "green", "refactor"]);
});

test("TDD requires red, green, and refactor evidence", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "business-rule");
  write(root, "knowledge/archive/business-rule/stage-report.md", "# Delivery Record\n\n- Task type: new_feature\n- Mode: lite\n- Development strategy: tdd\n- Result: pass\n- Specification: openspec/changes/business-rule/spec.md\n- Verification: node --test, exit 0\n- Green evidence: test passed\n- Refactor evidence: tests remained green\n");
  const result = verify({ target: root, structuralOnly: false, feature: "business-rule", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Red evidence for tdd")));
});

test("complete TDD evidence passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "pricing-rule");
  write(root, "knowledge/archive/pricing-rule/stage-report.md", "# Delivery Record\n\n- Task type: new_feature\n- Mode: lite\n- Development strategy: tdd\n- Result: pass\n- Specification: openspec/changes/pricing-rule/spec.md\n- Verification: node --test, exit 0\n- Red evidence: pricing rule test failed with missing behavior\n- Green evidence: pricing rule test passed after minimum implementation\n- Refactor evidence: full focused suite remained green after cleanup\n");
  const result = verify({ target: root, structuralOnly: false, feature: "pricing-rule", mode: "lite", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("verification-only requires a strategy reason", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "docs-update");
  write(root, "knowledge/archive/docs-update/stage-report.md", "# Delivery Record\n\n- Task type: maintenance\n- Mode: lite\n- Development strategy: verification_only\n- Result: pass\n- Specification: openspec/changes/docs-update/spec.md\n- Verification: link check passed\n");
  const result = verify({ target: root, structuralOnly: false, feature: "docs-update", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Strategy reason for verification_only")));
});

test("verification-only with a reason passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "style-update");
  write(root, "knowledge/archive/style-update/stage-report.md", "# Delivery Record\n\n- Task type: maintenance\n- Mode: lite\n- Development strategy: verification_only\n- Result: pass\n- Specification: openspec/changes/style-update/spec.md\n- Verification: visual regression check passed\n- Strategy reason: pure styling change has no meaningful unit-test boundary\n");
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
  write(root, "knowledge/archive/small-fix/test-report.md", "   \n");
  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("is empty")));
});

test("unsafe feature paths are rejected", () => {
  assert.throws(() => parseArgs(["--feature", "../escape"]), /safe directory name/);
});
