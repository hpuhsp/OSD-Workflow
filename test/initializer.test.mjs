import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  defaultConfig,
  approveDelivery,
  archiveDelivery,
  beginImplementation,
  detectCapabilities,
  evaluateAdaptiveMode,
  doctorProject,
  parseArgs,
  resolveWorkflowAdapters,
  recordEvent,
  reviewDelivery,
  startDelivery,
  verifyDelivery,
  planDelivery,
} from "../bin/osd-workflow-init.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPath = join(projectRoot, "bin", "osd-workflow-init.mjs");
const powerShellInstaller = join(projectRoot, "scripts", "install.ps1");

function tempProject(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function run(...args) {
  return execFileSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

function createProject(prefix) {
  const target = tempProject(prefix);
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  return target;
}

test("parseArgs supports the complete OSD 2.0 delivery command surface", () => {
  const start = parseArgs(["start", "login-fix", "--type", "bug_fix", "--mode", "lite", "--strategy", "test_first", "--scope", "module", "--risk", "auth,public_api", "--touches", "src/auth.js,openapi.yaml", "--adapter", "fallback"]);
  assert.equal(start.command, "start");
  assert.equal(start.feature, "login-fix");
  assert.equal(start.type, "bug_fix");
  assert.equal(start.mode, "lite");
  assert.equal(start.strategy, "test_first");
  assert.equal(start.scope, "module");
  assert.deepEqual(start.riskSignals, ["auth", "public_api"]);
  assert.deepEqual(start.touchedPaths, ["src/auth.js", "openapi.yaml"]);
  assert.equal(start.adapter, "fallback");
  assert.equal(parseArgs(["adapters", "list", "project"]).command, "adapters");
  assert.throws(() => parseArgs(["verify"]), /requires a feature name/);
});

test("published package declares a self-contained 2.0 runtime and excludes the legacy project template", () => {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
  assert.equal(packageJson.bin.osd, "./bin/osd-workflow-init.mjs");
  assert.equal(packageJson.files.includes("assets"), true);
  assert.equal(packageJson.files.includes("lib"), true);
  assert.equal(packageJson.files.includes(".ai"), false);
  assert.equal(existsSync(join(projectRoot, "assets", "workflow-rule.md")), true);
  assert.equal(existsSync(join(projectRoot, "assets", "osd-contract-v2.json")), true);
  assert.equal(existsSync(join(projectRoot, "assets", "runtime-governance-policy.json")), true);
});

test("init creates a small project contract and correct Agent rule formats", (t) => {
  const target = createProject("osd-v2-init-");
  t.after(() => rmSync(target, { recursive: true, force: true }));

  run("init", target, "--agents", "all", "--yes");

  const config = JSON.parse(readFileSync(join(target, ".osd", "config.json"), "utf8"));
  assert.equal(config.schema, "osd.config/v2");
  assert.equal(config.commands.verify, "npm test");
  assert.equal(config.commands.unitTest, null);
  assert.equal(config.quality_gates.unit_test.enabled, true);
  assert.equal(config.adaptive_mode.enabled, true);
  assert.equal(existsSync(join(target, ".osd", "rules", "workflow.md")), true);
  assert.equal(existsSync(join(target, ".qoder", "rules", "osd-workflow.md")), true);
  assert.equal(existsSync(join(target, ".claude", "rules", "osd-workflow.md")), true);
  assert.equal(readFileSync(join(target, "GEMINI.md"), "utf8"), "<!-- osd-workflow:start -->\n@.osd/rules/workflow.md\n<!-- osd-workflow:end -->\n");
  const trae = readFileSync(join(target, ".trae", "rules", "osd-workflow.md"), "utf8");
  const cursor = readFileSync(join(target, ".cursor", "rules", "osd-workflow.mdc"), "utf8");
  assert.match(trae, /^alwaysApply: false$/m);
  assert.match(cursor, /^description:/m);
  assert.match(cursor, /^alwaysApply: false$/m);
  for (const absent of ["AGENTS.md", ".ai", "openspec", "knowledge", "scripts"]) assert.equal(existsSync(join(target, absent)), false, `${absent} must not be generated`);
});

test("fallback delivery is executable and enforces specification, evidence, review, and archive gates", (t) => {
  const target = createProject("osd-v2-flow-");
  t.after(() => rmSync(target, { recursive: true, force: true }));

  run("init", target, "--agents", "qoder", "--yes");
  const configPath = join(target, ".osd", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.commands.verify = "echo verified";
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  run("start", "checkout", target, "--adapter", "fallback", "--mode", "standard", "--strategy", "tdd");
  assert.equal(existsSync(join(target, ".osd", "changes", "checkout", "artifacts", "spec.md")), true);
  assert.throws(() => verifyDelivery({ target, feature: "checkout" }, { output() {} }), /stage is specification/);

  run("approve", "checkout", target);
  run("plan", "checkout", target);
  run("implement", "checkout", target);
  run("verify", "checkout", target);
  const verification = JSON.parse(readFileSync(join(target, ".osd", "changes", "checkout", "verification.json"), "utf8"));
  assert.equal(verification.exit_code, 0);
  assert.equal(verification.checks.find((check) => check.id === "unit_test").status, "covered_by_verify");
  assert.equal(verification.checks.find((check) => check.id === "unit_test").fallback_to_verify, true);
  assert.equal(verification.checks.find((check) => check.id === "verify").status, "passed");
  run("review", "checkout", target, "--result", "pass", "--summary", "No regressions found.");
  run("archive", "checkout", target);
  const status = JSON.parse(run("status", "checkout", target));
  assert.equal(status.archived, true);
  assert.equal(status.status, "archived");
  assert.equal(existsSync(join(target, ".osd", "archive", "")), true);
});

test("adaptive mode scores task risk and records the reason in state", (t) => {
  const target = createProject("osd-v2-adaptive-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");
  run("start", "auth-session-hardening", target, "--type", "bug_fix", "--scope", "system", "--risk", "auth", "--touches", "src/auth/session.js", "--adapter", "fallback");
  const status = JSON.parse(run("status", "auth-session-hardening", target));
  assert.equal(status.mode, "strict");
  assert.equal(status.mode_decision.suggested, "strict");
  assert.equal(status.mode_decision.override, null);
  assert.ok(status.mode_decision.score >= 5);
  assert.equal(evaluateAdaptiveMode({ type: "maintenance", scope: "local", riskSignals: ["docs"] }).selected, "lite");
});

test("native OpenSpec is selected only when both CLI and workspace are available", (t) => {
  const target = createProject("osd-v2-native-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");
  mkdirSync(join(target, "openspec"), { recursive: true });
  const state = startDelivery({ target, feature: "native-change", type: "new_feature", mode: "auto", strategy: "auto", adapter: "auto" }, {
    env: { OSD_OPENSPEC_AVAILABLE: "true" },
    spawn: () => ({ status: 0 }),
    output() {},
  });
  assert.equal(state.specification_backend, "openspec");
  assert.equal(state.specification_path, "openspec/changes/native-change/spec.md");
});

test("native archive delegates to OpenSpec and requires the native change move", (t) => {
  const target = createProject("osd-v2-native-archive-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");
  const configPath = join(target, ".osd", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.commands.verify = "echo native";
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const nativeChange = join(target, "openspec", "changes", "native-archive");
  mkdirSync(nativeChange, { recursive: true });
  writeFileSync(join(nativeChange, "proposal.md"), "# Proposal\n", "utf8");
  writeFileSync(join(nativeChange, "spec.md"), "# Spec\n\n- AC-01: Native archive works.\n", "utf8");
  writeFileSync(join(nativeChange, "tasks.md"), "# Tasks\n\n- T-01: archive. Linked acceptance criteria: AC-01.\n", "utf8");
  startDelivery({ target, feature: "native-archive", type: "new_feature", mode: "standard", strategy: "tdd", adapter: "openspec" }, { env: { OSD_OPENSPEC_AVAILABLE: "true" }, spawn: () => ({ status: 0 }), output() {} });
  approveDelivery({ target, feature: "native-archive" }, { output() {} });
  planDelivery({ target, feature: "native-archive" }, { output() {} });
  beginImplementation({ target, feature: "native-archive" }, { output() {} });
  verifyDelivery({ target, feature: "native-archive" }, { output() {} });
  reviewDelivery({ target, feature: "native-archive", reviewResult: "pass", summary: "Native path checked." }, { output() {} });
  const result = archiveDelivery({ target, feature: "native-archive" }, {
    output() {},
    spawn(command, args) {
      assert.equal(command, "openspec");
      assert.deepEqual(args, ["archive", "native-archive", "--yes"]);
      const archived = join(target, "openspec", "changes", "archive", "2026-08-06-native-archive");
      mkdirSync(join(target, "openspec", "changes", "archive"), { recursive: true });
      renameSync(nativeChange, archived);
      return { status: 0, stdout: "archived" };
    },
  });
  assert.equal(existsSync(nativeChange), false);
  assert.equal(result.state.archive.adapter, "openspec");
  assert.equal(result.state.archive.archived_change_location, "openspec/changes/archive/2026-08-06-native-archive");
});

test("adapter routing and doctor expose native/fallback decisions", (t) => {
  const config = defaultConfig({ verifyCommand: "npm test" });
  const native = resolveWorkflowAdapters(config, {
    openspec: { available: true, workspace: true }, superpowers: { available: true }, verificationCommand: { available: true },
  });
  assert.equal(native.every((entry) => entry.status === "native"), true);
  const fallback = resolveWorkflowAdapters(config, {
    openspec: { available: false, workspace: false }, superpowers: { available: false }, verificationCommand: { available: true },
  });
  assert.deepEqual(fallback.map((entry) => entry.selected), ["osd.markdown-spec", "osd.minimal-plan", "agent-native", "command", "agent-review", "osd.markdown-archive"]);

  const target = createProject("osd-v2-doctor-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--agents", "qoder", "--yes");
  const lines = [];
  const report = doctorProject({ target }, { output: (line) => lines.push(line), env: { OSD_OPENSPEC_AVAILABLE: "true", OSD_SUPERPOWERS_AVAILABLE: "true" } });
  assert.equal(report.config.ok, true);
  assert.match(lines.join("\n"), /workspace missing/);
  assert.equal(detectCapabilities(target, null, { env: { OSD_OPENSPEC_AVAILABLE: "yes" }, spawn: () => ({ status: 1 }) }).openspec.available, true);
});

test("config get/set and upgrade keep the project contract usable", (t) => {
  const target = createProject("osd-v2-config-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--agents", "claude", "--yes");
  run("config", "set", "commands.verify", "echo configured", "--target", target);
  assert.equal(JSON.parse(run("config", "get", "commands.verify", "--target", target)), "echo configured");
  run("upgrade", target, "--yes");
  assert.equal(existsSync(join(target, ".claude", "rules", "osd-workflow.md")), true);
  assert.equal(existsSync(join(target, ".ai")), false);
});

test("runtime governance assets create task context, authorize configured commands, record safe events, and evaluate acceptance criteria", (t) => {
  const target = createProject("osd-v2-governance-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");
  const configPath = join(target, ".osd", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.commands.verify = "echo governed";
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  run("start", "runtime-check", target, "--adapter", "fallback", "--mode", "strict");
  run("context", "runtime-check", target, "--task", "T-01", "--role", "executor", "--owned-area", "src/check.js", "--isolated");
  const authorization = JSON.parse(run("authorize", "runtime-check", target, "--command-id", "verify", "--role", "executor", "--path", "src/check.js"));
  assert.equal(authorization.command_id, "verify");
  run("event", "runtime-check", target, "--event", "{\"event_type\":\"task_started\",\"status\":\"running\"}");
  assert.throws(() => recordEvent({ target, feature: "runtime-check", event: "{\"token\":\"do-not-store\"}" }, { output() {} }), /Event must be an object/);
  run("approve", "runtime-check", target);
  run("plan", "runtime-check", target);
  run("implement", "runtime-check", target);
  run("verify", "runtime-check", target);
  const evaluation = JSON.parse(run("evaluate", "runtime-check", target));
  assert.equal(evaluation.passed, true);
  run("review", "runtime-check", target, "--result", "pass");
  run("archive", "runtime-check", target);
  const summary = run("summarize", "runtime-check", target);
  assert.match(summary, /Archived: true/);
});

test("PowerShell installer delegates to the OSD 2.0 CLI", { skip: process.platform !== "win32" }, (t) => {
  const target = tempProject("osd-v2-powershell-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", powerShellInstaller, "-Target", target, "-Agents", "qoder", "-Yes"], { stdio: "pipe", env: { ...process.env, OSD_NODE: process.execPath } });
  assert.equal(existsSync(join(target, ".osd", "config.json")), true);
  assert.equal(existsSync(join(target, ".qoder", "rules", "osd-workflow.md")), true);
});
