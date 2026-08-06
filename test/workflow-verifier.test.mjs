import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseArgs, verify } from "../scripts/verify-workflow-artifacts.mjs";
import { summarizeRunEvents } from "../scripts/runtime-governance.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

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

function archiveResult(feature) {
  const location = `openspec/changes/archive/2026-08-03-${feature}`;
  const nativeCommand = `openspec archive ${feature} --yes`;
  return JSON.stringify({
    schema: "osd-archive-result/v1",
    feature,
    status: "archived",
    native_command: nativeCommand,
    exit_code: 0,
    archived_change_location: location,
    knowledge_sync: "not_required",
    completed_at: "2026-08-03T00:03:00+08:00",
    summary: "Native OpenSpec archive completed successfully.",
    provenance: {
      schema: "osd-native-archive-attestation/v1",
      runner: "osd-openspec-archive",
      argv: nativeCommand.split(" "),
      repository_revision: "test",
      workspace_dirty: false,
      started_at: "2026-08-03T00:02:00+08:00",
      recorded_at: "2026-08-03T00:03:00+08:00",
    },
  });
}

function moveChangeToNativeArchive(root, feature) {
  const active = join(root, "openspec", "changes", feature);
  const archived = join(root, "openspec", "changes", "archive", `2026-08-03-${feature}`);
  mkdirSync(resolve(archived, ".."), { recursive: true });
  renameSync(active, archived);
}

function writeLiteDelivery(root, feature = "small-fix") {
  write(root, `openspec/changes/${feature}/spec.md`, "# Spec\n\n## Acceptance Criteria\n\n- Expected behavior is defined.\n");
  write(root, `openspec/changes/${feature}/archive-result.json`, archiveResult(feature));
  write(root, `knowledge/delivery/${feature}/stage-report.md`, deliveryRecord({ feature }));
  moveChangeToNativeArchive(root, feature);
}

function writeStandardGovernance(root, feature = "governed-change", overrides = {}) {
  const strategy = overrides.strategy ?? "tdd";
  const mode = overrides.mode ?? "standard";
  const status = overrides.status ?? "archived";
  write(root, `openspec/changes/${feature}/proposal.md`, "# Proposal\n\nApproved scope.\n");
  write(root, `openspec/changes/${feature}/spec.md`, "# Spec\n\n## Acceptance Criteria\n\n- **AC-01**: Expected behavior is defined and observable.\n");
  write(root, `openspec/changes/${feature}/approval.md`, overrides.approval ?? "- Decision: approved\n- Reviewer: reviewer\n- Decision timestamp: 2026-08-03T00:00:00+08:00\n- Reviewed proposal: proposal.md\n- Reviewed specification: spec.md\n- Scope notes: approved\n- Residual risks: none\n");
  write(root, `openspec/changes/${feature}/osd-state.json`, JSON.stringify({
    schema: "osd-change-state/v1",
    feature,
    task_type: "new_feature",
    mode,
    strategy,
    stage: "review",
    status,
    specification: `openspec/changes/${feature}/spec.md`,
    updated_at: "2026-08-03T00:00:00+08:00",
  }));
  write(root, `openspec/changes/${feature}/tasks.md`, overrides.tasks ?? "- T-01: implement behavior. Linked acceptance criteria: AC-01. Owner: developer. Dependencies: none. Status: done. Verification: node --test.\n");
  write(root, `openspec/changes/${feature}/verification.json`, JSON.stringify(overrides.evidence ?? {
    schema: "osd-verification-evidence/v1",
    feature,
    strategy,
    steps: [
      { step: "red", command_id: "test", exit_code: 1, observed_at: "2026-08-03T00:00:00+08:00", covered_acceptance_criteria: ["AC-01"], summary: "failed before implementation" },
      { step: "green", command_id: "test", exit_code: 0, observed_at: "2026-08-03T00:01:00+08:00", covered_acceptance_criteria: ["AC-01"], summary: "passed after implementation" },
      { step: "refactor", command_id: "test", exit_code: 0, observed_at: "2026-08-03T00:02:00+08:00", covered_acceptance_criteria: ["AC-01"], summary: "remained green" },
    ],
  }));
  writeRuntimeGovernance(root, feature, mode);
  if (mode === "strict") {
    write(root, `openspec/changes/${feature}/design.md`, "# Design\n\n- Compatibility-preserving verifier extension.\n");
    write(root, `knowledge/delivery/${feature}/test-report.md`, "# Test Report\n\nResult: pass\n");
    write(root, `knowledge/delivery/${feature}/review-report.md`, "# Review Report\n\nResult: pass\n");
  }
  write(root, `openspec/changes/${feature}/archive-result.json`, archiveResult(feature));
  write(root, `knowledge/delivery/${feature}/implementation.md`, "# Implementation\n\n- T-01 complete.\n");
  write(root, `knowledge/delivery/${feature}/stage-report.md`, deliveryRecord({
    feature,
    taskType: "new_feature",
    strategy,
    mode,
    extra: "- Approval: approval.md approved\n- Task traceability: T-01 covers AC-01\n- Structured evidence: verification.json\n- Red evidence: test failed before implementation\n- Green evidence: test passed after implementation\n- Refactor evidence: focused suite remained green\n",
  }));
  if (overrides.archived !== false) moveChangeToNativeArchive(root, feature);
}

