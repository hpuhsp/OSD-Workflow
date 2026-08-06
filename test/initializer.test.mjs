import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  defaultConfig,
  detectCapabilities,
  doctorProject,
  mergeManagedAgentRule,
  parseArgs,
  resolveWorkflowAdapters,
} from "../bin/osd-workflow-init.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPath = join(projectRoot, "bin", "osd-workflow-init.mjs");

function tempProject(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function run(...args) {
  return execFileSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

test("parseArgs supports init defaults and non-interactive options", () => {
  const options = parseArgs(["target-project", "--agents", "qoder,trae", "--yes", "--dry-run"]);
  assert.equal(options.command, "init");
  assert.equal(options.target, "target-project");
  assert.deepEqual(options.agents, ["qoder", "trae"]);
  assert.equal(options.yes, true);
  assert.equal(options.dryRun, true);
});

test("parseArgs supports doctor and adapters list", () => {
  assert.deepEqual(parseArgs(["doctor", "project"]), {
    command: "doctor", subcommand: null, target: "project", agents: null, yes: false, dryRun: false, help: false,
  });
  const adapters = parseArgs(["adapters", "list", "--target", "project"]);
  assert.equal(adapters.command, "adapters");
  assert.equal(adapters.subcommand, "list");
  assert.equal(adapters.target, "project");
});

test("parseArgs rejects duplicate targets and unknown Agent targets", () => {
  assert.throws(() => parseArgs(["first", "--target", "second"]), /Specify the target only once/);
  assert.throws(() => parseArgs(["--agents", "unknown"]), /Unknown agent target/);
});

test("init creates only OSD state and selected Agent rules", (t) => {
  const target = tempProject("osd-v2-init-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");

  run("init", target, "--agents", "qoder,cursor", "--yes");

  const config = JSON.parse(readFileSync(join(target, ".osd", "config.json"), "utf8"));
  assert.equal(config.schema, "osd.config/v2");
  assert.equal(config.native_first, true);
  assert.equal(config.dynamic_routing, true);
  assert.equal(config.fallback_allowed, true);
  assert.equal(config.commands.verify, "npm test");
  assert.deepEqual(Object.keys(config.workflow), ["specification", "planning", "implementation", "verification", "review", "archive"]);
  assert.equal(existsSync(join(target, ".osd", "rules", "workflow.md")), true);
  assert.equal(existsSync(join(target, ".qoder", "rules", "osd-workflow.md")), true);
  assert.equal(existsSync(join(target, ".cursor", "rules", "osd-workflow", "RULE.md")), true);
  for (const absent of ["AGENTS.md", ".ai", "openspec", "knowledge", "scripts", "GEMINI.md"]) {
    assert.equal(existsSync(join(target, absent)), false, `${absent} must not be generated`);
  }
});

test("init is non-blocking without Agent selections", (t) => {
  const target = tempProject("osd-v2-noninteractive-");
  t.after(() => rmSync(target, { recursive: true, force: true }));

  run("init", target, "--yes");

  assert.equal(existsSync(join(target, ".osd", "config.json")), true);
  assert.equal(existsSync(join(target, "AGENTS.md")), false);
  assert.equal(existsSync(join(target, ".qoder")), false);
});

test("agent rule merge preserves user content and never duplicates managed block", (t) => {
  const target = tempProject("osd-v2-agent-merge-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  const rulePath = join(target, ".qoder", "rules", "osd-workflow.md");
  mkdirSync(join(target, ".qoder", "rules"), { recursive: true });
  writeFileSync(rulePath, "---\ndescription: \"User rule\"\n---\n# Local instructions\nKeep this content.\n", { encoding: "utf8", flag: "w" });

  run("init", target, "--agents", "qoder", "--yes");
  run("init", target, "--agents", "qoder", "--yes");

  const content = readFileSync(rulePath, "utf8");
  assert.match(content, /Keep this content/);
  assert.match(content, /\.osd\/rules\/workflow\.md/);
  assert.equal((content.match(/<!-- osd-workflow:start -->/g) || []).length, 1);
  assert.equal((content.match(/<!-- osd-workflow:end -->/g) || []).length, 1);
});

test("dry-run reports the plan without writing files", (t) => {
  const target = tempProject("osd-v2-dry-run-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  const output = run("init", target, "--agents", "gemini", "--yes", "--dry-run");
  assert.match(output, /created/);
  assert.equal(existsSync(join(target, ".osd", "config.json")), false);
  assert.equal(existsSync(join(target, "GEMINI.md")), false);
});

test("adapter resolution prefers native integrations and reports fallbacks", () => {
  const config = defaultConfig({ verifyCommand: "npm test" });
  const native = resolveWorkflowAdapters(config, {
    openspec: { available: true }, superpowers: { available: true }, verificationCommand: { available: true },
  });
  assert.equal(native.every((entry) => entry.status === "native"), true);

  const fallback = resolveWorkflowAdapters(config, {
    openspec: { available: false }, superpowers: { available: false }, verificationCommand: { available: true },
  });
  assert.deepEqual(fallback.map((entry) => entry.selected), ["osd.markdown-spec", "osd.minimal-plan", "agent-native", "command", "agent-review", "osd.markdown-archive"]);
  assert.equal(fallback.every((entry) => entry.fallbackUsed), true);
});

test("doctor reports config, Agent rule, capabilities, verification command, and adapter resolution", (t) => {
  const target = tempProject("osd-v2-doctor-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
  run("init", target, "--agents", "qoder", "--yes");
  const lines = [];
  const report = doctorProject({ target }, {
    output: (line) => lines.push(line),
    env: { OSD_OPENSPEC_AVAILABLE: "true", OSD_SUPERPOWERS_AVAILABLE: "true" },
  });
  assert.equal(report.config.ok, true);
  assert.deepEqual(report.agents, [{ agent: "qoder", present: true }]);
  assert.equal(report.capabilities.verificationCommand.detail, "npm test");
  assert.equal(report.adapters.length, 6);
  assert.equal(report.adapters.every((entry) => entry.status === "native"), true);
  assert.match(lines.join("\n"), /OpenSpec: available/);
});

test("capability detection accepts explicit native availability", () => {
  const capabilities = detectCapabilities(process.cwd(), null, {
    env: { OSD_OPENSPEC_AVAILABLE: "yes", OSD_SUPERPOWERS_AVAILABLE: "1" },
    spawn: () => ({ status: 1 }),
  });
  assert.equal(capabilities.openspec.available, true);
  assert.equal(capabilities.superpowers.available, true);
});

test("managed block helper replaces only the OSD section", () => {
  const first = mergeManagedAgentRule("# User note\n", "OSD first");
  const next = mergeManagedAgentRule(first, "OSD second");
  assert.match(next, /# User note/);
  assert.match(next, /OSD second/);
  assert.equal((next.match(/osd-workflow:start/g) || []).length, 1);
});
