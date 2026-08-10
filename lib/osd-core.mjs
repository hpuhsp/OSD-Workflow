import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync as nodeSpawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const CONFIG_PATH = join(".osd", "config.json");
export const WORKFLOW_RULE_PATH = join(".osd", "rules", "workflow.md");
export const CHANGE_ROOT = join(".osd", "changes");
export const ARCHIVE_ROOT = join(".osd", "archive");
const MANAGED_START = "<!-- osd-workflow:start -->";
const MANAGED_END = "<!-- osd-workflow:end -->";
const VALID_MODES = new Set(["lite", "standard", "strict"]);
const VALID_STRATEGIES = new Set(["tdd", "test_first", "verification_only"]);
const VALID_TYPES = new Set(["new_feature", "bug_fix", "existing_change", "refactor", "maintenance"]);
const VALID_SCOPES = new Set(["auto", "local", "module", "cross_module", "system"]);
const VALID_STATUSES = new Set(["draft", "approved", "planned", "implemented", "verified", "reviewed", "partial", "blocked", "archived", "rolled_back"]);

export const AGENT_TARGETS = ["qoder", "claude", "gemini", "trae", "cursor"];
const AGENT_DETAILS = {
  // Qoder rule files support frontmatter triggers (docs.qoder.com/cli/memory); model_decision injects only path+description until relevant.
  qoder: { destination: join(".qoder", "rules", "osd-workflow.md"), frontmatter: { trigger: "model_decision", description: "Apply OSD when planning, implementing, reviewing, verifying, or archiving a software change." } },
  claude: { destination: join(".claude", "rules", "osd-workflow.md"), frontmatter: null },
  gemini: { destination: "GEMINI.md", frontmatter: null },
  trae: { destination: join(".trae", "rules", "osd-workflow.md"), frontmatter: { description: "Apply OSD when planning, implementing, reviewing, verifying, or archiving a software change.", alwaysApply: false } },
  cursor: { destination: join(".cursor", "rules", "osd-workflow.mdc"), frontmatter: { description: "Apply when planning, implementing, reviewing, verifying, or archiving a software change with OSD.", globs: "", alwaysApply: false } },
};

export const WORKFLOW_STAGES = [
  ["specification", "openspec", "osd.markdown-spec"],
  ["planning", "superpowers.writing-plans", "osd.minimal-plan"],
  ["implementation", "superpowers.tdd", "agent-native"],
  ["verification", "superpowers.verification", "command"],
  ["review", "superpowers.review", "agent-review"],
  ["archive", "openspec", "osd.markdown-archive"],
];
const ALWAYS_AVAILABLE_ADAPTERS = new Set(["osd.markdown-spec", "osd.minimal-plan", "agent-native", "agent-review", "osd.markdown-archive"]);
const KNOWN_ADAPTERS = new Set([
  "openspec",
  "superpowers.writing-plans",
  "superpowers.tdd",
  "superpowers.verification",
  "superpowers.review",
  "command",
  ...ALWAYS_AVAILABLE_ADAPTERS,
]);

