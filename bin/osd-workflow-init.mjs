#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync as nodeSpawnSync } from "node:child_process";

const CONFIG_PATH = join(".osd", "config.json");
const WORKFLOW_RULE_PATH = join(".osd", "rules", "workflow.md");
const MANAGED_START = "<!-- osd-workflow:start -->";
const MANAGED_END = "<!-- osd-workflow:end -->";

export const AGENT_TARGETS = ["qoder", "claude", "gemini", "trae", "cursor"];
const AGENT_DETAILS = {
  qoder: { destination: join(".qoder", "rules", "osd-workflow.md"), frontmatter: { description: "OSD workflow orchestration", trigger: "model_decision", alwaysApply: false } },
  claude: { destination: join(".claude", "rules", "osd-workflow.md"), frontmatter: { description: "OSD workflow orchestration" } },
  gemini: { destination: "GEMINI.md", frontmatter: null },
  trae: { destination: join(".trae", "rules", "osd-workflow.md"), frontmatter: { description: "OSD workflow orchestration" } },
  cursor: { destination: join(".cursor", "rules", "osd-workflow", "RULE.md"), frontmatter: { description: "OSD workflow orchestration", alwaysApply: false } },
};

export const WORKFLOW_STAGES = [
  ["specification", "openspec", "osd.markdown-spec"],
  ["planning", "superpowers.writing-plans", "osd.minimal-plan"],
  ["implementation", "superpowers.tdd", "agent-native"],
  ["verification", "superpowers.verification", "command"],
  ["review", "superpowers.review", "agent-review"],
  ["archive", "openspec", "osd.markdown-archive"],
];

function workflowConfig() {
  return Object.fromEntries(WORKFLOW_STAGES.map(([stage, preferred, fallback]) => [stage, { preferred, fallback }]));
}

export function defaultConfig({ agents = [], verifyCommand = null } = {}) {
  return {
    schema: "osd.config/v2",
    native_first: true,
    dynamic_routing: true,
    fallback_allowed: true,
    agents,
    workflow: workflowConfig(),
    governance: {
      require_specification_for_nontrivial_work: true,
      require_verification_evidence: true,
      require_review_for_high_risk_changes: true,
    },
    commands: { verify: verifyCommand },
  };
}

function usage() {
  return `OSD 2.0 native-first workflow orchestrator

Usage:
  osd init [target] [--agents <targets>] [--yes] [--dry-run]
  osd doctor [target]
  osd adapters list [target]

Options:
  --agents <targets>  qoder, claude, gemini, trae, cursor, all, none, or auto
  --yes               Accept detected defaults without prompting
  --dry-run           Show planned changes without writing files
  --target <path>     Project directory (alternative to positional target)
  -h, --help          Show this help
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

export function parseArgs(argv) {
  const result = { command: "init", subcommand: null, target: null, agents: null, yes: false, dryRun: false, help: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--agents") result.agents = parseAgents(argv[++index]);
    else if (argument.startsWith("--agents=")) result.agents = parseAgents(argument.slice(9));
    else if (argument === "--target") result.target = argv[++index];
    else if (argument.startsWith("--target=")) result.target = argument.slice(9);
    else if (argument === "--yes" || argument === "-y") result.yes = true;
    else if (argument === "--dry-run") result.dryRun = true;
    else if (argument === "--help" || argument === "-h") result.help = true;
    else if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    else positional.push(argument);
  }
  if (["init", "doctor", "adapters"].includes(positional[0])) result.command = positional.shift();
  if (result.command === "adapters") result.subcommand = positional.shift() || "list";
  if (positional.length > 1 || (result.target && positional.length)) throw new Error("Specify the target only once.");
  if (!result.target && positional.length) result.target = positional[0];
  if (result.command === "adapters" && result.subcommand !== "list") throw new Error(`Unknown adapters command: ${result.subcommand}`);
  return result;
}

function printBanner(output = console.log) {
  output("+----------------------------------------+");
  output("| OSD 2.0  native-first workflow setup   |");
  output("+----------------------------------------+");
}

function readText(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function readJson(path) {
  const text = readText(path);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function writeText(path, content, dryRun) {
  const previous = readText(path);
  if (previous === content) return "skipped";
  if (!dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }
  return previous === null ? "created" : "updated";
}

function splitLeadingFrontmatter(content) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? { body: content.slice(match[0].length) } : { body: content };
}

function formatFrontmatter(frontmatter) {
  if (!frontmatter) return "";
  return `---\n${Object.entries(frontmatter).map(([key, value]) => `${key}: ${typeof value === "string" ? JSON.stringify(value) : value}`).join("\n")}\n---\n`;
}

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
  return `# OSD 2.0 Workflow

OSD is a native-first orchestrator. Read \`.osd/config.json\` before changing the project and follow its workflow, governance, and command settings.

For each stage, use the configured preferred adapter when it is available. Otherwise use the configured fallback only when \`fallback_allowed\` is true, and record that fallback in task evidence.

Route task weight at runtime through \`dynamic_routing\`; initialization does not install workflow tiers or presets.

\`OSD: <task_type> | <mode> | <strategy> | <stage> | <adapters>\`
`;
}

