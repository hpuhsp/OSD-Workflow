#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  summarizeRunEvents,
  validateContextPackage,
  validateEvaluationRecord,
  validateRunEvent,
  validateRuntimeCatalog,
} from "./runtime-governance.mjs";
import { validateDocument } from "./contract-schema.mjs";

const VALID_MODES = new Set(["lite", "standard", "strict"]);
const VALID_STRATEGIES = new Set(["tdd", "test_first", "verification_only"]);
const SUPPORTED_MANIFEST_SCHEMAS = new Set(["osd-workflow-manifest/v3", "osd-workflow-manifest/v4", "osd-workflow-manifest/v5"]);
const CURRENT_MANIFEST_SCHEMA = "osd-workflow-manifest/v5";
const VALID_STATE_STAGES = new Set(["specification", "approval", "planning", "implementation", "verification", "review", "archive", "complete"]);
const VALID_STATE_STATUSES = new Set(["draft", "proposed", "approved", "in_progress", "verified", "reviewed", "archived", "blocked", "complete"]);
const VALID_APPROVAL_DECISIONS = new Set(["approved", "rejected", "changes_requested"]);
const VALID_TASK_STATUSES = new Set(["todo", "in_progress", "done", "blocked"]);
const ACCEPTANCE_ID = /AC-[0-9]+/g;
const TASK_ID = /T-[0-9]+/g;
const MANAGED_ENTRY_START = "<!-- osd-workflow:start -->";
const MANAGED_ENTRY_END = "<!-- osd-workflow:end -->";
const REQUIRED_STARTUP_SEQUENCE = [
  "load_osd_contract",
  "classify_task",
  "select_mode",
  "select_development_strategy",
  "announce_osd_route",
  "execute_current_osd_stage",
];