function writeRuntimeGovernance(root, feature, mode) {
  const timestamp = "2026-08-03T00:03:00+08:00";
  const roles = mode === "strict" ? ["executor", "test_verifier", "reviewer", "monitor"] : ["executor"];
  const assignments = roles.map((role) => ({
    task_id: "T-01",
    role,
    ...(role === "executor" ? { owned_areas: ["scripts/runtime-governance.mjs"], isolated_execution: true } : {}),
  }));
  write(root, `openspec/changes/${feature}/context/T-01.json`, JSON.stringify({
    schema: "osd-runtime-context/v1",
    contract_version: "1",
    feature,
    mode,
    strategy: "tdd",
    stage: "implementation",
    state_path: `openspec/changes/${feature}/osd-state.json`,
    specification_path: `openspec/changes/${feature}/spec.md`,
    task_id: "T-01",
    acceptance_criteria: ["AC-01"],
    dependencies: [],
    affected_areas: ["scripts/runtime-governance.mjs"],
    verification_method: "node --test",
    policy_version: "1",
    resource_ids: ["specification", "tasks", "state", "verification", "review", "archive"],
    assignments,
    status: "runnable",
    reasons: [],
    generated_at: timestamp,
  }));
  const events = [
    ...roles.map((role, index) => ({ schema: "osd-run-event/v1", run_id: `run-${index + 1}`, feature, task_id: "T-01", stage: role === "monitor" ? "review" : "implementation", actor_role: role, event_type: "role_completed", status: "completed", timestamp, contract_version: "1", duration_ms: role === "monitor" ? 0 : 1, retry_count: 0 })),
    { schema: "osd-run-event/v1", run_id: "run-eval", feature, stage: "verification", actor_role: "coordinator", event_type: "evaluation_completed", status: "completed", timestamp, contract_version: "1", duration_ms: 0, retry_count: 0 },
  ];
  write(root, `openspec/changes/${feature}/run-events.jsonl`, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
  write(root, `openspec/changes/${feature}/evaluation.json`, JSON.stringify({
    schema: "osd-evaluation/v1",
    feature,
    context_package_version: "1",
    policy_version: "1",
    deterministic_checks: [{ command_id: "node-test", exit_code: 0, covered_acceptance_criteria: ["AC-01"] }],
    optional_graders: [{ evaluator: "human-review", rubric_version: "v1", status: "not_run" }],
  }));
  write(root, `knowledge/delivery/${feature}/runtime-summary.json`, JSON.stringify(summarizeRunEvents(events)));
}

function deliveryRecord({
  feature,
  taskType = "bug_fix",
  strategy = "test_first",
  mode = "lite",
  extra = "- Red evidence: regression test failed before fix\n- Green evidence: node --test passed after fix\n",
}) {
  return `# Delivery Record\n\n- Task type: ${taskType}\n- Mode: ${mode}\n- Development strategy: ${strategy}\n- OSD controller: osd_workflow\n- OpenSpec participation: validated openspec/changes/${feature}/spec.md\n- Superpowers participation: applied ${strategy} execution discipline\n- Result: pass\n- Specification: openspec/changes/${feature}/spec.md\n- Verification: node --test, exit 0\n${extra}`;
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
  assert.equal(lite, 3);
  assert.equal(standard, 9);
  assert.equal(strict, 12);
  assert.ok(manifest.modes.lite.required_outputs.includes("openspec/changes/{feature}/spec.md"));
  assert.ok(!manifest.modes.standard.required_outputs.includes("knowledge/delivery/{feature}/test-report.md"));
  assert.deepEqual(manifest.development_strategies.tdd.required_evidence, ["red", "green", "refactor"]);
  assert.equal(manifest.schema, "osd-workflow-manifest/v6");
  assert.ok(manifest.governance.approval_required_modes.includes("standard"));
  assert.equal(manifest.runtime_governance.catalog_file, ".ai/runtime-governance/governance.json");
});