const TYPE_DEFAULTS = {
  new_feature: ["standard", "tdd"],
  bug_fix: ["lite", "test_first"],
  existing_change: ["standard", "test_first"],
  refactor: ["standard", "test_first"],
  maintenance: ["lite", "verification_only"],
};
const DEFAULT_ADAPTIVE_MODE = {
  enabled: true,
  thresholds: { standard: 2, strict: 5 },
  type_scores: { maintenance: 0, bug_fix: 1, refactor: 2, existing_change: 2, new_feature: 3 },
  scope_scores: { auto: 0, local: 0, module: 1, cross_module: 3, system: 5 },
  risk_scores: {
    low: -1,
    docs: -1,
    test_only: -1,
    medium: 2,
    high: 4,
    critical: 6,
    security: 5,
    auth: 4,
    payment: 5,
    privacy: 5,
    data_migration: 5,
    data_loss: 6,
    public_api: 4,
    dependency: 3,
    infrastructure: 3,
    concurrency: 3,
    performance: 2,
    config: 2,
    unknown: 1,
  },
};
const PATH_RISK_PATTERNS = [
  [/(\b|[\\\/])(auth|oauth|permission|rbac|security)(\b|[\\\/_.-])/i, "auth"],
  [/(\b|[\\\/])(payment|billing|invoice|checkout|wallet)(\b|[\\\/_.-])/i, "payment"],
  [/(\b|[\\\/])(migration|migrations|schema|database|db)(\b|[\\\/_.-])/i, "data_migration"],
  [/(\b|[\\\/])(api|openapi|proto|contract|sdk)(\b|[\\\/_.-])/i, "public_api"],
  [/(\b|[\\\/])(\.github|ci|deploy|infra|terraform|k8s|docker)(\b|[\\\/_.-])/i, "infrastructure"],
  [/(\b|[\\\/])(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)(\b|[\\\/_.-])?/i, "dependency"],
  [/(\b|[\\\/])(\.env|config|settings)(\b|[\\\/_.-])/i, "config"],
];
const SENSITIVE_VALUE_PATTERNS = [
  { name: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "aws_sts_token", pattern: /\bASIA[0-9A-Z]{16}\b/ },
  { name: "github_pat", pattern: /\bghp_[A-Za-z0-9]{36,}\b/ },
  { name: "github_oauth", pattern: /\bgho_[A-Za-z0-9]{36,}\b/ },
  { name: "openai_stripe_key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: "stripe_publishable", pattern: /\bpk_[A-Za-z0-9]{20,}\b/ },
  { name: "jwt_token", pattern: /eyJ[A-Za-z0-9+/=_-]+\.eyJ[A-Za-z0-9+/=_-]+\.[A-Za-z0-9+/=_-]+/ },
  { name: "pem_private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "slack_token", pattern: /\bxox[bpoas]-[A-Za-z0-9-]+\b/ },
];
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function packageAsset(name, fallback) {
  return readText(join(PACKAGE_ROOT, "assets", name)) || fallback;
}
function packageJsonAsset(name, fallback) {
  try { return JSON.parse(packageAsset(name, JSON.stringify(fallback))); } catch { return fallback; }
}
const RUNTIME_POLICY = packageJsonAsset("runtime-governance-policy.json", { roles: ["executor", "test_verifier", "reviewer", "monitor"] });

function workflowConfig() {
  return Object.fromEntries(WORKFLOW_STAGES.map(([stage, preferred, fallback]) => [stage, { preferred, fallback }]));
}

export function defaultConfig({ agents = [], verifyCommand = null } = {}) {
  return {
    schema: "osd.config/v2",
    contract: "osd-contract/v2",
    native_first: true,
    dynamic_routing: true,
    fallback_allowed: true,
    agents,
    workflow: workflowConfig(),
    governance: {
      require_specification_for_nontrivial_work: true,
      require_approval_for: ["standard", "strict"],
      require_verification_evidence: true,
      require_review_for: ["strict"],
      record_fallback_usage: true,
    },
    adaptive_mode: DEFAULT_ADAPTIVE_MODE,
    quality_gates: {
      unit_test: {
        enabled: true,
        required_for: [],
        recommended_for: ["lite", "standard", "strict"],
        command_id: "unitTest",
        fallback_to_verify: true,
      },
    },
    commands: { unitTest: null, verify: verifyCommand },
  };
}

function usage() {
  return `OSD 2.0 native-first delivery orchestrator

Usage:
  osd init [target] [--agents <targets>] [--yes] [--dry-run]
  osd doctor [target]
  osd adapters list [target]
  osd start <feature> [--type <type>] [--mode <mode>] [--strategy <strategy>] [--scope <scope>] [--risk <signals>] [--touches <paths>] [--adapter <auto|openspec|fallback>]
  osd approve <feature>
  osd plan <feature>
  osd implement <feature>
  osd verify <feature>
  osd review <feature> --result <pass|fail|partial> [--summary <text>]
  osd archive <feature>
  osd rollback <feature> --to <stage>
  osd status <feature>
  osd context <feature> --task <T-id> [--role <role>] [--owned-area <path>] [--isolated]
  osd authorize <feature> --command-id verify [--role <role>] [--path <path>]
  osd event <feature> --event <json>
  osd evaluate <feature>
  osd summarize <feature>
  osd config get [key] [--target <path>]
  osd config set <key> <json-or-text> [--target <path>]
  osd upgrade [target] [--yes]  (alias: update)

Options:
  --agents <targets>  qoder, claude, gemini, trae, cursor, all, none, or auto
  --yes               Accept detected defaults without prompting
  --dry-run           Show planned init changes without writing files
  --target <path>     Project directory (alternative to positional target)
  --type <type>       new_feature, bug_fix, existing_change, refactor, maintenance
  --mode <mode>       lite, standard, strict, or auto
  --strategy <name>   tdd, test_first, verification_only, or auto
  --scope <scope>     auto, local, module, cross_module, or system
  --risk <signals>    Comma-separated risk signals, e.g. auth,public_api,data_migration
  --touches <paths>   Comma-separated expected project-relative paths
  --adapter <name>    auto, openspec, or fallback
  --result <value>    pass, fail, or partial
  --summary <text>    Short review summary
  --version, -V       Print version and exit
`;
}

function normalizeAgent(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "trac" || normalized === "trae-cn" ? "trae" : normalized;
}

export function parseAgents(value) {
  if (value === undefined || value === null || value === "") return null;
  const requested = String(value).split(",").map(normalizeAgent).filter(Boolean);
  if (requested.includes("all")) return [...AGENT_TARGETS];
  if (requested.includes("none")) return [];
  if (requested.includes("auto")) return null;
  const invalid = requested.filter((agent) => !AGENT_TARGETS.includes(agent));
  if (invalid.length) throw new Error(`Unknown agent target(s): ${invalid.join(", ")}`);
  return [...new Set(requested)];
}

function valueAt(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return value;
}
function commaList(value) { return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean); }

export function parseArgs(argv) {
  const result = { command: null, subcommand: null, target: null, feature: null, configKey: null, configValue: null, task: null, role: "executor", ownedAreas: [], paths: [], isolated: false, event: null, commandId: null, agents: null, yes: false, dryRun: false, help: false, version: false, type: "new_feature", mode: "auto", strategy: "auto", scope: "auto", riskSignals: [], touchedPaths: [], adapter: "auto", reviewResult: null, summary: "", toStage: null };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--agents") result.agents = parseAgents(valueAt(argv, index++, argument));
    else if (argument.startsWith("--agents=")) result.agents = parseAgents(argument.slice(9));
    else if (argument === "--target") result.target = valueAt(argv, index++, argument);
    else if (argument.startsWith("--target=")) result.target = argument.slice(9);
    else if (argument === "--type") result.type = valueAt(argv, index++, argument);
    else if (argument.startsWith("--type=")) result.type = argument.slice(7);
    else if (argument === "--mode") result.mode = valueAt(argv, index++, argument);
    else if (argument.startsWith("--mode=")) result.mode = argument.slice(7);
    else if (argument === "--strategy") result.strategy = valueAt(argv, index++, argument);
    else if (argument.startsWith("--strategy=")) result.strategy = argument.slice(11);
    else if (argument === "--scope") result.scope = valueAt(argv, index++, argument);
    else if (argument.startsWith("--scope=")) result.scope = argument.slice(8);
    else if (argument === "--risk") result.riskSignals.push(...commaList(valueAt(argv, index++, argument)));
    else if (argument.startsWith("--risk=")) result.riskSignals.push(...commaList(argument.slice(7)));
    else if (argument === "--touches") result.touchedPaths.push(...commaList(valueAt(argv, index++, argument)));
    else if (argument.startsWith("--touches=")) result.touchedPaths.push(...commaList(argument.slice(10)));
    else if (argument === "--adapter") result.adapter = valueAt(argv, index++, argument);
    else if (argument.startsWith("--adapter=")) result.adapter = argument.slice(10);
    else if (argument === "--result") result.reviewResult = valueAt(argv, index++, argument);
    else if (argument.startsWith("--result=")) result.reviewResult = argument.slice(9);
    else if (argument === "--summary") result.summary = valueAt(argv, index++, argument);
    else if (argument.startsWith("--summary=")) result.summary = argument.slice(10);
    else if (argument === "--task") result.task = valueAt(argv, index++, argument);
    else if (argument.startsWith("--task=")) result.task = argument.slice(7);
    else if (argument === "--role") result.role = valueAt(argv, index++, argument);
    else if (argument.startsWith("--role=")) result.role = argument.slice(7);
    else if (argument === "--owned-area") result.ownedAreas.push(valueAt(argv, index++, argument));
    else if (argument.startsWith("--owned-area=")) result.ownedAreas.push(argument.slice(13));
    else if (argument === "--path") result.paths.push(valueAt(argv, index++, argument));
    else if (argument.startsWith("--path=")) result.paths.push(argument.slice(7));
    else if (argument === "--event") result.event = valueAt(argv, index++, argument);
    else if (argument.startsWith("--event=")) result.event = argument.slice(8);
    else if (argument === "--command-id") result.commandId = valueAt(argv, index++, argument);
    else if (argument.startsWith("--command-id=")) result.commandId = argument.slice(13);
    else if (argument === "--to") result.toStage = valueAt(argv, index++, argument);
    else if (argument.startsWith("--to=")) result.toStage = argument.slice(5);
    else if (argument === "--isolated") result.isolated = true;
    else if (argument === "--yes" || argument === "-y") result.yes = true;
    else if (argument === "--dry-run") result.dryRun = true;
    else if (argument === "--help" || argument === "-h") result.help = true;
    else if (argument === "--version" || argument === "-V") result.version = true;
    else if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    else positional.push(argument);
  }
  const commands = new Set(["init", "doctor", "adapters", "start", "approve", "plan", "implement", "verify", "review", "archive", "status", "context", "authorize", "event", "evaluate", "summarize", "config", "upgrade", "rollback", "update"]);
  if (commands.has(positional[0])) { result.command = positional.shift(); if (result.command === "update") result.command = "upgrade"; }
  if (result.command === null) { if (positional.length) throw new Error(`Unknown command: ${positional[0]}. Run 'osd --help' for available commands.`); result.help = true; return result; }
  if (result.command === "adapters") result.subcommand = positional.shift() || "list";
  if (result.command === "config") {
    result.subcommand = positional.shift() || "get";
    result.configKey = positional.shift() || null;
    if (result.subcommand === "set") result.configValue = positional.shift() || null;
    if (positional.length) throw new Error("Too many positional arguments.");
    if (!new Set(["get", "set"]).has(result.subcommand)) throw new Error(`Unknown config command: ${result.subcommand}`);
    if (result.subcommand === "set" && (!result.configKey || result.configValue === null)) throw new Error("config set requires a key and value.");
  } else if (result.command === "init" || result.command === "doctor" || result.command === "adapters" || result.command === "upgrade") {
    if (positional.length > 1 || (result.target && positional.length)) throw new Error("Specify the target only once.");
    if (!result.target && positional.length) result.target = positional[0];
  } else {
    if (!positional.length) throw new Error(`${result.command} requires a feature name.`);
    if (positional.length > 2) throw new Error("Too many positional arguments.");
    result.feature = positional.shift();
    if (!result.target && positional.length) result.target = positional[0];
  }
  if (result.command === "context" && !result.task) throw new Error("context requires --task T-01.");
  if (result.command === "authorize" && !result.commandId) throw new Error("authorize requires --command-id verify or unitTest.");
  if (result.command === "event" && !result.event) throw new Error("event requires --event JSON.");
  if (result.command === "adapters" && result.subcommand !== "list") throw new Error(`Unknown adapters command: ${result.subcommand}`);
  if (!VALID_SCOPES.has(result.scope)) throw new Error(`Unknown scope: ${result.scope}`);
  return result;
}

function printBanner(output = console.log) {
  output("+----------------------------------------+");
  output("| OSD 2.0  native-first delivery control |");
  output("+----------------------------------------+");
}

function readText(path) { try { return readFileSync(path, "utf8"); } catch { return null; } }
function readJson(path) { const text = readText(path); try { return text ? JSON.parse(text) : null; } catch { return null; } }
function fileExists(path) { try { return existsSync(path) && statSync(path).isFile(); } catch { return false; } }
function writeText(path, content, dryRun = false) {
  const previous = readText(path);
  if (previous === content) return "skipped";
  if (!dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = path + ".tmp." + Math.random().toString(36).slice(2, 8);
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  }
  return previous === null ? "created" : "updated";
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + ".tmp." + Math.random().toString(36).slice(2, 8);
  try {
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
  } catch (error) {
    try { if (existsSync(tmp)) rmSync(tmp); } catch {}
    throw error;
  }
}
function now() { return new Date().toISOString(); }
function safeFeature(feature) { return /^[a-z0-9][a-z0-9-]*$/i.test(feature || ""); }
function ensureFeature(feature) { if (!safeFeature(feature)) throw new Error("Feature must be a single letter, number, or hyphen separated name."); }

function splitLeadingFrontmatter(content) { const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/); return match ? { body: content.slice(match[0].length) } : { body: content }; }
function formatFrontmatter(frontmatter) { if (!frontmatter) return ""; return `---\n${Object.entries(frontmatter).map(([key, value]) => `${key}: ${typeof value === "string" ? JSON.stringify(value) : value}`).join("\n")}\n---\n`; }