export function parseArgs(argv) {
  const options = {
    target: process.cwd(),
    feature: "",
    mode: "",
    handoff: false,
    trustedEvidence: false,
    structuralOnly: false,
    json: false,
    help: false,
  };

  const valueFor = (arg, index) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value.`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") {
      options.target = valueFor(arg, index);
      index += 1;
    } else if (arg === "--feature") {
      options.feature = valueFor(arg, index);
      index += 1;
    } else if (arg === "--mode") {
      options.mode = valueFor(arg, index);
      index += 1;
    } else if (arg === "--handoff") {
      options.handoff = true;
    } else if (arg === "--require-trusted-evidence") {
      options.trustedEvidence = true;
    } else if (arg === "--structural-only") {
      options.structuralOnly = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.mode && !VALID_MODES.has(options.mode)) {
    throw new Error(`Invalid mode: ${options.mode}. Expected lite, standard, or strict.`);
  }
  if (!options.help && !options.structuralOnly && !options.feature) {
    throw new Error("--feature is required for delivery verification. Use --structural-only for contract checks.");
  }
  if (options.feature && !isSafeFeatureName(options.feature)) {
    throw new Error("--feature must be a single safe directory name without path separators.");
  }

  return options;
}

function printHelp() {
  console.log(`OSD lightweight SDD artifact verifier

Usage:
  node scripts/verify-workflow-artifacts.mjs --feature <feature> [--mode <mode>] [options]
  node scripts/verify-workflow-artifacts.mjs --structural-only [options]

Options:
  --target <project>   Project directory. Defaults to current directory.
  --feature <feature>  Feature directory name to verify.
  --mode <mode>        lite, standard, or strict. Inferred from stage-report when omitted.
  --handoff            Also require handoff-brief.md.
  --require-trusted-evidence  Require runner-generated provenance for structured evidence.
  --structural-only    Validate the workflow contract without checking a delivery.
  --json               Print a machine-readable result.
  -h, --help           Show this help message.
`);
}

function isSafeFeatureName(feature) {
  return feature !== "." && feature !== ".." && !/[\\/]/.test(feature) && /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(feature);
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function nonEmptyFile(path) {
  return existsSync(path) && statSync(path).isFile() && readText(path).trim().length > 0;
}

function insideRoot(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

function resolveArtifact(root, template, feature) {
  const path = resolve(root, template.replaceAll("{feature}", feature));
  if (!insideRoot(root, path)) {
    throw new Error(`Artifact path escapes target root: ${template}`);
  }
  return path;
}

function loadManifest(root, errors) {
  const manifestPath = join(root, ".ai", "workflow-manifest.json");
  if (!nonEmptyFile(manifestPath)) {
    errors.push("Missing or empty workflow manifest: .ai/workflow-manifest.json");
    return null;
  }

  try {
    return JSON.parse(readText(manifestPath));
  } catch (error) {
    errors.push(`Invalid workflow manifest JSON: ${error.message}`);
    return null;
  }
}

function validateManifest(root, manifest, errors, warnings = []) {
  if (!SUPPORTED_MANIFEST_SCHEMAS.has(manifest.schema)) {
    errors.push(`Unsupported manifest schema: ${manifest.schema ?? "(missing)"}`);
  } else if (manifest.schema !== CURRENT_MANIFEST_SCHEMA) {
    warnings.push(`Legacy manifest schema requires migration before v5 runtime governance applies: ${manifest.schema}`);
  }
  if (!VALID_MODES.has(manifest.default_mode)) {
    errors.push("Manifest default_mode must be lite, standard, or strict.");
  }

  const orchestration = manifest.orchestration;
  if (orchestration?.controller !== "osd_workflow") {
    errors.push("Manifest orchestration controller must be osd_workflow.");
  }
  if (orchestration?.specification_authority !== "openspec") {
    errors.push("Manifest specification authority must be openspec.");
  }
  if (orchestration?.execution_method !== "superpowers") {
    errors.push("Manifest execution method must be superpowers.");
  }
  if (orchestration?.external_methods_may_reorder_stages !== false) {
    errors.push("Manifest must prohibit external methods from reordering OSD stages.");
  }
  if (manifest.sdd_required?.[0] !== "osd_orchestration") {
    errors.push("Manifest sdd_required must place osd_orchestration first.");
  }
  if (JSON.stringify(orchestration?.startup_sequence) !== JSON.stringify(REQUIRED_STARTUP_SEQUENCE)) {
    errors.push("Manifest startup_sequence must load and announce the OSD route before stage execution.");
  }

  const discovery = manifest.discovery;
  if (!discovery || !Array.isArray(discovery.managed_entry_files) || discovery.managed_entry_files.length === 0) {
    errors.push("Manifest agent discovery entries are missing.");
  }
  if (discovery?.entry_template !== ".ai/templates/agent-entry.md") {
    errors.push("Manifest agent discovery template must be .ai/templates/agent-entry.md.");
  }
  validateDiscoveryEntries(root, discovery, errors);

  const delegation = manifest.delegation;
  const requiredOwners = {
    routing: "osd_workflow",
    specification: "openspec",
    planning: "superpowers",
    implementation: "superpowers",
    verification: "superpowers",
    review: "superpowers",
    archive: "openspec",
  };
  for (const [stage, owner] of Object.entries(requiredOwners)) {
    if (delegation?.[stage]?.owner !== owner) {
      errors.push(`Manifest delegation owner for ${stage} must be ${owner}.`);
    }
  }
  if (!manifest.modes || typeof manifest.modes !== "object") {
    errors.push("Manifest modes are missing.");
    return;
  }

  for (const strategy of VALID_STRATEGIES) {
    const config = manifest.development_strategies?.[strategy];
    if (!config || !Array.isArray(config.required_evidence)) {
      errors.push(`Manifest development strategy is missing or invalid: ${strategy}`);
    }
  }
  for (const [taskType, config] of Object.entries(manifest.task_types ?? {})) {
    if (!VALID_STRATEGIES.has(config.default_strategy)) {
      errors.push(`Task type has invalid default_strategy: ${taskType}`);
    }
  }

  const references = new Set([manifest.workflow, manifest.execution_rule, ...(manifest.references ?? [])]);
  for (const reference of references) {
    if (typeof reference !== "string" || !nonEmptyFile(resolve(root, reference))) {
      errors.push(`Missing or empty referenced workflow file: ${reference}`);
    }
  }

  const contractSchemas = manifest.contract_schemas;
  for (const name of ["runtime_context", "run_event", "evaluation", "verification_evidence"]) {
    const schemaPath = contractSchemas?.[name];
    if (typeof schemaPath !== "string" || !nonEmptyFile(resolve(root, schemaPath))) {
      errors.push(`Manifest contract_schemas is missing ${name}.`);
      continue;
    }
    const schema = readJsonArtifact(resolve(root, schemaPath), errors, `Contract schema ${name}`);
    if (schema && (schema.$schema !== "https://json-schema.org/draft/2020-12/schema" || typeof schema.$id !== "string")) errors.push(`Contract schema ${name} is not a versioned JSON Schema.`);
  }

  for (const mode of VALID_MODES) {
    const config = manifest.modes[mode];
    if (!config || !Array.isArray(config.required_outputs) || config.required_outputs.length === 0) {
      errors.push(`Manifest mode has no required_outputs: ${mode}`);
      continue;
    }
    if (new Set(config.required_outputs).size !== config.required_outputs.length) {
      errors.push(`Manifest mode contains duplicate required_outputs: ${mode}`);
    }
    for (const output of config.required_outputs) {
      if (typeof output !== "string" || !output.includes("{feature}")) {
        errors.push(`Invalid required output template for ${mode}: ${output}`);
      }
    }
    if (config.stages.includes("intake")) {
      errors.push(`Manifest intake must be conditional, not fixed in mode stages: ${mode}`);
    }
  }

  if (manifest.conditional_stages?.intake?.before !== "specification") {
    errors.push("Manifest conditional intake stage must run before specification.");
  }

  if (manifest.schema === CURRENT_MANIFEST_SCHEMA) {
    const governance = manifest.governance;
    const requiredGovernance = [
      "state_file",
      "approval_file",
      "task_file",
      "verification_file",
      "archive_result_file",
      "acceptance_criterion_pattern",
      "task_pattern",
    ];
    for (const field of requiredGovernance) {
      if (typeof governance?.[field] !== "string" || governance[field].trim() === "") {
        errors.push(`Manifest governance is missing ${field}.`);
      }
    }
    if (!Array.isArray(governance?.approval_required_modes) || !governance.approval_required_modes.includes("standard") || !governance.approval_required_modes.includes("strict")) {
      errors.push("Manifest governance approval_required_modes must include standard and strict.");
    }
    if (!Array.isArray(governance?.structured_evidence_required_modes) || !governance.structured_evidence_required_modes.includes("standard") || !governance.structured_evidence_required_modes.includes("strict")) {
      errors.push("Manifest governance structured_evidence_required_modes must include standard and strict.");
    }
    if (!Array.isArray(governance?.archive_required_modes) || !governance.archive_required_modes.includes("strict")) {
      errors.push("Manifest governance archive_required_modes must include strict.");
    }
    for (const mode of governance?.approval_required_modes ?? []) {
      const requiredOutputs = manifest.modes?.[mode]?.required_outputs ?? [];
      for (const artifact of [governance.approval_file, governance.state_file, governance.task_file, governance.verification_file]) {
        if (!requiredOutputs.includes(artifact)) errors.push(`Manifest mode ${mode} must require governance artifact ${artifact}.`);
      }
    }
    for (const mode of governance?.archive_required_modes ?? []) {
      if (!(manifest.modes?.[mode]?.required_outputs ?? []).includes(governance.archive_result_file)) errors.push(`Manifest mode ${mode} must require governance archive result.`);
    }

    const runtime = manifest.runtime_governance;
    const requiredRuntime = ["contract_version", "catalog_file", "context_directory", "run_events_file", "evaluation_file", "summary_file"];
    if (runtime?.enabled !== true) errors.push("Manifest runtime_governance must be enabled for v5.");
    for (const field of requiredRuntime) {
      if (typeof runtime?.[field] !== "string" || runtime[field].trim() === "") errors.push(`Manifest runtime_governance is missing ${field}.`);
    }
    if (runtime?.contract_version !== "osd-runtime-governance/v1") errors.push("Manifest runtime_governance has an unsupported contract_version.");
    if (!Array.isArray(runtime?.required_modes) || !runtime.required_modes.includes("standard") || !runtime.required_modes.includes("strict")) errors.push("Manifest runtime_governance required_modes must include standard and strict.");
    for (const [mode, roles] of Object.entries(runtime?.required_roles_by_mode ?? {})) {
      if (!VALID_MODES.has(mode) || !Array.isArray(roles) || !roles.includes("executor")) errors.push(`Manifest runtime_governance has invalid role requirements for ${mode}.`);
    }
    for (const role of ["executor", "test_verifier", "reviewer", "monitor"]) {
      if (!runtime?.required_roles_by_mode?.strict?.includes(role)) errors.push(`Manifest strict runtime_governance must require ${role}.`);
    }
    const catalogPath = typeof runtime?.catalog_file === "string" ? resolve(root, runtime.catalog_file) : null;
    if (!catalogPath || !nonEmptyFile(catalogPath)) {
      errors.push("Missing or empty runtime governance catalog.");
    } else {
      const catalog = readJsonArtifact(catalogPath, errors, "Runtime governance catalog");
      if (catalog) errors.push(...validateRuntimeCatalog(catalog).map((error) => `Runtime governance catalog: ${error}`));
    }
  }
}

function validateDiscoveryEntries(root, discovery, errors) {
  if (!discovery || !Array.isArray(discovery.managed_entry_files)) {
    return;
  }

  const sourceMarker = discovery.template_source_marker;
  if (typeof sourceMarker === "string" && nonEmptyFile(resolve(root, sourceMarker))) {
    return;
  }

  for (const entry of discovery.managed_entry_files) {
    if (typeof entry !== "string") {
      errors.push("Manifest contains an invalid managed agent entry path.");
      continue;
    }
    const entryPath = resolve(root, entry);
    if (!nonEmptyFile(entryPath)) {
      errors.push(`Missing or empty managed agent entry: ${entry}`);
      continue;
    }
    const content = readText(entryPath);
    const starts = content.split(MANAGED_ENTRY_START).length - 1;
    const ends = content.split(MANAGED_ENTRY_END).length - 1;
    if (starts !== 1 || ends !== 1) {
      errors.push(`Managed agent entry must contain exactly one complete OSD block: ${entry}`);
    }
    if (!content.includes("OSD Workflow as the top-level controller")) {
      errors.push(`Managed agent entry does not declare OSD control: ${entry}`);
    }
    if (entry.endsWith(".mdc") && !/^alwaysApply:\s*true\s*$/im.test(content)) {
      errors.push(`Cursor OSD rule must set alwaysApply: true: ${entry}`);
    }
  }
}

function inferMode(root, feature, manifest) {
  const report = join(root, "knowledge", "archive", feature, "stage-report.md");
  if (nonEmptyFile(report)) {
    const match = readText(report).match(/^\s*-\s*Mode:\s*(lite|standard|strict)\s*$/im);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return manifest.default_mode;
}

function validateContent(path, errors) {
  const name = basename(path).toLowerCase();
  const text = readText(path);

  if (name === "spec.md" && !/(acceptance criteria|验收标准)/i.test(text)) {
    errors.push(`Specification has no Acceptance Criteria section: ${path}`);
  }
  if (name === "test-report.md" && !/(result|结果|pass|fail|通过|失败)/i.test(text)) {
    errors.push(`Verification report has no result evidence: ${path}`);
  }
  if (name === "review-report.md" && !/(result|结论|findings|发现|pass|fail|通过|失败)/i.test(text)) {
    errors.push(`Review report has no findings or result: ${path}`);
  }
}

function readJsonArtifact(path, errors, label) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${path} (${error.message})`);
    return null;
  }
}