test("valid standard governance delivery passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root);
  const result = verify({ target: root, structuralOnly: false, feature: "governed-change", mode: "standard", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("delivery rejects a self-reported archive result while the change remains active", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "active-change", { archived: false });
  const result = verify({ target: root, structuralOnly: false, feature: "active-change", mode: "standard", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("must be natively archived")));
  assert.ok(result.errors.some((error) => error.includes("must not remain active")));
});

test("trusted evidence gate rejects self-reported structured evidence", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "trusted-evidence");
  const result = verify({ target: root, structuralOnly: false, feature: "trusted-evidence", mode: "standard", handoff: false, trustedEvidence: true });
  assert.ok(result.errors.some((error) => error.includes("trusted runner provenance")));
});

test("standard delivery requires explicit approval", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "approval-required", { approval: "- Decision: changes_requested\n- Reviewer: reviewer\n- Decision timestamp: 2026-08-03T00:00:00+08:00\n- Reviewed proposal: proposal.md\n- Reviewed specification: spec.md\n- Scope notes: revise\n- Residual risks: unknown\n" });
  const result = verify({ target: root, structuralOnly: false, feature: "approval-required", mode: "standard", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("must be approved")));
});

test("standard delivery rejects uncovered acceptance criteria", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "criteria-covered", { tasks: "- T-01: implement behavior. Linked acceptance criteria: AC-99. Owner: developer. Dependencies: none. Status: done. Verification: node --test.\n" });
  const result = verify({ target: root, structuralOnly: false, feature: "criteria-covered", mode: "standard", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("not covered by a task")));
});

test("standard delivery rejects invalid structured evidence", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "evidence-required", { evidence: { schema: "osd-verification-evidence/v1", feature: "evidence-required", strategy: "tdd", steps: [] } });
  const result = verify({ target: root, structuralOnly: false, feature: "evidence-required", mode: "standard", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("has no steps")));
});

test("strict delivery requires a successful archive result", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "strict-change", { mode: "strict", status: "archived" });
  const result = verify({ target: root, structuralOnly: false, feature: "strict-change", mode: "strict", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("strict delivery requires completed verifier, reviewer, and monitor role evidence", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "strict-runtime-roles", { mode: "strict", status: "archived" });
  const eventPath = join(root, "openspec/changes/archive/2026-08-03-strict-runtime-roles/run-events.jsonl");
  const withoutMonitor = readFileSync(eventPath, "utf8").split(/\r?\n/).filter((line) => line && !line.includes('"actor_role":"monitor"')).join("\n");
  writeFileSync(eventPath, `${withoutMonitor}\n`, "utf8");
  const result = verify({ target: root, structuralOnly: false, feature: "strict-runtime-roles", mode: "strict", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("completed monitor role evidence")));
});