export function mergeManagedAgentRule(existing, managedContent, frontmatter = null) {
  const { body } = splitLeadingFrontmatter(existing || "");
  const block = `${MANAGED_START}\n${managedContent.trim()}\n${MANAGED_END}`;
  const escapedStart = MANAGED_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = MANAGED_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "g");
  const merged = expression.test(body) ? body.replace(expression, block) : `${body.trimEnd()}${body.trim() ? "\n\n" : ""}${block}`;
  return `${formatFrontmatter(frontmatter)}${merged.trimEnd()}\n`;
}

export function renderWorkflowRule() {
  return packageAsset("workflow-rule.md", `# OSD 2.0 Delivery Contract

OSD owns delivery routing, stage order, required evidence, and acceptance gates. Before changing repository code, read \`.osd/config.json\` and use \`osd status <feature>\` for the active task.

1. Classify the task as \`new_feature\`, \`bug_fix\`, \`existing_change\`, \`refactor\`, or \`maintenance\`. Let OSD select \`lite\`, \`standard\`, or \`strict\` from adaptive risk signals unless the user explicitly overrides \`--mode\`.
2. Start the change through \`osd start <feature>\`. Do not claim a stage is complete merely because an Agent discussed it.
3. For every stage, use the configured preferred adapter when present. OpenSpec is the native specification and archive authority; Superpowers is an execution method when the current harness supplies it. Do not recreate either tool's internal method.
4. If a preferred adapter is unavailable, use only the configured fallback and keep the fallback record OSD creates. Missing tools do not permit skipping specification, verification, review, or archive gates.
5. Advance the delivery contract through \`osd approve\`, \`osd plan\`, \`osd implement\`, \`osd verify\`, \`osd review\`, and \`osd archive\`. Run \`osd verify\` before reporting delivery complete.

OSD: <task_type> | <mode> | <strategy> | <stage> | <adapters>
`);
}

function renderAgentRule(agent) {
  if (agent === "gemini") return "@.osd/rules/workflow.md\n";
  return `# OSD workflow\n\nRead and follow \`.osd/rules/workflow.md\` for repository-changing work. Use OSD's stage state and evidence commands as the source of truth.\n`;
}

export function detectConfiguredAgents(target) { return AGENT_TARGETS.filter((agent) => existsSync(join(target, AGENT_DETAILS[agent].destination))); }
function configuredCommand(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length) return value.join(" ");
  return null;
}
function packageScriptCommand(target, scriptName) {
  if (existsSync(join(target, "pnpm-lock.yaml"))) return scriptName === "test" ? "pnpm test" : `pnpm run ${scriptName}`;
  if (existsSync(join(target, "yarn.lock"))) return scriptName === "test" ? "yarn test" : `yarn ${scriptName}`;
  return scriptName === "test" ? "npm test" : `npm run ${scriptName}`;
}
export function detectVerificationCommand(target, config = null) {
  const configured = configuredCommand(config?.commands?.verify);
  if (configured) return configured;
  const packageJson = readJson(join(target, "package.json"));
  if (packageJson?.scripts?.test) return packageScriptCommand(target, "test");
  if (existsSync(join(target, "pnpm-lock.yaml"))) return "pnpm test";
  if (existsSync(join(target, "yarn.lock"))) return "yarn test";
  return null;
}
export function detectUnitTestCommand(target, config = null) {
  const configured = configuredCommand(config?.commands?.unitTest ?? config?.commands?.unit_test);
  if (configured) return configured;
  const scripts = readJson(join(target, "package.json"))?.scripts || {};
  for (const scriptName of ["test:unit", "unit:test", "unit"]) if (scripts[scriptName]) return packageScriptCommand(target, scriptName);
  return null;
}

function executableExists(command, spawn = nodeSpawnSync) {
  const candidates = process.platform === "win32" ? [command, `${command}.cmd`] : [command];
  return candidates.some((candidate) => { const result = spawn(candidate, ["--version"], { stdio: "ignore", windowsHide: true }); return !result.error && result.status === 0; });
}

export function detectCapabilities(target, config = null, { env = process.env, spawn = nodeSpawnSync } = {}) {
  const openspecCommand = env.OSD_OPENSPEC_COMMAND || "openspec";
  const openspecAvailable = ["1", "true", "yes"].includes(String(env.OSD_OPENSPEC_AVAILABLE || "").toLowerCase()) || executableExists(openspecCommand, spawn);
  const superpowersPaths = [join(target, ".superpowers"), join(target, ".agents", "skills", "superpowers"), join(target, ".codex", "skills", "superpowers"), join(target, ".claude", "skills", "superpowers")];
  const superpowersAvailable = ["1", "true", "yes"].includes(String(env.OSD_SUPERPOWERS_AVAILABLE || "").toLowerCase()) || superpowersPaths.some(existsSync);
  const verificationCommand = detectVerificationCommand(target, config);
  const unitTestCommand = detectUnitTestCommand(target, config);
  return { openspec: { available: openspecAvailable, detail: openspecAvailable ? openspecCommand : "not found", workspace: existsSync(join(target, "openspec")) }, superpowers: { available: superpowersAvailable, detail: superpowersAvailable ? "skill available" : "not found" }, verificationCommand: { available: Boolean(verificationCommand), detail: verificationCommand || "not configured" }, unitTestCommand: { available: Boolean(unitTestCommand), detail: unitTestCommand || "not configured" } };
}

function adapterAvailable(adapter, capabilities) { if (!KNOWN_ADAPTERS.has(adapter)) return false; if (adapter === "openspec") return capabilities.openspec.available && capabilities.openspec.workspace; if (adapter.startsWith("superpowers.")) return capabilities.superpowers.available; if (adapter === "command") return capabilities.verificationCommand.available; return ALWAYS_AVAILABLE_ADAPTERS.has(adapter); }
export function resolveWorkflowAdapters(config, capabilities) {
  const fallbackAllowed = config?.fallback_allowed !== false;
  return WORKFLOW_STAGES.map(([stage, defaultPreferred, defaultFallback]) => {
    const stageConfig = config?.workflow?.[stage] || {}; const preferred = stageConfig.preferred || defaultPreferred; const fallback = stageConfig.fallback || defaultFallback;
    if (adapterAvailable(preferred, capabilities)) return { stage, preferred, fallback, selected: preferred, status: "native", fallbackUsed: false, reason: "preferred adapter available" };
    if (fallbackAllowed && adapterAvailable(fallback, capabilities)) return { stage, preferred, fallback, selected: fallback, status: "fallback", fallbackUsed: true, reason: `${preferred} unavailable` };
    return { stage, preferred, fallback, selected: null, status: "unresolved", fallbackUsed: false, reason: `${preferred} unavailable; fallback unavailable or disabled` };
  });
}

function mergeConfig(existing, agents, verifyCommand) {
  const defaults = defaultConfig({ agents, verifyCommand }); const base = existing && typeof existing === "object" ? existing : {};
  return {
    ...defaults,
    ...base,
    schema: "osd.config/v2",
    agents,
    workflow: { ...defaults.workflow, ...(base.workflow || {}) },
    governance: { ...defaults.governance, ...(base.governance || {}) },
    adaptive_mode: {
      ...defaults.adaptive_mode,
      ...(base.adaptive_mode || {}),
      thresholds: { ...defaults.adaptive_mode.thresholds, ...(base.adaptive_mode?.thresholds || {}) },
      type_scores: { ...defaults.adaptive_mode.type_scores, ...(base.adaptive_mode?.type_scores || {}) },
      scope_scores: { ...defaults.adaptive_mode.scope_scores, ...(base.adaptive_mode?.scope_scores || {}) },
      risk_scores: { ...defaults.adaptive_mode.risk_scores, ...(base.adaptive_mode?.risk_scores || {}) },
    },
    quality_gates: {
      ...defaults.quality_gates,
      ...(base.quality_gates || {}),
      unit_test: { ...defaults.quality_gates.unit_test, ...(base.quality_gates?.unit_test || {}) },
    },
    commands: { ...defaults.commands, ...(base.commands || {}) },
  };
}

async function chooseAgents(target, options) {
  if (options.agents !== null) return options.agents;
  const configured = detectConfiguredAgents(target);
  if (options.yes || !process.stdin.isTTY) return configured;
  try {
    const { checkbox } = await import("@inquirer/prompts");
    return await checkbox({
      message: "Select AI Agent rule targets",
      choices: AGENT_TARGETS.map((agent) => ({ name: `${agent.padEnd(7)} ${AGENT_DETAILS[agent].destination}`, value: agent, checked: configured.includes(agent) })),
    });
  } catch (error) {
    throw new Error(`Interactive Agent selection requires @inquirer/prompts. Reinstall osd-workflow or use --agents. (${error.message})`);
  }
}

