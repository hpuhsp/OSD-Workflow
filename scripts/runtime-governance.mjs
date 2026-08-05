#!/usr/bin/env node

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROLES = new Set(["coordinator", "executor", "test_verifier", "reviewer", "monitor"]);
const MODES = new Set(["lite", "standard", "strict"]);
const SENSITIVE_KEYS = new Set(["prompt", "raw_prompt", "source", "source_code", "secret", "secrets", "credential", "credentials", "tool_input", "tool_output", "raw_input", "raw_output"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function safeWithin(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

function sensitiveKey(value) {
  if (Array.isArray(value)) return value.some(sensitiveKey);
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, nested]) => SENSITIVE_KEYS.has(key.toLowerCase()) || sensitiveKey(nested));
}

function acceptanceCriteriaFromSpec(path) {
  const text = readFileSync(path, "utf8");
  return [...new Set([...text.matchAll(/(?:\*\*)?(AC-[0-9]+)(?:\*\*)?\s*[:.)-]/g)].map((match) => match[1]))];
}

function taskFromPlan(path, taskId) {
  const line = readFileSync(path, "utf8").split(/\r?\n/).find((candidate) => new RegExp(`^\\s*[-*]\\s*${taskId}\\s*:`, "i").test(candidate));
  if (!line) return null;
  return {
    id: taskId,
    criteria: [...new Set([...line.matchAll(/AC-[0-9]+/g)].map((match) => match[0]))],
    dependencies: [...new Set([...line.matchAll(/T-[0-9]+/g)].map((match) => match[0]).filter((id) => id !== taskId))],
    affected_areas: [],
    verification: line.match(/\bVerification:\s*([^.]*)/i)?.[1]?.trim() || "",
  };
}

export function validateRuntimeCatalog(catalog) {
  const errors = [];
  if (!isObject(catalog)) return ["Runtime catalog must be an object."];
  if (catalog.schema !== "osd-runtime-governance/v1") errors.push("Runtime catalog has unsupported schema.");
  if (!nonEmpty(catalog.version)) errors.push("Runtime catalog must define version.");
  if (!Array.isArray(catalog.resources) || catalog.resources.length === 0) {
    errors.push("Runtime catalog must define resources.");
  } else {
    const ids = new Set();
    for (const resource of catalog.resources) {
      if (!isObject(resource) || !nonEmpty(resource.id)) {
        errors.push("Runtime catalog contains a resource without an id.");
        continue;
      }
      if (ids.has(resource.id)) errors.push(`Runtime catalog has duplicate resource id: ${resource.id}.`);
      ids.add(resource.id);
      for (const field of ["canonical_owner", "capability", "sensitivity"]) if (!nonEmpty(resource[field])) errors.push(`Resource ${resource.id} is missing ${field}.`);
      if (!Array.isArray(resource.stages) || resource.stages.length === 0) errors.push(`Resource ${resource.id} must define stages.`);
    }
  }
  const policy = catalog.policy;
  if (!isObject(policy)) {
    errors.push("Runtime catalog must define policy.");
    return errors;
  }
  if (!Array.isArray(policy.command_ids) || policy.command_ids.some((id) => !nonEmpty(id))) errors.push("Runtime policy must define command_ids.");
  if (!Array.isArray(policy.prohibited_path_prefixes)) errors.push("Runtime policy must define prohibited_path_prefixes.");
  if (!Array.isArray(policy.approval_required_modes) || !policy.approval_required_modes.includes("standard") || !policy.approval_required_modes.includes("strict")) errors.push("Runtime policy must require approval for standard and strict work.");
  const profiles = policy.role_profiles;
  if (!isObject(profiles)) {
    errors.push("Runtime policy must define role_profiles.");
  } else {
    for (const role of ROLES) {
      if (!isObject(profiles[role])) errors.push(`Runtime policy is missing role profile: ${role}.`);
    }
    if (profiles.monitor?.write_capable === true || profiles.monitor?.approval_capable === true || profiles.monitor?.remediation_capable === true) errors.push("Runtime monitor profile must remain read-only and cannot approve or remediate.");
    if (profiles.coordinator?.write_capable === true) errors.push("Runtime coordinator profile must not modify business code.");
    if (profiles.test_verifier?.write_capable === true || profiles.reviewer?.write_capable === true) errors.push("Runtime test_verifier and reviewer profiles must remain read-only by default.");
    if (profiles.executor?.write_capable !== true) errors.push("Runtime executor profile must be write-capable.");
  }
  const triggers = policy.mode_triggers;
  if (!isObject(triggers)) {
    errors.push("Runtime policy must define mode_triggers.");
  } else {
    for (const mode of MODES) {
      if (!Array.isArray(triggers[mode]?.required_roles)) errors.push(`Runtime policy is missing required_roles for ${mode}.`);
    }
    for (const role of ["executor", "test_verifier", "reviewer", "monitor"]) if (!triggers.strict?.required_roles?.includes(role)) errors.push(`Strict runtime policy must require ${role}.`);
  }
  const evaluation = catalog.evaluation;
  if (!isObject(evaluation) || evaluation.deterministic_required !== true) errors.push("Runtime catalog must require deterministic evaluation.");
  if (!Array.isArray(evaluation?.optional_grader_statuses) || !["pass", "fail", "not_run"].every((status) => evaluation.optional_grader_statuses.includes(status))) errors.push("Runtime catalog must define pass, fail, and not_run optional grader statuses.");
  return errors;
}