function nonEmptyField(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueMatches(text, pattern) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0]))];
}

function definedAcceptanceCriteria(specPath, errors) {
  const text = readText(specPath);
  const ids = [...new Set([...text.matchAll(/^\s*(?:[-*]\s*)?(?:\*\*)?(AC-[0-9]+)(?:\*\*)?\s*[:.)-]/gm)].map((match) => match[1]))];
  if (ids.length === 0) errors.push(`Specification has no uniquely identified acceptance criteria: ${specPath}`);
  return ids;
}

function validateState(path, feature, mode, strategy, errors, requireFinalState) {
  const state = readJsonArtifact(path, errors, "OSD state");
  if (!state) return null;
  if (state.schema !== "osd-change-state/v1") errors.push(`OSD state has unsupported schema: ${path}`);
  if (state.feature !== feature) errors.push(`OSD state feature does not match ${feature}: ${path}`);
  if (state.mode !== mode) errors.push(`OSD state mode does not match ${mode}: ${path}`);
  if (state.strategy !== strategy) errors.push(`OSD state strategy does not match ${strategy}: ${path}`);
  if (!VALID_STATE_STAGES.has(state.stage)) errors.push(`OSD state has invalid stage: ${path}`);
  if (!VALID_STATE_STATUSES.has(state.status)) errors.push(`OSD state has invalid status: ${path}`);
  if (!nonEmptyField(state.specification)) errors.push(`OSD state must name the specification: ${path}`);
  if (!nonEmptyField(state.updated_at) || Number.isNaN(Date.parse(state.updated_at))) errors.push(`OSD state updated_at must be an ISO-8601 timestamp: ${path}`);
  if (requireFinalState) {
    const allowed = mode === "strict" ? new Set(["archived", "complete"]) : new Set(["verified", "reviewed", "complete"]);
    if (!allowed.has(state.status)) errors.push(`OSD state is not final for a passing ${mode} delivery: ${path}`);
  }
  return state;
}