export async function initProject(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); printBanner(output); const agents = await chooseAgents(target, options); const configPath = join(target, CONFIG_PATH); const existingConfig = readJson(configPath); const config = mergeConfig(existingConfig, agents, detectVerificationCommand(target, existingConfig)); const changes = [];
  const record = (path, content) => changes.push({ path: relative(target, path), status: writeText(path, content, options.dryRun) });
  record(configPath, `${JSON.stringify(config, null, 2)}\n`); record(join(target, WORKFLOW_RULE_PATH), renderWorkflowRule());
  for (const agent of agents) { const detail = AGENT_DETAILS[agent]; const destination = join(target, detail.destination); record(destination, mergeManagedAgentRule(readText(destination) || "", renderAgentRule(agent), detail.frontmatter)); }
  output(`OSD initialized in ${target}`); for (const change of changes) output(`  ${change.status.padEnd(7)} ${change.path}`); output("  Workflow assets are installed lazily under .osd/changes when a delivery starts."); return { target, config, agents, changes };
}

function configPathParts(key) {
  if (!key || !/^[a-zA-Z0-9_.-]+$/.test(key)) throw new Error("Config keys use dot-separated letters, numbers, underscores, and hyphens.");
  const parts = key.split(".");
  if (parts.some((part) => ["__proto__", "prototype", "constructor"].includes(part))) throw new Error("Unsafe config key.");
  return parts;
}
function parseConfigValue(value) { try { return JSON.parse(value); } catch { return value; } }
function valueAtPath(value, parts) { return parts.reduce((current, part) => current && typeof current === "object" ? current[part] : undefined, value); }
function setValueAtPath(value, parts, next) { let current = value; for (const part of parts.slice(0, -1)) { if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) current[part] = {}; current = current[part]; } current[parts.at(-1)] = next; }

export function configProject(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const config = loadProject(target); const parts = options.configKey ? configPathParts(options.configKey) : [];
  if (options.subcommand === "get") { const value = parts.length ? valueAtPath(config, parts) : config; output(JSON.stringify(value ?? null, null, 2)); return value; }
  setValueAtPath(config, parts, parseConfigValue(options.configValue));
  const validation = validateConfig(config);
  if (!validation.ok) throw new Error(`Refusing to save invalid OSD config (${CONFIG_PATH}): ${validation.errors.join("; ")}`);
  writeJson(join(target, CONFIG_PATH), config); output(`OSD config updated: ${options.configKey}`); return config;
}

export async function upgradeProject(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const existing = loadProject(target); const next = { ...options, target, agents: Array.isArray(existing.agents) ? existing.agents : [], yes: true };
  const result = await initProject(next, { output }); output("OSD project contract upgraded without creating historical workflow artifacts."); return result;
}

function configStatus(config) {
  // Deprecated: prefer validateConfig() for new code.
  // Kept for backward compatibility with external callers.
  if (!config) return { ok: false, detail: "missing or invalid JSON" };
  if (config.schema !== "osd.config/v2") return { ok: false, detail: `expected osd.config/v2, found ${config.schema || "none"}` };
  return { ok: true, detail: "osd.config/v2" };
}
function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== "object") { errors.push("Config must be an object."); return { ok: false, errors }; }

  if (config.schema !== "osd.config/v2") errors.push(`Invalid config schema: expected "osd.config/v2", got "${config.schema}".`);
  if (config.agents !== undefined && !Array.isArray(config.agents)) errors.push("agents must be an array.");
  if (config.commands !== undefined && typeof config.commands !== "object") errors.push("commands must be an object.");
  if (config.workflow !== undefined) {
    if (!config.workflow || typeof config.workflow !== "object" || Array.isArray(config.workflow)) {
      errors.push("workflow must be an object.");
    } else {
      const validStages = new Set(WORKFLOW_STAGES.map(([stage]) => stage));
      for (const [stage, stageConfig] of Object.entries(config.workflow)) {
        if (!validStages.has(stage)) errors.push(`Invalid workflow stage: "${stage}".`);
        if (!stageConfig || typeof stageConfig !== "object" || Array.isArray(stageConfig)) {
          errors.push(`workflow.${stage} must be an object.`);
          continue;
        }
        for (const field of ["preferred", "fallback"]) {
          if (stageConfig[field] !== undefined && !KNOWN_ADAPTERS.has(stageConfig[field])) {
            errors.push(`Invalid adapter for workflow.${stage}.${field}: "${stageConfig[field]}".`);
          }
        }
      }
    }
  }
  if (config.adaptive_mode !== undefined && typeof config.adaptive_mode !== "object") errors.push("adaptive_mode must be an object.");
  if (config.adaptive_mode?.thresholds !== undefined) {
    if (typeof config.adaptive_mode.thresholds.standard !== "number") errors.push("adaptive_mode.thresholds.standard must be a number.");
    if (typeof config.adaptive_mode.thresholds.strict !== "number") errors.push("adaptive_mode.thresholds.strict must be a number.");
  }

  return { ok: errors.length === 0, errors };
}
function loadProject(target) {
  const config = readJson(join(target, CONFIG_PATH));
  const validation = validateConfig(config || {});
  if (!validation.ok) {
    throw new Error(`Invalid OSD config (${CONFIG_PATH}): ${validation.errors.join("; ")}`);
  }
  return config;
}
function activeStatePath(target, feature) { return join(target, CHANGE_ROOT, feature, "state.json"); }
function archiveStatePaths(target, feature) { const root = join(target, ARCHIVE_ROOT); if (!existsSync(root)) return []; return readDir(root).filter((name) => name.endsWith(`-${feature}`)).map((name) => join(root, name, "state.json")); }
function readDir(path) { try { return statSync(path).isDirectory() ? readdirSync(path) : []; } catch { return []; } }

function validateState(state) {
  const errors = [];
  if (!state || typeof state !== "object") { errors.push("State must be an object."); return { ok: false, errors }; }

  if (state.schema !== "osd-change-state/v2") errors.push(`Invalid state schema: expected "osd-change-state/v2", got "${state.schema}".`);
  if (!state.feature || typeof state.feature !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(state.feature)) errors.push(`Invalid feature name: "${state.feature}".`);

  const validStages = [...WORKFLOW_STAGES.map(s => s[0]), "complete"];
  if (!validStages.includes(state.stage)) errors.push(`Invalid stage: "${state.stage}". Valid stages: ${validStages.join(", ")}.`);
  if (typeof state.status !== "string" || !state.status) errors.push(`Invalid status: "${state.status}".`);
  if (state.status && !VALID_STATUSES.has(state.status)) errors.push(`Invalid status: "${state.status}". Valid statuses: ${[...VALID_STATUSES].join(", ")}.`);
  if (!VALID_MODES.has(state.mode)) errors.push(`Invalid mode: "${state.mode}". Valid modes: ${[...VALID_MODES].join(", ")}.`);
  if (!VALID_STRATEGIES.has(state.strategy)) errors.push(`Invalid strategy: "${state.strategy}". Valid strategies: ${[...VALID_STRATEGIES].join(", ")}.`);
  if (!VALID_TYPES.has(state.task_type)) errors.push(`Invalid task type: "${state.task_type}". Valid types: ${[...VALID_TYPES].join(", ")}.`);
  if (!Array.isArray(state.history)) errors.push("History must be an array.");

  return { ok: errors.length === 0, errors };
}

function loadState(target, feature) {
  ensureFeature(feature);
  const active = readJson(activeStatePath(target, feature));
  if (active) {
    const validation = validateState(active);
    if (!validation.ok) {
      throw new Error(`Corrupted state file for ${feature}: ${validation.errors.join("; ")}. Run osd doctor for diagnosis.`);
    }
    return { state: active, path: activeStatePath(target, feature), archived: false };
  }
  const archived = archiveStatePaths(target, feature).map((path) => ({ path, state: readJson(path) })).find((entry) => entry.state);
  if (archived) {
    const validation = validateState(archived.state);
    if (!validation.ok) {
      throw new Error(`Corrupted archived state for ${feature}: ${validation.errors.join("; ")}.`);
    }
    return { ...archived, archived: true };
  }
  throw new Error(`No OSD delivery found for feature: ${feature}`);
}

