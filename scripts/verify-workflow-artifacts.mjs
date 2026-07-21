#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const VALID_MODES = new Set(["lite", "standard", "strict"]);
const VALID_STRATEGIES = new Set(["tdd", "test_first", "verification_only"]);
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

function validateManifest(root, manifest, errors) {
  if (manifest.schema !== "osd-workflow-manifest/v3") {
    errors.push(`Unsupported manifest schema: ${manifest.schema ?? "(missing)"}`);
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

function validateDeliveryRecord(path, mode, errors) {
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

  validateManifest(root, manifest, errors);
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
  if (nonEmptyFile(reportPath)) {
    validateDeliveryRecord(reportPath, mode, errors);
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