function validateApproval(path, errors) {
  const text = readText(path);
  const decision = text.match(/^\s*-\s*Decision:\s*(approved|rejected|changes_requested)\s*$/im)?.[1];
  if (!VALID_APPROVAL_DECISIONS.has(decision)) errors.push(`Approval has no valid decision: ${path}`);
  for (const field of ["Reviewer", "Decision timestamp", "Reviewed proposal", "Reviewed specification", "Scope notes", "Residual risks"]) {
    const pattern = new RegExp(`^\\s*-\\s*${field}:\\s*(?!$).+`, "im");
    if (!pattern.test(text)) errors.push(`Approval is missing ${field}: ${path}`);
  }
  const timestamp = text.match(/^\s*-\s*Decision timestamp:\s*(.+)$/im)?.[1];
  if (timestamp && Number.isNaN(Date.parse(timestamp.trim()))) errors.push(`Approval timestamp is not ISO-8601: ${path}`);
  return decision;
}

function validateTasks(path, criteria, errors) {
  const lines = readText(path).split(/\r?\n/).filter((line) => /^\s*[-*]\s*T-[0-9]+\s*:/i.test(line));
  if (lines.length === 0) {
    errors.push(`Task plan has no atomic tasks: ${path}`);
    return { ids: new Set(), covered: new Set() };
  }
  const ids = new Set();
  const covered = new Set();
  const dependencies = new Map();
  for (const line of lines) {
    const id = line.match(/\bT-[0-9]+\b/i)?.[0];
    if (!id) continue;
    if (ids.has(id)) errors.push(`Task plan contains duplicate task ID ${id}: ${path}`);
    ids.add(id);
    const refs = uniqueMatches(line, /AC-[0-9]+/g);
    for (const ref of refs) {
      covered.add(ref);
      if (!criteria.has(ref)) errors.push(`Task ${id} references undefined acceptance criterion ${ref}: ${path}`);
    }
    const status = line.match(/\bStatus:\s*(todo|in_progress|done|blocked)\b/i)?.[1]?.toLowerCase();
    if (!VALID_TASK_STATUSES.has(status)) errors.push(`Task ${id} has no valid status: ${path}`);
    const depText = line.match(/\bDependencies:\s*([^.]*)/i)?.[1] ?? "";
    dependencies.set(id, uniqueMatches(depText, /T-[0-9]+/g));
    if (!/\bVerification:\s*\S+/i.test(line)) errors.push(`Task ${id} is missing a verification method: ${path}`);
  }
  for (const criterion of criteria) if (!covered.has(criterion)) errors.push(`Acceptance criterion ${criterion} is not covered by a task: ${path}`);
  for (const [id, deps] of dependencies) for (const dependency of deps) if (!ids.has(dependency)) errors.push(`Task ${id} depends on unknown task ${dependency}: ${path}`);
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const cycle = (dependencies.get(id) ?? []).some((dependency) => ids.has(dependency) && visit(dependency));
    visiting.delete(id);
    visited.add(id);
    return cycle;
  };
  for (const id of ids) if (visit(id)) errors.push(`Task plan contains a dependency cycle: ${path}`);
  return { ids, covered };
}