function stateDirectory(target, feature) { return join(target, CHANGE_ROOT, feature); }
function fallbackDirectory(target, feature) { return join(stateDirectory(target, feature), "artifacts"); }
function nativeChangeDirectory(target, feature) { return join(target, "openspec", "changes", feature); }
function sourceDirectory(target, state) { return state.specification_backend === "openspec" ? nativeChangeDirectory(target, state.feature) : fallbackDirectory(target, state.feature); }
function specificationPath(target, state) { return join(sourceDirectory(target, state), "spec.md"); }
function proposalPath(target, state) { return join(sourceDirectory(target, state), "proposal.md"); }
function tasksPath(target, state) { return join(sourceDirectory(target, state), "tasks.md"); }
function verificationPath(target, state) { return join(stateDirectory(target, state.feature), "verification.json"); }
function reviewPath(target, state) { return join(stateDirectory(target, state.feature), "review.json"); }
function deliveryPath(target, state) { return join(stateDirectory(target, state.feature), "delivery.md"); }
function contextPath(target, state, task) { return join(stateDirectory(target, state.feature), "context", `${task}.json`); }
function eventsPath(target, state) { return join(stateDirectory(target, state.feature), "events.jsonl"); }
function evaluationPath(target, state) { return join(stateDirectory(target, state.feature), "evaluation.json"); }
function authorizationPath(target, state) { return join(stateDirectory(target, state.feature), "authorizations.jsonl"); }

function selectedAdapter(adapters, stage) { return adapters.find((adapter) => adapter.stage === stage)?.selected || null; }
function normalizedSignal(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function addScoreFactor(factors, score, source, value, reason) { if (score) factors.push({ source, value, score, reason }); }
function adaptivePolicy(config) {
  const configured = config?.adaptive_mode || {};
  return {
    ...DEFAULT_ADAPTIVE_MODE,
    ...configured,
    thresholds: { ...DEFAULT_ADAPTIVE_MODE.thresholds, ...(configured.thresholds || {}) },
    type_scores: { ...DEFAULT_ADAPTIVE_MODE.type_scores, ...(configured.type_scores || {}) },
    scope_scores: { ...DEFAULT_ADAPTIVE_MODE.scope_scores, ...(configured.scope_scores || {}) },
    risk_scores: { ...DEFAULT_ADAPTIVE_MODE.risk_scores, ...(configured.risk_scores || {}) },
  };
}
function pathRiskSignals(paths) {
  const signals = [];
  for (const path of paths || []) {
    for (const [pattern, signal] of PATH_RISK_PATTERNS) {
      if (pattern.test(path) && !signals.some((entry) => entry.path === path && entry.signal === signal)) signals.push({ path, signal });
    }
  }
  return signals;
}
export function evaluateAdaptiveMode({ type, scope = "auto", riskSignals = [], touchedPaths = [], config = null } = {}) {
  if (!VALID_TYPES.has(type)) throw new Error(`Unknown task type: ${type}`);
  if (!VALID_SCOPES.has(scope)) throw new Error(`Unknown scope: ${scope}`);
  const policy = adaptivePolicy(config);
  const factors = [];
  const typeScore = Number(policy.type_scores?.[type] ?? 0);
  addScoreFactor(factors, typeScore, "task_type", type, "base delivery risk");
  const scopeScore = Number(policy.scope_scores?.[scope] ?? 0);
  addScoreFactor(factors, scopeScore, "scope", scope, "declared blast radius");
  for (const signal of riskSignals.map(normalizedSignal).filter(Boolean)) {
    const score = Number(policy.risk_scores?.[signal] ?? policy.risk_scores?.unknown ?? 1);
    addScoreFactor(factors, score, "risk", signal, "declared risk signal");
  }
  for (const { path, signal } of pathRiskSignals(touchedPaths)) {
    const score = Number(policy.risk_scores?.[signal] ?? policy.risk_scores?.unknown ?? 1);
    addScoreFactor(factors, score, "path", path, `path implies ${signal}`);
  }
  const score = factors.reduce((total, factor) => total + factor.score, 0);
  const selected = score >= Number(policy.thresholds.strict ?? 5) ? "strict" : score >= Number(policy.thresholds.standard ?? 2) ? "standard" : "lite";
  return { selected, score, thresholds: policy.thresholds, factors, inputs: { type, scope, riskSignals: riskSignals.map(normalizedSignal).filter(Boolean), touchedPaths } };
}
function routeDefaults(type, mode, strategy, config = null, routing = {}) {
  if (!VALID_TYPES.has(type)) throw new Error(`Unknown task type: ${type}`);
  const [defaultMode, defaultStrategy] = TYPE_DEFAULTS[type];
  const adaptive = adaptivePolicy(config).enabled === false ? { selected: defaultMode, suggested: defaultMode, score: 0, thresholds: adaptivePolicy(config).thresholds, factors: [], inputs: { type, scope: routing.scope || "auto", riskSignals: [], touchedPaths: [] } } : evaluateAdaptiveMode({ type, scope: routing.scope || "auto", riskSignals: routing.riskSignals || [], touchedPaths: routing.touchedPaths || [], config });
  const selectedMode = mode === "auto" ? adaptive.selected : mode;
  const selectedStrategy = strategy === "auto" ? defaultStrategy : strategy;
  if (!VALID_MODES.has(selectedMode)) throw new Error(`Unknown mode: ${selectedMode}`);
  if (!VALID_STRATEGIES.has(selectedStrategy)) throw new Error(`Unknown strategy: ${selectedStrategy}`);
  return { mode: selectedMode, strategy: selectedStrategy, mode_decision: { ...adaptive, selected: selectedMode, suggested: adaptive.selected, override: mode !== "auto" ? mode : null } };
}

function artifactTemplates(state) {
  const featureName = state.feature;
  return {
    "proposal.md": `# Proposal: ${featureName}\n\n## Problem\n\nDescribe the user or engineering problem.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Acceptance Criteria\n\n- AC-01: \n`,
    "spec.md": `# Specification: ${featureName}\n\n## Expected Behavior\n\nDescribe the observable result.\n\n## Non-goals\n\n- \n\n## Acceptance Criteria\n\n- AC-01: \n`,
    "tasks.md": `# Atomic Tasks: ${featureName}\n\n- T-01: Objective. Linked acceptance criteria: AC-01. Owner: executor. Dependencies: none. Status: todo. Verification: command or procedure.\n`,
  };
}

function createFallbackArtifacts(target, state) {
  const root = fallbackDirectory(target, state.feature);
  for (const [name, content] of Object.entries(artifactTemplates(state))) writeText(join(root, name), content);
  return root;
}

function renderDeliveryRecord(state) {
  const decision = state.mode_decision ? `\n- Mode score: ${state.mode_decision.score}\n- Mode suggested: ${state.mode_decision.suggested}\n- Mode override: ${state.mode_decision.override || "none"}` : "";
  return `# Delivery Record: ${state.feature}\n\n- Task type: ${state.task_type}\n- Mode: ${state.mode}${decision}\n- Development strategy: ${state.strategy}\n- OSD controller: osd_workflow\n- Specification backend: ${state.specification_backend}\n- OpenSpec participation: ${state.adapters.specification}\n- Superpowers participation: ${state.adapters.planning}, ${state.adapters.implementation}, ${state.adapters.verification}, ${state.adapters.review}\n- Specification: ${state.specification_path}\n- Unit tests: pending\n- Verification: pending\n- Review: pending\n- Result: in_progress\n- Residual risk: pending\n`;
}

function saveState(target, state) {
  const validation = validateState(state);
  if (!validation.ok) {
    throw new Error(`Refusing to save invalid state: ${validation.errors.join("; ")}`);
  }
  state.updated_at = now();
  writeJson(activeStatePath(target, state.feature), state);
}
function transition(state, stage, status) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: "${status}". Valid statuses: ${[...VALID_STATUSES].join(", ")}.`);
  }
  state.stage = stage;
  state.status = status;
  state.history.push({ stage, status, at: now() });
}

export function startDelivery(options, { output = console.log, env = process.env, spawn = nodeSpawnSync } = {}) {
  const target = resolve(options.target || "."); ensureFeature(options.feature); const config = loadProject(target); const existing = readJson(activeStatePath(target, options.feature)); if (existing) throw new Error(`OSD delivery already exists for ${options.feature}.`);
  const capabilities = detectCapabilities(target, config, { env, spawn }); const adapters = resolveWorkflowAdapters(config, capabilities); const defaults = routeDefaults(options.type, options.mode, options.strategy, config, options);
  if (!["auto", "openspec", "fallback"].includes(options.adapter)) throw new Error(`Unknown adapter preference: ${options.adapter}`);
  const openspecReady = capabilities.openspec.available && capabilities.openspec.workspace;
  const useOpenSpec = options.adapter === "openspec" ? openspecReady : options.adapter === "fallback" ? false : selectedAdapter(adapters, "specification") === "openspec";
  if (options.adapter === "openspec" && !openspecReady) throw new Error("OpenSpec adapter requires both the openspec command and an initialized openspec/ workspace.");
  if (!useOpenSpec && config.fallback_allowed === false) throw new Error("Fallback specification is disabled by project configuration.");
  const resolvedAdapters = Object.fromEntries(adapters.map((adapter) => [adapter.stage, adapter.selected]));
  if (!useOpenSpec) { resolvedAdapters.specification = "osd.markdown-spec"; resolvedAdapters.archive = "osd.markdown-archive"; }
  const fallbackStages = adapters.filter((adapter) => adapter.fallbackUsed).map((adapter) => adapter.stage);
  if (!useOpenSpec) for (const stage of ["specification", "archive"]) if (!fallbackStages.includes(stage)) fallbackStages.push(stage);
  const state = {
    schema: "osd-change-state/v2", feature: options.feature, task_type: options.type, mode: defaults.mode, mode_decision: defaults.mode_decision, strategy: defaults.strategy,
    stage: "specification", status: "draft", specification_backend: useOpenSpec ? "openspec" : "osd.markdown-spec",
    specification_path: useOpenSpec ? `openspec/changes/${options.feature}/spec.md` : `.osd/changes/${options.feature}/artifacts/spec.md`,
    adapters: resolvedAdapters, fallback_stages: fallbackStages, history: [{ stage: "specification", status: "draft", at: now() }], created_at: now(), updated_at: now(),
  };
  if (!useOpenSpec) createFallbackArtifacts(target, state);
  saveState(target, state); writeText(deliveryPath(target, state), renderDeliveryRecord(state));
  const next = useOpenSpec ? `Use the Agent's OpenSpec /opsx:propose workflow to create the native proposal/spec for ${state.feature}, then run osd approve ${state.feature}.` : `Complete ${relative(target, specificationPath(target, state))}, then run osd approve ${state.feature}.`;
  output(`OSD: ${state.task_type} | ${state.mode} | ${state.strategy} | ${state.stage} | ${JSON.stringify(state.adapters)}`);
  output(`Mode decision: ${state.mode_decision.suggested} score=${state.mode_decision.score}${state.mode_decision.override ? ` override=${state.mode_decision.override}` : ""}`);
  output(next); return state;
}