function renderAgentRule(agent) {
  return `# OSD 2.0 for ${agent}

Use the project workflow in \`.osd/rules/workflow.md\`. Prefer the Agent's native capability over an OSD fallback whenever it is available.
`;
}

export function detectConfiguredAgents(target) {
  return AGENT_TARGETS.filter((agent) => existsSync(join(target, AGENT_DETAILS[agent].destination)));
}

export function detectVerificationCommand(target, config = null) {
  const configured = config?.commands?.verify;
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  if (Array.isArray(configured) && configured.length) return configured.join(" ");
  const packageJson = readJson(join(target, "package.json"));
  if (packageJson?.scripts?.test) return "npm test";
  if (existsSync(join(target, "pnpm-lock.yaml"))) return "pnpm test";
  if (existsSync(join(target, "yarn.lock"))) return "yarn test";
  return null;
}

function executableExists(command, spawn = nodeSpawnSync) {
  const candidates = process.platform === "win32" ? [command, `${command}.cmd`] : [command];
  return candidates.some((candidate) => {
    const result = spawn(candidate, ["--version"], { stdio: "ignore", windowsHide: true });
    return !result.error && result.status === 0;
  });
}

export function detectCapabilities(target, config = null, { env = process.env, spawn = nodeSpawnSync } = {}) {
  const openspecCommand = env.OSD_OPENSPEC_COMMAND || "openspec";
  const openspecAvailable = ["1", "true", "yes"].includes(String(env.OSD_OPENSPEC_AVAILABLE || "").toLowerCase()) || executableExists(openspecCommand, spawn);
  const superpowersPaths = [join(target, ".superpowers"), join(target, ".agents", "skills", "superpowers"), join(target, ".codex", "skills", "superpowers"), join(target, ".claude", "skills", "superpowers")];
  const superpowersAvailable = ["1", "true", "yes"].includes(String(env.OSD_SUPERPOWERS_AVAILABLE || "").toLowerCase()) || superpowersPaths.some(existsSync);
  const verificationCommand = detectVerificationCommand(target, config);
  return {
    openspec: { available: openspecAvailable, detail: openspecAvailable ? openspecCommand : "not found" },
    superpowers: { available: superpowersAvailable, detail: superpowersAvailable ? "skill available" : "not found" },
    verificationCommand: { available: Boolean(verificationCommand), detail: verificationCommand || "not configured" },
  };
}

function adapterAvailable(adapter, capabilities) {
  if (adapter === "openspec") return capabilities.openspec.available;
  if (adapter.startsWith("superpowers.")) return capabilities.superpowers.available;
  if (adapter === "command") return capabilities.verificationCommand.available;
  return true;
}

export function resolveWorkflowAdapters(config, capabilities) {
  const fallbackAllowed = config?.fallback_allowed !== false;
  return WORKFLOW_STAGES.map(([stage, defaultPreferred, defaultFallback]) => {
    const stageConfig = config?.workflow?.[stage] || {};
    const preferred = stageConfig.preferred || defaultPreferred;
    const fallback = stageConfig.fallback || defaultFallback;
    if (adapterAvailable(preferred, capabilities)) return { stage, preferred, fallback, selected: preferred, status: "native", fallbackUsed: false, reason: "preferred adapter available" };
    if (fallbackAllowed && adapterAvailable(fallback, capabilities)) return { stage, preferred, fallback, selected: fallback, status: "fallback", fallbackUsed: true, reason: `${preferred} unavailable` };
    return { stage, preferred, fallback, selected: null, status: "unresolved", fallbackUsed: false, reason: `${preferred} unavailable; fallback unavailable or disabled` };
  });
}

function mergeConfig(existing, agents, verifyCommand) {
  const defaults = defaultConfig({ agents, verifyCommand });
  const base = existing && typeof existing === "object" ? existing : {};
  return {
    ...defaults,
    ...base,
    schema: "osd.config/v2",
    agents,
    workflow: { ...defaults.workflow, ...(base.workflow || {}) },
    governance: { ...defaults.governance, ...(base.governance || {}) },
    commands: { ...defaults.commands, ...(base.commands || {}) },
  };
}

async function chooseAgents(target, options) {
  if (options.agents !== null) return options.agents;
  const configured = detectConfiguredAgents(target);
  if (options.yes || !process.stdin.isTTY) return configured;
  console.log("Select Agent targets, comma-separated (Enter keeps detected targets):");
  console.log(`  ${AGENT_TARGETS.join(", ")}`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`Agents [${configured.join(", ") || "none"}]: `);
    return answer.trim() ? parseAgents(answer) : configured;
  } finally {
    prompt.close();
  }
}