function validateVerification(path, strategy, criteria, errors, requireTrustedEvidence) {
  const evidence = readJsonArtifact(path, errors, "Verification evidence");
  if (!evidence) return null;
  errors.push(...validateDocument("osd-verification-evidence-v1.schema.json", evidence).map((error) => `Verification evidence ${error}`));
  if (evidence.schema !== "osd-verification-evidence/v1") errors.push(`Verification evidence has unsupported schema: ${path}`);
  if (evidence.strategy !== strategy) errors.push(`Verification evidence strategy does not match ${strategy}: ${path}`);
  if (!Array.isArray(evidence.steps) || evidence.steps.length === 0) {
    errors.push(`Verification evidence has no steps: ${path}`);
    return evidence;
  }
  const names = new Set(evidence.steps.map((step) => step?.step));
  const has = (...values) => values.some((value) => names.has(value));
  const required = strategy === "tdd" ? [["red"], ["green"], ["refactor"]] : strategy === "test_first" ? [["failing_before", "red"], ["passing_after", "green"]] : [["focused"]];
  for (const alternatives of required) if (!has(...alternatives)) errors.push(`Verification evidence is missing ${alternatives.join(" or ")}: ${path}`);
  const covered = new Set();
  for (const step of evidence.steps) {
    if (!step || typeof step !== "object") {
      errors.push(`Verification evidence contains a non-object step: ${path}`);
      continue;
    }
    if (!nonEmptyField(step.command_id)) errors.push(`Verification evidence step is missing command_id: ${path}`);
    if (!Number.isInteger(step.exit_code)) errors.push(`Verification evidence step has an invalid exit_code: ${path}`);
    if (!nonEmptyField(step.observed_at) || Number.isNaN(Date.parse(step.observed_at))) errors.push(`Verification evidence step has an invalid observed_at: ${path}`);
    if (!Array.isArray(step.covered_acceptance_criteria)) errors.push(`Verification evidence step is missing covered_acceptance_criteria: ${path}`);
    for (const criterion of step.covered_acceptance_criteria ?? []) {
      covered.add(criterion);
      if (!criteria.has(criterion)) errors.push(`Verification evidence references undefined acceptance criterion ${criterion}: ${path}`);
    }
    if ((step.step === "red" || step.step === "failing_before") && step.exit_code === 0) errors.push(`Verification evidence ${step.step} step must fail with a non-zero exit code: ${path}`);
    if (["green", "refactor", "passing_after", "focused"].includes(step.step) && step.exit_code !== 0) errors.push(`Verification evidence ${step.step} step must pass with exit code 0: ${path}`);
    if (requireTrustedEvidence && (!step.provenance || step.provenance.schema !== "osd-command-attestation/v1" || step.provenance.runner !== "osd-verified-command")) errors.push(`Verification evidence step lacks trusted runner provenance: ${path}`);
  }
  for (const criterion of criteria) if (!covered.has(criterion)) errors.push(`Acceptance criterion ${criterion} has no verification evidence: ${path}`);
  return evidence;
}