function requireFile(path, description) { if (!fileExists(path)) throw new Error(`${description} is missing or empty: ${path}`); }
function requireStage(state, allowed, command) { if (!allowed.includes(state.stage)) throw new Error(`${command} is not allowed while stage is ${state.stage}.`); }

export function approveDelivery(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature); requireStage(state, ["specification"], "approve"); requireFile(specificationPath(target, state), "Specification");
  if (state.mode !== "lite") requireFile(proposalPath(target, state), "Proposal"); transition(state, "planning", "approved"); saveState(target, state); output(`OSD approval recorded: ${state.feature} -> planning`); return state;
}

export function planDelivery(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature); requireStage(state, ["planning"], "plan");
  if (state.mode !== "lite") requireFile(tasksPath(target, state), "Atomic task plan"); transition(state, "implementation", "planned"); saveState(target, state); output(`OSD plan accepted: ${state.feature} -> implementation`); return state;
}

export function beginImplementation(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature); requireStage(state, ["implementation"], "implement"); transition(state, "verification", "implemented"); saveState(target, state); output(`OSD implementation checkpoint recorded: ${state.feature} -> verification`); return state;
}

function taskIds(text) { return [...String(text || "").matchAll(/^\s*-\s*(T-\d+)\s*:/gim)].map((match) => match[1]); }
function acceptanceCriteria(text) { return [...String(text || "").matchAll(/\b(AC-\d+)\s*:/g)].map((match) => match[1]); }
function appendJsonLine(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "a" });
  // Prevent unbounded growth: truncate to last ~500 lines if over 100KB
  try {
    const stat = statSync(path);
    if (stat.size > 100_000) {
      const content = readFileSync(path, "utf8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      if (lines.length > 500) {
        writeFileSync(path, lines.slice(-500).join("\n") + "\n", "utf8");
      }
    }
  } catch {}
}
function safeRelativePath(value) { return typeof value === "string" && value.trim() && !value.includes("..") && !/^([a-zA-Z]:)?[\\/]/.test(value); }

export function createTaskContext(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature);
  if (!/^T-\d+$/.test(options.task || "")) throw new Error("Task identifiers use the form T-01.");
  if (!RUNTIME_POLICY.roles.includes(options.role)) throw new Error(`Unknown OSD role: ${options.role}`);
  const taskPlan = readText(tasksPath(target, state)) || "";
  if (state.mode !== "lite" && !taskIds(taskPlan).includes(options.task)) throw new Error(`Task ${options.task} is not present in the approved task plan.`);
  if (!options.ownedAreas.every(safeRelativePath)) throw new Error("Owned areas must be safe project-relative paths.");
  const context = { schema: "osd-task-context/v2", feature: state.feature, task_id: options.task, role: options.role, owned_areas: options.ownedAreas, isolated_execution: options.isolated, stage: state.stage, mode: state.mode, strategy: state.strategy, specification: state.specification_path, task_plan: relative(target, tasksPath(target, state)).replaceAll("\\", "/"), created_at: now() };
  writeJson(contextPath(target, state, options.task), context); output(JSON.stringify(context, null, 2)); return context;
}

function commandCatalog(target, config) {
  const configured = Array.isArray(config?.commands?.catalog) ? config.commands.catalog : [];
  const verify = detectVerificationCommand(target, config);
  const unitTest = detectUnitTestCommand(target, config);
  const defaults = [
    unitTest ? { id: "unitTest", command: unitTest, roles: ["executor", "test_verifier"] } : null,
    verify ? { id: "verify", command: verify, roles: ["executor", "test_verifier"] } : null,
  ].filter(Boolean);
  return [...defaults, ...configured].filter((entry) => entry && typeof entry.id === "string" && typeof entry.command === "string");
}

export function authorizeAction(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const config = loadProject(target); const { state } = loadState(target, options.feature); const command = commandCatalog(target, config).find((entry) => entry.id === options.commandId);
  if (!command) throw new Error(`Command id is not allowed by OSD config: ${options.commandId}`);
  if (!RUNTIME_POLICY.roles.includes(options.role)) throw new Error(`Unknown OSD role: ${options.role}`);
  if (Array.isArray(command.roles) && !command.roles.includes(options.role)) throw new Error(`Role ${options.role} is not allowed to run ${options.commandId}.`);
  if (!options.paths.every(safeRelativePath)) throw new Error("Authorized paths must be safe project-relative paths.");
  const authorization = { schema: "osd-command-authorization/v1", feature: state.feature, command_id: command.id, command: redactSensitive(command.command), role: options.role, paths: options.paths, authorized_at: now() };
  appendJsonLine(authorizationPath(target, state), authorization); output(JSON.stringify(authorization, null, 2)); return authorization;
}

function containsSensitiveData(value) {
  if (Array.isArray(value)) return value.some(containsSensitiveData);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, entry]) => {
      if (/prompt|credential|secret|token|password|raw_(input|output)|source_code/i.test(key)) return true;
      return containsSensitiveData(entry);
    });
  }
  if (typeof value === "string" && value.length > 8) {
    return SENSITIVE_VALUE_PATTERNS.some(({ pattern }) => pattern.test(value));
  }
  return false;
}
function redactSensitive(text) {
  if (typeof text !== "string" || !text) return text;
  let redacted = text;
  for (const { pattern } of SENSITIVE_VALUE_PATTERNS) { redacted = redacted.replace(pattern, "[REDACTED]"); }
  return redacted;
}

export function recordEvent(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature); let event;
  try { event = JSON.parse(options.event); } catch { throw new Error("event must be valid JSON."); }
  if (!event || typeof event !== "object" || Array.isArray(event) || containsSensitiveData(event)) throw new Error("Event must be an object without prompts, credentials, secrets, tokens, source code, or raw tool I/O.");
  const record = { ...event, schema: "osd-run-event/v2", feature: state.feature, stage: state.stage, timestamp: now() };
  appendJsonLine(eventsPath(target, state), record); output(JSON.stringify(record, null, 2)); return record;
}

export function evaluateDelivery(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature); const spec = readText(specificationPath(target, state)) || ""; const tasks = readText(tasksPath(target, state)) || ""; const verification = readJson(verificationPath(target, state));
  const criteria = acceptanceCriteria(spec); const taskText = taskIds(tasks); const uncovered = criteria.filter((criterion) => !tasks.includes(criterion)); const evaluation = { schema: "osd-evaluation/v2", feature: state.feature, evaluated_at: now(), acceptance_criteria: criteria, task_ids: taskText, uncovered_acceptance_criteria: uncovered, verification_exit_code: verification?.exit_code ?? null, passed: criteria.length > 0 && uncovered.length === 0 && verification?.exit_code === 0 };
  writeJson(evaluationPath(target, state), evaluation); output(JSON.stringify(evaluation, null, 2)); return evaluation;
}