test("legacy v4 delivery passes with an explicit runtime-governance warning", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeStandardGovernance(root, "legacy-v4");
  const manifestPath = join(root, ".ai/workflow-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.schema = "osd-workflow-manifest/v4";
  writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
  const result = verify({ target: root, structuralOnly: false, feature: "legacy-v4", mode: "standard", handoff: false });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("native archive governance applies")));
});

test("legacy v3 structural verification reports a migration warning", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const manifestPath = join(root, ".ai/workflow-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.schema = "osd-workflow-manifest/v3";
  writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
  const result = verify({ target: root, structuralOnly: true, feature: "", mode: "", handoff: false });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("Legacy manifest schema")));
});

test("OSD remains the top-level workflow controller", () => {
  const manifest = JSON.parse(readFileSync(join(projectRoot, ".ai/workflow-manifest.json"), "utf8"));
  const workflow = readFileSync(join(projectRoot, ".ai/workflows/feature-development.yaml"), "utf8");

  assert.equal(manifest.orchestration.controller, "osd_workflow");
  assert.equal(manifest.orchestration.specification_authority, "openspec");
  assert.equal(manifest.orchestration.execution_method, "superpowers");
  assert.equal(manifest.discovery.client_compatibility.qoder.entry_file, "AGENTS.md");
  assert.equal(manifest.discovery.client_compatibility.qoder.mode, "native_agents_md");
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
  const report = join(root, "knowledge/delivery/small-fix/stage-report.md");
  writeFileSync(report, readFileSync(report, "utf8").replace(/^- Superpowers participation:.*\n/m, ""), "utf8");

  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Superpowers participation")));
});

test("TDD requires red, green, and refactor evidence", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "business-rule");
  write(root, "knowledge/delivery/business-rule/stage-report.md", deliveryRecord({ feature: "business-rule", taskType: "new_feature", strategy: "tdd", extra: "- Green evidence: test passed\n- Refactor evidence: tests remained green\n" }));
  const result = verify({ target: root, structuralOnly: false, feature: "business-rule", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Red evidence for tdd")));
});

test("complete TDD evidence passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "pricing-rule");
  write(root, "knowledge/delivery/pricing-rule/stage-report.md", deliveryRecord({ feature: "pricing-rule", taskType: "new_feature", strategy: "tdd", extra: "- Red evidence: pricing rule test failed with missing behavior\n- Green evidence: pricing rule passed after minimum implementation\n- Refactor evidence: focused suite remained green after cleanup\n" }));
  const result = verify({ target: root, structuralOnly: false, feature: "pricing-rule", mode: "lite", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("verification-only requires a strategy reason", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "docs-update");
  write(root, "knowledge/delivery/docs-update/stage-report.md", deliveryRecord({ feature: "docs-update", taskType: "maintenance", strategy: "verification_only", extra: "" }));
  const result = verify({ target: root, structuralOnly: false, feature: "docs-update", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("Strategy reason for verification_only")));
});

test("verification-only with a reason passes", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root, "style-update");
  write(root, "knowledge/delivery/style-update/stage-report.md", deliveryRecord({ feature: "style-update", taskType: "maintenance", strategy: "verification_only", extra: "- Strategy reason: pure styling change has no meaningful unit-test boundary\n" }));
  const result = verify({ target: root, structuralOnly: false, feature: "style-update", mode: "lite", handoff: false });
  assert.deepEqual(result.errors, []);
});

test("a directory cannot satisfy a required file", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root);
  const specPath = join(root, "openspec/changes/archive/2026-08-03-small-fix/spec.md");
  rmSync(specPath);
  mkdirSync(specPath);
  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("not a regular file")));
});

test("an empty artifact fails", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeLiteDelivery(root);
  write(root, "knowledge/delivery/small-fix/stage-report.md", "   \n");
  const result = verify({ target: root, structuralOnly: false, feature: "small-fix", mode: "lite", handoff: false });
  assert.ok(result.errors.some((error) => error.includes("is empty")));
});

test("unsafe feature paths are rejected", () => {
  assert.throws(() => parseArgs(["--feature", "../escape"]), /safe directory name/);
});