function validateArchiveResult(path, errors) {
  const archive = readJsonArtifact(path, errors, "Archive result");
  if (!archive) return null;
  if (archive.schema !== "osd-archive-result/v1") errors.push(`Archive result has unsupported schema: ${path}`);
  if (archive.status !== "archived") errors.push(`Archive result is not archived: ${path}`);
  if (archive.exit_code !== 0) errors.push(`Archive result must have exit_code 0: ${path}`);
  for (const field of ["native_command", "archived_change_location", "completed_at", "summary"]) if (!nonEmptyField(archive[field])) errors.push(`Archive result is missing ${field}: ${path}`);
  if (!nonEmptyField(archive.completed_at) || Number.isNaN(Date.parse(archive.completed_at))) errors.push(`Archive result completed_at must be ISO-8601: ${path}`);
  if (!["not_required", "passed"].includes(archive.knowledge_sync)) errors.push(`Archive result knowledge_sync must be not_required or passed: ${path}`);
  return archive;
}

function readJsonLines(path, errors, label) {
  const records = [];
  for (const [index, line] of readText(path).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      errors.push(`${label} line ${index + 1} is not valid JSON: ${path} (${error.message})`);
    }
  }
  return records;
}

function sameSummary(expected, actual) {
  return Object.keys(expected).every((key) => expected[key] === actual?.[key]);
}

function validateRuntimeGovernance(root, manifest, feature, mode, strategy, criteria, taskIds, errors) {
  const runtime = manifest.runtime_governance;
  if (!runtime?.enabled || !runtime.required_modes?.includes(mode)) return;
  const resolveRuntime = (template) => resolveArtifact(root, template, feature);
  const catalogPath = resolve(root, runtime.catalog_file);
  const catalog = nonEmptyFile(catalogPath) ? readJsonArtifact(catalogPath, errors, "Runtime governance catalog") : null;
  if (!catalog) return;

  const contextDirectory = resolveRuntime(runtime.context_directory);
  for (const taskId of taskIds) {
    const contextPath = join(contextDirectory, `${taskId}.json`);
    if (!nonEmptyFile(contextPath)) {
      errors.push(`Missing or empty runtime context package for ${taskId}: ${relative(root, contextPath)}`);
      continue;
    }
    const context = readJsonArtifact(contextPath, errors, "Runtime context package");
    if (context) errors.push(...validateContextPackage(context, { feature, mode, strategy, taskId, criteria, catalog }).map((error) => `Runtime context ${taskId}: ${error}`));
  }

  const eventsPath = resolveRuntime(runtime.run_events_file);
  let events = [];
  if (!nonEmptyFile(eventsPath)) {
    errors.push(`Missing or empty runtime event log: ${relative(root, eventsPath)}`);
  } else {
    events = readJsonLines(eventsPath, errors, "Runtime event log");
    for (const event of events) {
      errors.push(...validateRunEvent(event).map((error) => `Runtime event: ${error}`));
      if (event?.feature !== feature) errors.push(`Runtime event feature does not match ${feature}: ${relative(root, eventsPath)}`);
      if (event?.contract_version !== catalog.version) errors.push(`Runtime event contract_version does not match runtime catalog: ${relative(root, eventsPath)}`);
    }
    for (const role of runtime.required_roles_by_mode?.[mode] ?? []) {
      if (!events.some((event) => event.actor_role === role && event.event_type === "role_completed" && event.status === "completed")) errors.push(`Runtime event log has no completed ${role} role evidence: ${relative(root, eventsPath)}`);
    }
  }

  const evaluationPath = resolveRuntime(runtime.evaluation_file);
  if (!nonEmptyFile(evaluationPath)) {
    errors.push(`Missing or empty runtime evaluation: ${relative(root, evaluationPath)}`);
  } else {
    const evaluation = readJsonArtifact(evaluationPath, errors, "Runtime evaluation");
    if (evaluation) {
      if (evaluation.feature !== feature) errors.push(`Runtime evaluation feature does not match ${feature}: ${relative(root, evaluationPath)}`);
      if (evaluation.context_package_version !== catalog.version || evaluation.policy_version !== catalog.version) errors.push(`Runtime evaluation version does not match runtime catalog: ${relative(root, evaluationPath)}`);
      errors.push(...validateEvaluationRecord(evaluation, criteria).map((error) => `Runtime evaluation: ${error}`));
    }
  }

  const summaryPath = resolveRuntime(runtime.summary_file);
  if (!nonEmptyFile(summaryPath)) {
    errors.push(`Missing or empty runtime summary: ${relative(root, summaryPath)}`);
  } else {
    const summary = readJsonArtifact(summaryPath, errors, "Runtime summary");
    if (summary && events.length > 0 && !sameSummary(summarizeRunEvents(events), summary)) errors.push(`Runtime summary does not match event log: ${relative(root, summaryPath)}`);
  }
}