export function summarizeDelivery(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state, path, archived } = loadState(target, options.feature); const root = dirname(path); const verification = readJson(join(root, "verification.json")); const review = readJson(join(root, "review.json")); const events = fileExists(join(root, "events.jsonl")) ? readFileSync(join(root, "events.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).length : 0;
  const unitTest = verification?.checks?.find((check) => check.id === "unit_test");
  const summary = `# Delivery Summary: ${state.feature}\n\n- Status: ${state.status}\n- Stage: ${state.stage}\n- Mode: ${state.mode}\n- Mode score: ${state.mode_decision?.score ?? "not recorded"}\n- Strategy: ${state.strategy}\n- Specification backend: ${state.specification_backend}\n- Unit test: ${unitTest?.status ?? "not run"}\n- Verification exit code: ${verification?.exit_code ?? "not run"}\n- Review: ${review?.result ?? "not recorded"}\n- Runtime events: ${events}\n- Archived: ${archived}\n- Fallback stages: ${state.fallback_stages.join(", ") || "none"}\n`;
  writeText(join(root, "summary.md"), summary); output(summary); return summary;
}

function commandArgs(command) { return process.platform === "win32" ? ["cmd.exe", ["/d", "/s", "/c", command]] : ["sh", ["-lc", command]]; }
function commandSummary(result, fallback) { return redactSensitive(String(result.status === 0 ? result.stdout || fallback : result.stderr || result.stdout || fallback).trim().slice(0, 2000)); }
function unitTestRequired(config, state) {
  const requiredFor = config?.quality_gates?.unit_test?.required_for;
  return Array.isArray(requiredFor) && requiredFor.includes(state.mode);
}
function runVerificationCheck({ id, label, command, required, target, spawn, executed }) {
  if (!command) return { id, label, required, command: null, status: required ? "failed" : "not_configured", exit_code: required ? 1 : null, summary: required ? `${label} is required but no command is configured.` : `${label} is part of the OSD flow but is not configured for this project.` };
  if (executed.has(command)) {
    const previous = executed.get(command);
    return { id, label, required, command: redactSensitive(command), status: previous.exit_code === 0 ? "passed" : "failed", exit_code: previous.exit_code, summary: previous.summary, reused_from: previous.id };
  }
  const [executable, args] = commandArgs(command);
  const result = spawn(executable, args, { cwd: target, encoding: "utf8", shell: false, windowsHide: true });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const check = { id, label, required, command: redactSensitive(command), status: exitCode === 0 ? "passed" : "failed", exit_code: exitCode, summary: commandSummary({ ...result, status: exitCode }, `${label} ${exitCode === 0 ? "passed" : "failed"}`) };
  executed.set(command, check);
  return check;
}
export function verifyDelivery(options, { output = console.log, spawn = nodeSpawnSync } = {}) {
  const target = resolve(options.target || "."); const config = loadProject(target); const { state } = loadState(target, options.feature); requireStage(state, ["verification"], "verify"); requireFile(specificationPath(target, state), "Specification");
  const command = detectVerificationCommand(target, config); if (!command) throw new Error("No verification command is configured. Set commands.verify in .osd/config.json.");
  const executed = new Map();
  const unitCommand = detectUnitTestCommand(target, config);
  const unitFallback = !unitCommand && config?.quality_gates?.unit_test?.fallback_to_verify !== false;
  const checks = [
    runVerificationCheck({ id: "unit_test", label: "Unit tests", command: config?.quality_gates?.unit_test?.enabled === false ? null : unitCommand || (unitFallback ? command : null), required: unitTestRequired(config, state), target, spawn, executed }),
    runVerificationCheck({ id: "verify", label: "Verification", command, required: true, target, spawn, executed }),
  ];
  if (unitFallback && checks[0].command) { checks[0].status = checks[0].exit_code === 0 ? "covered_by_verify" : "failed"; checks[0].fallback_to_verify = true; }
  const exitCode = checks.some((check) => check.required && check.exit_code !== 0) ? 1 : 0;
  const evidence = { schema: "osd-verification-evidence/v2", feature: state.feature, mode: state.mode, strategy: state.strategy, command: redactSensitive(command), exit_code: exitCode, checks, observed_at: now(), summary: checks.map((check) => `${check.label}: ${check.status}`).join("; "), specification: state.specification_path };
  writeJson(verificationPath(target, state), evidence);
  if (exitCode !== 0) { transition(state, "verification", "blocked"); saveState(target, state); output(`OSD verification failed for ${state.feature}.`); return { state, evidence, exitCode }; }
  transition(state, "review", "verified"); saveState(target, state); output(`OSD verification passed: ${state.feature} -> review`); return { state, evidence, exitCode };
}

export function reviewDelivery(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature); requireStage(state, ["review"], "review"); const result = options.reviewResult;
  if (!new Set(["pass", "fail", "partial"]).has(result)) throw new Error("review requires --result pass, fail, or partial.");
  const review = { schema: "osd-review/v1", feature: state.feature, result, summary: options.summary || "No summary supplied.", reviewed_at: now() }; writeJson(reviewPath(target, state), review);
  if (result !== "pass" && state.mode === "strict") { transition(state, "review", "blocked"); saveState(target, state); throw new Error("Strict deliveries require a passing review before archive."); }
  transition(state, "archive", result === "pass" ? "reviewed" : "partial"); saveState(target, state); output(`OSD review recorded: ${state.feature} -> archive`); return state;
}

function nativeArchive(target, feature, spawn) {
  const result = spawn("openspec", ["archive", feature, "--yes"], { cwd: target, encoding: "utf8", shell: false, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || "openspec archive failed").trim());
  const active = nativeChangeDirectory(target, feature); const archiveRoot = join(target, "openspec", "changes", "archive");
  const matches = readDir(archiveRoot).filter((name) => name.endsWith(`-${feature}`)).map((name) => join(archiveRoot, name)).filter((path) => existsSync(path));
  if (existsSync(active) || matches.length !== 1) throw new Error(`OpenSpec archive did not move ${feature} to one unambiguous native archive directory.`);
  return { command: `openspec archive ${feature} --yes`, output: String(result.stdout || "").trim(), archived_change_location: relative(target, matches[0]).replaceAll("\\", "/") };
}
export function archiveDelivery(options, { output = console.log, spawn = nodeSpawnSync } = {}) {
  const target = resolve(options.target || "."); const { state } = loadState(target, options.feature); requireStage(state, ["archive"], "archive"); requireFile(verificationPath(target, state), "Verification evidence");
  const verification = readJson(verificationPath(target, state)); if (verification.exit_code !== 0) throw new Error("Archive requires passing verification evidence.");
  if (state.mode === "strict") { const review = readJson(reviewPath(target, state)); if (review?.result !== "pass") throw new Error("Strict deliveries require passing review evidence."); }
  if (state.mode === "strict") { const evaluation = readJson(evaluationPath(target, state)); if (!evaluation?.passed) throw new Error("Strict deliveries require a passing acceptance-criteria evaluation."); }
  let archive = { adapter: "osd.markdown-archive", command: null };
  if (state.specification_backend === "openspec") archive = { adapter: "openspec", ...nativeArchive(target, state.feature, spawn) };
  const source = stateDirectory(target, state.feature); const archiveDir = join(target, ARCHIVE_ROOT, `${new Date().toISOString().slice(0, 10)}-${state.feature}`); mkdirSync(dirname(archiveDir), { recursive: true });
  transition(state, "complete", "archived"); state.archive = { ...archive, archived_at: now() }; writeJson(join(source, "archive.json"), state.archive); saveState(target, state); renameSync(source, archiveDir); output(`OSD delivery archived: ${relative(target, archiveDir).replaceAll("\\", "/")}`); return { state, archiveDir };
}