export function validateAssignmentPlan(assignments, catalog) {
  const errors = [];
  const profiles = catalog?.policy?.role_profiles ?? {};
  if (!Array.isArray(assignments) || assignments.length === 0) return ["Assignment plan must contain at least one assignment."];
  const executorByTask = new Map();
  const executorAssignments = new Map();
  for (const assignment of assignments) {
    if (!isObject(assignment) || !nonEmpty(assignment.task_id) || !ROLES.has(assignment.role)) {
      errors.push("Assignment must name a task_id and supported role.");
      continue;
    }
    if (assignment.role === "executor") {
      const count = (executorByTask.get(assignment.task_id) ?? 0) + 1;
      executorByTask.set(assignment.task_id, count);
      if (count > 1) errors.push(`Task ${assignment.task_id} has more than one active single write-capable executor.`);
      if (!Array.isArray(assignment.owned_areas) || assignment.owned_areas.length === 0) errors.push(`Executor assignment ${assignment.task_id} must declare owned_areas.`);
      if (assignment.isolated_execution !== true) errors.push(`Executor assignment ${assignment.task_id} must confirm isolated_execution.`);
      executorAssignments.set(assignment.task_id, assignment);
    }
    if (assignment.role === "monitor" && (profiles.monitor?.write_capable || assignment.write_capable === true || assignment.approval_capable === true || assignment.remediation_capable === true)) errors.push("Monitor assignment cannot write, approve, or remediate.");
    if (["test_verifier", "reviewer"].includes(assignment.role) && assignment.write_capable === true) errors.push(`${assignment.role} assignment must be read-only.`);
  }
  for (const [taskId, assignment] of executorAssignments) {
    for (const parallelTask of assignment.parallel_with ?? []) {
      const other = executorAssignments.get(parallelTask);
      if (!other) errors.push(`Executor assignment ${taskId} declares unknown parallel task ${parallelTask}.`);
      if (assignment.dependency_task_ids?.includes(parallelTask) || other?.dependency_task_ids?.includes(taskId)) errors.push(`Executor assignments ${taskId} and ${parallelTask} cannot run in parallel because they are dependent.`);
    }
  }
  return errors;
}