function summarizeChanges(target, changes, output) {
  output(`OSD initialized in ${target}`);
  for (const change of changes) output(`  ${change.status.padEnd(7)} ${change.path}`);
  output("  Minimal project state only: .osd plus selected Agent rules.");
  output("  Next: osd doctor");
}

export async function initProject(options, { output = console.log } = {}) {
  const target = resolve(options.target || ".");
  printBanner(output);
  const agents = await chooseAgents(target, options);
  const configPath = join(target, CONFIG_PATH);
  const existingConfig = readJson(configPath);
  const config = mergeConfig(existingConfig, agents, detectVerificationCommand(target, existingConfig));
  const changes = [];
  const record = (path, content) => changes.push({ path: relative(target, path), status: writeText(path, content, options.dryRun) });
  record(configPath, `${JSON.stringify(config, null, 2)}\n`);
  record(join(target, WORKFLOW_RULE_PATH), renderWorkflowRule());
  for (const agent of agents) {
    const detail = AGENT_DETAILS[agent];
    const destination = join(target, detail.destination);
    record(destination, mergeManagedAgentRule(readText(destination) || "", renderAgentRule(agent), detail.frontmatter));
  }
  summarizeChanges(target, changes, output);
  return { target, config, agents, changes };
}

function configStatus(config) {
  if (!config) return { ok: false, detail: "missing or invalid JSON" };
  if (config.schema !== "osd.config/v2") return { ok: false, detail: `expected osd.config/v2, found ${config.schema || "none"}` };
  return { ok: true, detail: "osd.config/v2" };
}

export function doctorProject(options, { output = console.log, env = process.env, spawn = nodeSpawnSync } = {}) {
  const target = resolve(options.target || ".");
  const config = readJson(join(target, CONFIG_PATH));
  const configCheck = configStatus(config);
  const capabilities = detectCapabilities(target, config, { env, spawn });
  const configuredAgents = Array.isArray(config?.agents) ? config.agents : [];
  const agents = configuredAgents.map((agent) => ({ agent, present: Boolean(AGENT_DETAILS[agent] && existsSync(join(target, AGENT_DETAILS[agent].destination))) }));
  const adapters = resolveWorkflowAdapters(config || defaultConfig(), capabilities);
  const healthy = configCheck.ok && agents.every((agent) => agent.present) && adapters.every((adapter) => adapter.status !== "unresolved");
  const report = { target, healthy, config: configCheck, agents, capabilities, adapters };
  output(`OSD doctor: ${target}`);
  output(`  config: ${configCheck.ok ? "ok" : "problem"} (${configCheck.detail})`);
  output(`  OpenSpec: ${capabilities.openspec.available ? "available" : "unavailable"} (${capabilities.openspec.detail})`);
  output(`  Superpowers: ${capabilities.superpowers.available ? "available" : "unavailable"} (${capabilities.superpowers.detail})`);
  output(`  verification command: ${capabilities.verificationCommand.detail}`);
  for (const agent of agents) output(`  Agent rule ${agent.agent}: ${agent.present ? "present" : "missing"}`);
  for (const adapter of adapters) output(`  ${adapter.stage}: ${adapter.selected || "unresolved"} (${adapter.status}${adapter.fallbackUsed ? ", fallback used" : ""})`);
  return report;
}

export function listAdapters(options, { output = console.log, env = process.env, spawn = nodeSpawnSync } = {}) {
  const target = resolve(options.target || ".");
  const config = readJson(join(target, CONFIG_PATH));
  const capabilities = detectCapabilities(target, config, { env, spawn });
  const adapters = [
    ["openspec", capabilities.openspec.available, "native specification/archive"],
    ["superpowers.writing-plans", capabilities.superpowers.available, "native planning"],
    ["superpowers.tdd", capabilities.superpowers.available, "native implementation"],
    ["superpowers.verification", capabilities.superpowers.available, "native verification"],
    ["superpowers.review", capabilities.superpowers.available, "native review"],
    ["osd.markdown-spec", true, "fallback specification"],
    ["osd.minimal-plan", true, "fallback planning"],
    ["agent-native", true, "fallback implementation"],
    ["command", capabilities.verificationCommand.available, capabilities.verificationCommand.detail],
    ["agent-review", true, "fallback review"],
    ["osd.markdown-archive", true, "fallback archive"],
  ].map(([name, available, detail]) => ({ name, available, detail }));
  output(`OSD adapters: ${target}`);
  for (const adapter of adapters) output(`  ${adapter.available ? "available  " : "unavailable"} ${adapter.name} - ${adapter.detail}`);
  return adapters;
}

export async function run(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) { console.log(usage()); return 0; }
    if (options.command === "init") { await initProject(options); return 0; }
    if (options.command === "doctor") return doctorProject(options).healthy ? 0 : 1;
    if (options.command === "adapters") { listAdapters(options); return 0; }
    throw new Error(`Unknown command: ${options.command}`);
  } catch (error) {
    console.error(`OSD error: ${error.message}`);
    console.error(usage());
    return 1;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = await run();