export function rollbackDelivery(options, { output = console.log } = {}) {
  const target = resolve(options.target || ".");
  ensureFeature(options.feature);
  const { state, archived } = loadState(target, options.feature);

  // Cannot rollback from complete or archived
  if (state.stage === "complete" || archived) {
    throw new Error("Cannot rollback a completed or archived delivery.");
  }

  const targetStage = options.toStage;
  const validStages = WORKFLOW_STAGES.map(s => s[0]);
  if (!validStages.includes(targetStage)) {
    throw new Error(`Invalid target stage: ${targetStage}. Valid stages: ${validStages.join(", ")}.`);
  }

  const currentIndex = validStages.indexOf(state.stage);
  const targetIndex = validStages.indexOf(targetStage);

  if (currentIndex === -1) {
    throw new Error(`Current stage "${state.stage}" is not in the workflow stage list.`);
  }
  if (targetIndex >= currentIndex) {
    throw new Error(`Cannot rollback to ${targetStage}: must be an earlier stage than current stage ${state.stage}.`);
  }

  // Determine appropriate status for the target stage
  const statusMap = {
    specification: "draft",
    planning: "approved",
    implementation: "planned",
    verification: "implemented",
    review: "verified",
    archive: "reviewed",
  };
  const rollbackStatus = statusMap[targetStage] || "rolled_back";

  transition(state, targetStage, rollbackStatus);
  // Add a rollback-specific history marker for clarity
  state.history[state.history.length - 1].rollback = true;
  state.history[state.history.length - 1].from_stage = validStages[currentIndex];

  saveState(target, state);

  // Append a rollback event using the standard events path
  try {
    appendJsonLine(eventsPath(target, state), {
      schema: "osd-run-event/v2",
      event_type: "rollback",
      from_stage: validStages[currentIndex],
      to_stage: targetStage,
      timestamp: now(),
    });
  } catch { /* event recording is best-effort */ }

  output(`OSD rollback: ${state.feature} ${validStages[currentIndex]} -> ${targetStage}`);
  output(`Note: Artifacts from later stages remain on disk. Re-running stages will overwrite them.`);
  return state;
}

export function statusDelivery(options, { output = console.log } = {}) {
  const target = resolve(options.target || "."); const { state, archived } = loadState(target, options.feature); const result = { feature: state.feature, stage: state.stage, status: state.status, archived, mode: state.mode, mode_decision: state.mode_decision, strategy: state.strategy, adapters: state.adapters, fallback_stages: state.fallback_stages };
  output(JSON.stringify(result, null, 2)); return result;
}

export function doctorProject(options, { output = console.log, env = process.env, spawn = nodeSpawnSync } = {}) {
  const target = resolve(options.target || ".");
  const config = readJson(join(target, CONFIG_PATH));
  const configValidation = config ? (typeof validateConfig === "function" ? validateConfig(config) : configStatus(config)) : { ok: false, errors: ["missing config"] };
  const configCheck = configValidation.ok ? { ok: true, detail: "osd.config/v2" } : { ok: false, detail: configValidation.errors?.join("; ") || "invalid config" };
  const capabilities = detectCapabilities(target, config, { env, spawn });
  const configuredAgents = Array.isArray(config?.agents) ? config.agents : [];
  const agents = configuredAgents.map((agent) => ({ agent, present: Boolean(AGENT_DETAILS[agent] && existsSync(join(target, AGENT_DETAILS[agent].destination))) }));
  const adapters = resolveWorkflowAdapters(config || defaultConfig(), capabilities);

  // Check active changes
  const changesDir = join(target, CHANGE_ROOT);
  const changeFeatures = existsSync(changesDir) ? readdirSync(changesDir).filter(f => {
    try { return statSync(join(changesDir, f)).isDirectory(); } catch { return false; }
  }) : [];

  const changeResults = changeFeatures.map(feature => {
    const statePath = join(changesDir, feature, "state.json");
    if (!existsSync(statePath)) return { feature, valid: false, error: "missing state.json" };
    try {
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      if (typeof validateState === "function") {
        const v = validateState(state);
        return { feature, stage: state.stage, status: state.status, valid: v.ok, error: v.ok ? null : v.errors.join("; ") };
      }
      return { feature, stage: state.stage, status: state.status, valid: true, error: null };
    } catch (e) {
      return { feature, valid: false, error: e.message };
    }
  });

  const validChanges = changeResults.filter(c => c.valid);
  const corruptedChanges = changeResults.filter(c => !c.valid);

  // Check archives
  const archiveDir = join(target, ARCHIVE_ROOT);
  const archiveCount = existsSync(archiveDir) ? readdirSync(archiveDir).filter(f => {
    try { return statSync(join(archiveDir, f)).isDirectory(); } catch { return false; }
  }).length : 0;

  const changesOk = corruptedChanges.length === 0;
  const healthy = configCheck.ok && agents.every((agent) => agent.present) && adapters.every((adapter) => adapter.status !== "unresolved") && changesOk;

  const report = { target, healthy, config: configCheck, agents, capabilities, adapters, changes: { total: changeResults.length, valid: validChanges.length, corrupted: corruptedChanges.length, features: changeResults }, archives: archiveCount };

  output(`OSD doctor: ${target}`);
  output(`  config: ${configCheck.ok ? "ok" : "problem"} (${configCheck.detail})`);
  output(`  OpenSpec: ${capabilities.openspec.available && capabilities.openspec.workspace ? "available" : "unavailable"} (${capabilities.openspec.detail}; workspace ${capabilities.openspec.workspace ? "present" : "missing"})`);
  output(`  Superpowers: ${capabilities.superpowers.available ? "available" : "unavailable"} (${capabilities.superpowers.detail})`);
  output(`  verification command: ${capabilities.verificationCommand.detail}`);
  output(`  unit test command: ${capabilities.unitTestCommand.detail}`);
  for (const agent of agents) output(`  Agent rule ${agent.agent}: ${agent.present ? "present" : "missing"}`);
  for (const adapter of adapters) output(`  ${adapter.stage}: ${adapter.selected || "unresolved"} (${adapter.status}${adapter.fallbackUsed ? ", fallback used" : ""})`);
  output(`  Active changes: ${changeResults.length} total, ${validChanges.length} valid, ${corruptedChanges.length} corrupted`);
  if (corruptedChanges.length > 0) {
    for (const c of corruptedChanges) output(`    CORRUPTED: ${c.feature} - ${c.error}`);
  }
  for (const c of validChanges) output(`    ${c.feature}: ${c.stage || "?"}/${c.status || "?"}`);
  output(`  Archived deliveries: ${archiveCount}`);

  return report;
}

export function listAdapters(options, { output = console.log, env = process.env, spawn = nodeSpawnSync } = {}) {
  const target = resolve(options.target || "."); const config = readJson(join(target, CONFIG_PATH)); const capabilities = detectCapabilities(target, config, { env, spawn }); const adapters = [
    ["openspec", capabilities.openspec.available && capabilities.openspec.workspace, "native specification/archive"], ["superpowers.writing-plans", capabilities.superpowers.available, "native planning"], ["superpowers.tdd", capabilities.superpowers.available, "native implementation"], ["superpowers.verification", capabilities.superpowers.available, "native verification"], ["superpowers.review", capabilities.superpowers.available, "native review"], ["osd.markdown-spec", true, "fallback specification"], ["osd.minimal-plan", true, "fallback planning"], ["agent-native", true, "fallback implementation"], ["unit-test-command", capabilities.unitTestCommand.available, capabilities.unitTestCommand.detail], ["command", capabilities.verificationCommand.available, capabilities.verificationCommand.detail], ["agent-review", true, "fallback review"], ["osd.markdown-archive", true, "fallback archive"],
  ].map(([name, available, detail]) => ({ name, available, detail })); output(`OSD adapters: ${target}`); for (const adapter of adapters) output(`  ${adapter.available ? "available  " : "unavailable"} ${adapter.name} - ${adapter.detail}`); return adapters;
}

export async function run(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv); if (options.help) { console.log(usage()); return 0; }
    if (options.version) { const pkg = readJson(join(PACKAGE_ROOT, "package.json")); console.log(pkg?.version || "2.0.0"); return 0; }
    if (options.command === "rollback" && !options.toStage) throw new Error("rollback requires --to <stage>.");
    if (options.command === "init") { await initProject(options); return 0; }
    if (options.command === "doctor") return doctorProject(options).healthy ? 0 : 1;
    if (options.command === "adapters") { listAdapters(options); return 0; }
    if (options.command === "config") { configProject(options); return 0; }
    if (options.command === "upgrade") { await upgradeProject(options); return 0; }
    if (options.command === "start") { startDelivery(options); return 0; }
    if (options.command === "approve") { approveDelivery(options); return 0; }
    if (options.command === "plan") { planDelivery(options); return 0; }
    if (options.command === "implement") { beginImplementation(options); return 0; }
    if (options.command === "verify") return verifyDelivery(options).exitCode;
    if (options.command === "review") { reviewDelivery(options); return 0; }
    if (options.command === "rollback") { rollbackDelivery(options); return 0; }
    if (options.command === "context") { createTaskContext(options); return 0; }
    if (options.command === "authorize") { authorizeAction(options); return 0; }
    if (options.command === "event") { recordEvent(options); return 0; }
    if (options.command === "evaluate") { evaluateDelivery(options); return 0; }
    if (options.command === "summarize") { summarizeDelivery(options); return 0; }
    if (options.command === "archive") { archiveDelivery(options); return 0; }
    if (options.command === "status") { statusDelivery(options); return 0; }
    throw new Error(`Unknown command: ${options.command}`);
  } catch (error) { console.error(`OSD error: ${error.message}`); console.error(usage()); return 1; }
}
