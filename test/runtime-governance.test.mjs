import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContextPackage,
  summarizeRunEvents,
  validateAssignmentPlan,
  validateEvaluationRecord,
  validatePolicyAction,
  validateRunEvent,
  validateRuntimeCatalog,
} from "../scripts/runtime-governance.mjs";

function catalog() {
  return {
    schema: "osd-runtime-governance/v1",
    version: "1",
    resources: [
      { id: "specification", canonical_owner: "openspec", capability: "read", sensitivity: "internal", stages: ["planning", "implementation"] },
      { id: "tasks", canonical_owner: "openspec", capability: "read", sensitivity: "internal", stages: ["planning", "implementation"] },
    ],
    policy: {
      command_ids: ["node-test"],
      prohibited_path_prefixes: [".git"],
      approval_required_modes: ["standard", "strict"],
      role_profiles: {
        coordinator: { write_capable: false },
        executor: { write_capable: true },
        test_verifier: { write_capable: false },
        reviewer: { write_capable: false },
        monitor: { write_capable: false, approval_capable: false, remediation_capable: false },
      },
      mode_triggers: {
        lite: { required_roles: ["executor"] },
        standard: { required_roles: ["executor"] },
        strict: { required_roles: ["executor", "test_verifier", "reviewer", "monitor"] },
      },
    },
    evaluation: { deterministic_required: true, optional_grader_statuses: ["pass", "fail", "not_run"] },
  };
}

test("runtime catalog validates unified resources, policy, evaluation, and role boundaries", () => {
  assert.deepEqual(validateRuntimeCatalog(catalog()), []);
  const invalid = catalog();
  invalid.policy.role_profiles.monitor.write_capable = true;
  assert.ok(validateRuntimeCatalog(invalid).some((error) => error.includes("monitor")));
});

test("context package is runnable only for approved task-scoped single-writer work", () => {
  const result = buildContextPackage({
    feature: "runtime-change",
    mode: "standard",
    strategy: "test_first",
    state: { status: "approved", stage: "planning", specification: "openspec/changes/runtime-change/spec.md" },
    task: { id: "T-01", criteria: ["AC-01"], dependencies: [], affected_areas: ["scripts/runtime-governance.mjs"], verification: "node-test" },
    catalog: catalog(),
    assignments: [{ task_id: "T-01", role: "executor", owned_areas: ["scripts/runtime-governance.mjs"], isolated_execution: true }],
    generated_at: "2026-08-05T00:00:00+08:00",
  });
  assert.equal(result.status, "runnable");
  assert.deepEqual(result.acceptance_criteria, ["AC-01"]);

  const duplicate = validateAssignmentPlan([
    { task_id: "T-01", role: "executor", owned_areas: ["scripts/runtime-governance.mjs"], isolated_execution: true },
    { task_id: "T-01", role: "executor", owned_areas: ["scripts/runtime-governance.mjs"], isolated_execution: true },
  ], catalog());
  assert.ok(duplicate.some((error) => error.includes("single write-capable executor")));

  const dependent = validateAssignmentPlan([
    { task_id: "T-01", role: "executor", owned_areas: ["src/a.js"], isolated_execution: true, parallel_with: ["T-02"], dependency_task_ids: ["T-02"] },
    { task_id: "T-02", role: "executor", owned_areas: ["src/b.js"], isolated_execution: true },
  ], catalog());
  assert.ok(dependent.some((error) => error.includes("cannot run in parallel")));
});

test("policy actions are pure and reject unknown commands, prohibited paths, or missing approval", () => {
  assert.deepEqual(validatePolicyAction({ command_id: "node-test", role: "test_verifier", mode: "standard", approved: true, paths: ["test/runtime-governance.test.mjs"] }, catalog()), []);
  const errors = validatePolicyAction({ command_id: "npm dangerous", role: "coordinator", mode: "standard", approved: false, paths: [".git/config"], write_capable: true }, catalog());
  assert.ok(errors.some((error) => error.includes("unknown command_id")));
  assert.ok(errors.some((error) => error.includes("requires approved")));
  assert.ok(errors.some((error) => error.includes("prohibited path")));
  assert.ok(errors.some((error) => error.includes("Only executor")));
});

test("run events reject sensitive payloads and summaries preserve operational outcomes", () => {
  const completed = { schema: "osd-run-event/v1", run_id: "run-1", feature: "runtime-change", task_id: "T-01", stage: "verification", actor_role: "test_verifier", event_type: "role_completed", status: "completed", timestamp: "2026-08-05T00:00:00+08:00", contract_version: "1", duration_ms: 20, retry_count: 1 };
  const blocked = { ...completed, run_id: "run-2", actor_role: "monitor", event_type: "policy_denied", status: "blocked", timestamp: "2026-08-05T00:01:00+08:00" };
  assert.deepEqual(validateRunEvent(completed), []);
  assert.ok(validateRunEvent({ ...completed, raw_prompt: "secret" }).some((error) => error.includes("sensitive")));
  assert.deepEqual(summarizeRunEvents([completed, blocked]), {
    schema: "osd-runtime-summary/v1",
    run_count: 2,
    completed_count: 1,
    blocked_count: 1,
    total_duration_ms: 20,
    total_retries: 1,
    verification_outcome: "completed",
    evaluation_outcome: "not_run",
  });
});

test("evaluation requires deterministic evidence and keeps optional graders tri-state", () => {
  const evaluation = {
    schema: "osd-evaluation/v1",
    feature: "runtime-change",
    context_package_version: "1",
    policy_version: "1",
    deterministic_checks: [{ command_id: "node-test", exit_code: 0, covered_acceptance_criteria: ["AC-01"] }],
    optional_graders: [{ evaluator: "reviewer", rubric_version: "1", status: "not_run" }],
  };
  assert.deepEqual(validateEvaluationRecord(evaluation, new Set(["AC-01"])), []);
  assert.ok(validateEvaluationRecord({ ...evaluation, deterministic_checks: [{ command_id: "node-test", exit_code: 1, covered_acceptance_criteria: ["AC-01"] }] }, new Set(["AC-01"])).some((error) => error.includes("failed")));
});