function validateDeliveryRecord(path, mode, errors, governanceEnabled) {
  const text = readText(path);
  const strategyMatch = text.match(/^\s*-\s*Development strategy:\s*(tdd|test_first|verification_only)\s*$/im);
  const requiredPatterns = [
    ["task type", /^\s*-\s*Task type:\s*(?!new_feature\s*\|)(\S+)/im],
    ["mode", new RegExp(`^\\s*-\\s*Mode:\\s*${mode}\\s*$`, "im")],
    ["development strategy", /^\s*-\s*Development strategy:\s*(tdd|test_first|verification_only)\s*$/im],
    ["OSD controller", /^\s*-\s*OSD controller:\s*osd_workflow\s*$/im],
    ["OpenSpec participation", /^\s*-\s*OpenSpec participation:\s*(?!N\/A\s*$)(?!none\s*$)(?!\s*$).+/im],
    ["Superpowers participation", /^\s*-\s*Superpowers participation:\s*(?!N\/A\s*$)(?!none\s*$)(?!\s*$).+/im],
    ["specification", /^\s*-\s*Specification:\s*(?!\s*$).+/im],
    ["verification", /^\s*-\s*(Verification|Commands and exit codes):\s*(?!\s*$).+/im],
    ["result", /^\s*-\s*Result:\s*pass\s*$/im],
  ];

  if (governanceEnabled) {
    requiredPatterns.push(
      ["approval", /^\s*-\s*Approval:\s*(?!N\/A\s*$)(?!none\s*$)(?!\s*$).+/im],
      ["task traceability", /^\s*-\s*Task traceability:\s*(?!N\/A\s*$)(?!none\s*$)(?!\s*$).+/im],
      ["evidence", /^\s*-\s*(?:Evidence|Structured evidence):\s*(?!N\/A\s*$)(?!none\s*$)(?!\s*$).+/im],
    );
  }

  for (const [field, pattern] of requiredPatterns) {
    if (!pattern.test(text)) {
      errors.push(`Delivery record is missing a valid ${field}: ${path}`);
    }
  }

  if (!strategyMatch) {
    return;
  }

  const strategy = strategyMatch[1].toLowerCase();
  const evidencePattern = (label) => new RegExp(`^\\s*-\\s*${label}:\\s*(?!N/A\\s*$)(?!none\\s*$)(?!\\s*$).+`, "im");
  const strategyEvidence = {
    tdd: ["Red evidence", "Green evidence", "Refactor evidence"],
    test_first: ["Red evidence", "Green evidence"],
    verification_only: ["Strategy reason"],
  };

  for (const field of strategyEvidence[strategy]) {
    if (!evidencePattern(field).test(text)) {
      errors.push(`Delivery record is missing ${field} for ${strategy}: ${path}`);
    }
  }
}