export function validatePolicyAction(action, catalog) {
  const errors = [];
  const policy = catalog?.policy;
  if (!isObject(action)) return ["Policy action must be an object."];
  if (!nonEmpty(action.command_id) || !policy?.command_ids?.includes(action.command_id)) errors.push("Policy action uses an unknown command_id.");
  if (!ROLES.has(action.role)) errors.push("Policy action uses an unsupported role.");
  if (!MODES.has(action.mode)) errors.push("Policy action uses an unsupported mode.");
  if (policy?.approval_required_modes?.includes(action.mode) && action.approved !== true) errors.push("Policy action requires approved change state.");
  for (const path of action.paths ?? []) {
    if (!nonEmpty(path)) errors.push("Policy action contains an invalid path.");
    if (policy?.prohibited_path_prefixes?.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}\\`))) errors.push(`Policy action targets prohibited path: ${path}.`);
  }
  if (action.role !== "executor" && action.write_capable === true) errors.push("Only executor actions may be write-capable.");
  return errors;
}

export function buildContextPackage({ feature, mode, strategy, state, task, catalog, assignments, generated_at = new Date().toISOString() }) {
  const reasons = [...validateRuntimeCatalog(catalog), ...validateAssignmentPlan(assignments, catalog)];
  if (!nonEmpty(feature)) reasons.push("Context package requires feature.");
  if (!MODES.has(mode)) reasons.push("Context package requires a valid mode.");
  if (!nonEmpty(strategy)) reasons.push("Context package requires strategy.");
  if (!isObject(state) || state.status !== "approved") reasons.push("Context package requires an approved change state.");
  if (!isObject(task) || !nonEmpty(task.id) || !Array.isArray(task.criteria) || task.criteria.length === 0) reasons.push("Context package requires a task with linked acceptance criteria.");
  if (!isIsoTimestamp(generated_at)) reasons.push("Context package requires generated_at timestamp.");
  const assignment = Array.isArray(assignments) ? assignments.find((candidate) => candidate.task_id === task?.id && candidate.role === "executor") : null;
  if (!assignment) reasons.push("Context package requires an executor assignment for the task.");
  return {
    schema: "osd-runtime-context/v1",
    contract_version: catalog?.version ?? "",
    feature,
    mode,
    strategy,
    stage: state?.stage ?? "",
    state_path: state?.path ?? "openspec/changes/{feature}/osd-state.json",
    specification_path: state?.specification ?? "",
    task_id: task?.id ?? "",
    acceptance_criteria: task?.criteria ?? [],
    dependencies: task?.dependencies ?? [],
    affected_areas: task?.affected_areas ?? [],
    verification_method: task?.verification ?? "",
    policy_version: catalog?.version ?? "",
    resource_ids: (catalog?.resources ?? []).map((resource) => resource.id),
    assignments: assignments ?? [],
    status: reasons.length === 0 ? "runnable" : "blocked",
    reasons,
    generated_at,
  };
}

export function validateContextPackage(context, { feature, mode, strategy, taskId, criteria, catalog } = {}) {
  const errors = [];
  if (!isObject(context)) return ["Runtime context package must be an object."];
  if (context.schema !== "osd-runtime-context/v1") errors.push("Runtime context package has unsupported schema.");
  if (context.status !== "runnable") errors.push("Runtime context package is not runnable.");
  if (!nonEmpty(context.contract_version) || context.contract_version !== catalog?.version) errors.push("Runtime context package contract_version does not match the runtime catalog.");
  if (feature && context.feature !== feature) errors.push("Runtime context package feature does not match the delivery.");
  if (mode && context.mode !== mode) errors.push("Runtime context package mode does not match the delivery.");
  if (strategy && context.strategy !== strategy) errors.push("Runtime context package strategy does not match the delivery.");
  if (taskId && context.task_id !== taskId) errors.push("Runtime context package task_id does not match the task plan.");
  if (!isIsoTimestamp(context.generated_at)) errors.push("Runtime context package has invalid generated_at timestamp.");
  if (!Array.isArray(context.acceptance_criteria) || context.acceptance_criteria.length === 0) errors.push("Runtime context package must include linked acceptance criteria.");
  for (const criterion of context.acceptance_criteria ?? []) if (criteria && !criteria.has(criterion)) errors.push(`Runtime context package references undefined acceptance criterion ${criterion}.`);
  errors.push(...validateAssignmentPlan(context.assignments, catalog));
  if (!context.assignments?.some((assignment) => assignment.task_id === context.task_id && assignment.role === "executor")) errors.push("Runtime context package requires an executor assignment for its task.");
  return errors;
}

export function validateRunEvent(event) {
  const errors = [];
  if (!isObject(event)) return ["Run event must be an object."];
  if (event.schema !== "osd-run-event/v1") errors.push("Run event has unsupported schema.");
  for (const field of ["run_id", "feature", "stage", "actor_role", "event_type", "status", "contract_version"]) if (!nonEmpty(event[field])) errors.push(`Run event is missing ${field}.`);
  if (!isIsoTimestamp(event.timestamp)) errors.push("Run event has invalid timestamp.");
  if (event.task_id !== undefined && !nonEmpty(event.task_id)) errors.push("Run event task_id must be non-empty when provided.");
  if (event.duration_ms !== undefined && (!Number.isInteger(event.duration_ms) || event.duration_ms < 0)) errors.push("Run event duration_ms must be a non-negative integer.");
  if (event.retry_count !== undefined && (!Number.isInteger(event.retry_count) || event.retry_count < 0)) errors.push("Run event retry_count must be a non-negative integer.");
  if (sensitiveKey(event)) errors.push("Run event contains sensitive prompt, source, credential, or raw tool payload data.");
  return errors;
}

export function summarizeRunEvents(events) {
  const completed = events.filter((event) => event.status === "completed");
  const blocked = events.filter((event) => event.status === "blocked");
  // Monitoring is observational. Its alert/retry metadata must not inflate the
  // execution metrics that describe work performed by delivery roles.
  const executionEvents = events.filter((event) => event.actor_role !== "monitor");
  const verification = events.some((event) => event.actor_role === "test_verifier" && event.status === "completed") ? "completed" : "not_run";
  const evaluation = events.some((event) => event.event_type === "evaluation_completed" && event.status === "completed") ? "completed" : "not_run";
  return {
    schema: "osd-runtime-summary/v1",
    run_count: events.length,
    completed_count: completed.length,
    blocked_count: blocked.length,
    total_duration_ms: executionEvents.reduce((total, event) => total + (event.duration_ms ?? 0), 0),
    total_retries: executionEvents.reduce((total, event) => total + (event.retry_count ?? 0), 0),
    verification_outcome: verification,
    evaluation_outcome: evaluation,
  };
}

export function validateEvaluationRecord(evaluation, criteria = new Set()) {
  const errors = [];
  if (!isObject(evaluation)) return ["Evaluation record must be an object."];
  if (evaluation.schema !== "osd-evaluation/v1") errors.push("Evaluation record has unsupported schema.");
  for (const field of ["feature", "context_package_version", "policy_version"]) if (!nonEmpty(evaluation[field])) errors.push(`Evaluation record is missing ${field}.`);
  if (!Array.isArray(evaluation.deterministic_checks) || evaluation.deterministic_checks.length === 0) {
    errors.push("Evaluation record requires deterministic checks.");
  } else {
    const covered = new Set();
    for (const check of evaluation.deterministic_checks) {
      if (!isObject(check) || !nonEmpty(check.command_id)) errors.push("Deterministic evaluation check is missing command_id.");
      if (!Number.isInteger(check?.exit_code)) errors.push("Deterministic evaluation check has invalid exit_code.");
      if (check?.exit_code !== 0) errors.push("Deterministic evaluation check failed.");
      if (!Array.isArray(check?.covered_acceptance_criteria)) errors.push("Deterministic evaluation check is missing covered_acceptance_criteria.");
      for (const criterion of check?.covered_acceptance_criteria ?? []) covered.add(criterion);
    }
    for (const criterion of criteria) if (!covered.has(criterion)) errors.push(`Evaluation has no deterministic evidence for ${criterion}.`);
  }
  if (!Array.isArray(evaluation.optional_graders)) errors.push("Evaluation record must define optional_graders.");
  for (const grader of evaluation.optional_graders ?? []) {
    if (!isObject(grader) || !nonEmpty(grader.evaluator) || !nonEmpty(grader.rubric_version)) errors.push("Optional grader requires evaluator and rubric_version.");
    if (!["pass", "fail", "not_run"].includes(grader?.status)) errors.push("Optional grader has invalid status.");
  }
  if (sensitiveKey(evaluation)) errors.push("Evaluation record contains sensitive prompt, source, credential, or raw tool payload data.");
  return errors;
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith("--")) throw new Error(`Unknown argument: ${key}`);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

function runtimePaths(target, feature, manifest) {
  const config = manifest.runtime_governance;
  const resolveTemplate = (template) => resolve(target, template.replaceAll("{feature}", feature));
  return {
    catalog: resolve(target, config.catalog_file),
    state: resolve(target, `openspec/changes/${feature}/osd-state.json`),
    tasks: resolve(target, `openspec/changes/${feature}/tasks.md`),
    contextDirectory: resolveTemplate(config.context_directory),
    events: resolveTemplate(config.run_events_file),
    evaluation: resolveTemplate(config.evaluation_file),
    summary: resolveTemplate(config.summary_file),
  };
}

function loadContextInputs(target, feature, taskId) {
  const manifest = json(join(target, ".ai", "workflow-manifest.json"));
  const paths = runtimePaths(target, feature, manifest);
  const state = json(paths.state);
  const task = taskFromPlan(paths.tasks, taskId);
  const catalog = json(paths.catalog);
  return { manifest, paths, state, task, catalog };
}

function main(argv = process.argv.slice(2)) {
  const { command, options } = parseCli(argv);
  const target = resolve(options.target ?? process.cwd());
  if (command === "context") {
    if (!nonEmpty(options.feature) || !nonEmpty(options.task)) throw new Error("context requires --feature and --task.");
    const { paths, state, task, catalog } = loadContextInputs(target, options.feature, options.task);
    const assignment = { task_id: options.task, role: options.role ?? "executor", owned_areas: options["owned-area"] ? [options["owned-area"]] : [], isolated_execution: options.isolated === "true" };
    const context = buildContextPackage({ feature: options.feature, mode: state.mode, strategy: state.strategy, state, task, catalog, assignments: [assignment] });
    mkdirSync(paths.contextDirectory, { recursive: true });
    const output = join(paths.contextDirectory, `${options.task}.json`);
    writeFileSync(output, `${JSON.stringify(context, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: safeWithin(target, output) ? relative(target, output) : output, status: context.status, reasons: context.reasons }, null, 2));
    return context.status === "runnable" ? 0 : 1;
  }
  if (command === "record-event") {
    if (!nonEmpty(options.feature) || !nonEmpty(options.event)) throw new Error("record-event requires --feature and --event JSON.");
    const manifest = json(join(target, ".ai", "workflow-manifest.json"));
    const paths = runtimePaths(target, options.feature, manifest);
    const event = JSON.parse(options.event);
    const errors = validateRunEvent(event);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    mkdirSync(dirname(paths.events), { recursive: true });
    appendFileSync(paths.events, `${JSON.stringify(event)}\n`, "utf8");
    console.log(JSON.stringify({ output: relative(target, paths.events), status: "recorded" }, null, 2));
    return 0;
  }
  if (command === "summarize") {
    if (!nonEmpty(options.feature)) throw new Error("summarize requires --feature.");
    const manifest = json(join(target, ".ai", "workflow-manifest.json"));
    const paths = runtimePaths(target, options.feature, manifest);
    const events = existsSync(paths.events) ? readFileSync(paths.events, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
    const errors = events.flatMap(validateRunEvent);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    const summary = summarizeRunEvents(events);
    mkdirSync(dirname(paths.summary), { recursive: true });
    writeFileSync(paths.summary, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: relative(target, paths.summary), summary }, null, 2));
    return 0;
  }
  throw new Error("Usage: runtime-governance.mjs context|record-event|summarize [options]");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