export function verify(options) {
  const root = resolve(options.target);
  const errors = [];
  const warnings = [];
  const manifest = loadManifest(root, errors);

  if (!manifest) {
    return { root, mode: null, feature: options.feature || null, structuralOnly: options.structuralOnly, errors, warnings };
  }

  validateManifest(root, manifest, errors, warnings);
  if (options.structuralOnly) {
    return { root, mode: null, feature: null, structuralOnly: true, errors, warnings };
  }

  const mode = options.mode || inferMode(root, options.feature, manifest);
  if (!VALID_MODES.has(mode) || !manifest.modes[mode]) {
    errors.push(`Unable to select a valid mode: ${mode}`);
    return { root, mode, feature: options.feature, structuralOnly: false, errors, warnings };
  }

  const required = [...manifest.modes[mode].required_outputs];
  if (options.handoff) {
    required.push(manifest.conditional_outputs?.agent_handoff);
  }

  for (const template of required) {
    if (typeof template !== "string") {
      errors.push("Manifest is missing the conditional handoff output path.");
      continue;
    }
    const path = resolveArtifact(root, template, options.feature);
    if (!existsSync(path)) {
      errors.push(`Missing required output: ${relative(root, path)}`);
      continue;
    }
    if (!statSync(path).isFile()) {
      errors.push(`Required output is not a regular file: ${relative(root, path)}`);
      continue;
    }
    if (readText(path).trim().length === 0) {
      errors.push(`Required output is empty: ${relative(root, path)}`);
      continue;
    }
    validateContent(path, errors);
  }

  const reportPath = join(root, "knowledge", "archive", options.feature, "stage-report.md");
  const governanceEnabled = manifest.schema === CURRENT_MANIFEST_SCHEMA && ["standard", "strict"].includes(mode);
  if (nonEmptyFile(reportPath)) {
    validateDeliveryRecord(reportPath, mode, errors, governanceEnabled);
  }

  if (governanceEnabled) {
    const specPath = resolveArtifact(root, "openspec/changes/{feature}/spec.md", options.feature);
    const statePath = resolveArtifact(root, manifest.governance.state_file, options.feature);
    const approvalPath = resolveArtifact(root, manifest.governance.approval_file, options.feature);
    const taskPath = resolveArtifact(root, manifest.governance.task_file, options.feature);
    const verificationPath = resolveArtifact(root, manifest.governance.verification_file, options.feature);
    const reportText = nonEmptyFile(reportPath) ? readText(reportPath) : "";
    const strategy = reportText.match(/^\s*-\s*Development strategy:\s*(tdd|test_first|verification_only)\s*$/im)?.[1]?.toLowerCase();
    if (!strategy) errors.push(`Delivery record has no usable development strategy: ${reportPath}`);
    const criteria = existsSync(specPath) && statSync(specPath).isFile() ? new Set(definedAcceptanceCriteria(specPath, errors)) : new Set();
    const approval = existsSync(approvalPath) && statSync(approvalPath).isFile() ? validateApproval(approvalPath, errors) : null;
    if (approval !== "approved") errors.push(`Change must be approved before delivery verification: ${approvalPath}`);
    validateState(statePath, options.feature, mode, strategy, errors, /^\s*-\s*Result:\s*pass\s*$/im.test(reportText));
    const tasks = validateTasks(taskPath, criteria, errors);
    if (strategy) validateVerification(verificationPath, strategy, criteria, errors, options.trustedEvidence);
    if (strategy) validateRuntimeGovernance(root, manifest, options.feature, mode, strategy, criteria, tasks.ids, errors);
    if (mode === "strict") {
      const archivePath = resolveArtifact(root, manifest.governance.archive_result_file, options.feature);
      validateArchiveResult(archivePath, errors);
    }
  }

  return { root, mode, feature: options.feature, structuralOnly: false, errors, warnings };
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify({ ...result, ok: result.errors.length === 0 }, null, 2));
    return;
  }

  console.log("OSD lightweight SDD verification");
  console.log(`Target: ${result.root}`);
  console.log(`Scope: ${result.structuralOnly ? "structural-only" : `${result.feature} (${result.mode})`}`);
  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    result.warnings.forEach((warning) => console.log(`  - ${warning}`));
  }
  if (result.errors.length > 0) {
    console.error("\nErrors:");
    result.errors.forEach((error) => console.error(`  - ${error}`));
    console.error("\nResult: FAIL");
    return;
  }
  console.log(`\nResult: ${result.structuralOnly ? "STRUCTURAL PASS" : "DELIVERY PASS"}`);
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      printHelp();
      return 0;
    }
    const result = verify(options);
    printResult(result, options.json);
    return result.errors.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.exitCode = main();
}
