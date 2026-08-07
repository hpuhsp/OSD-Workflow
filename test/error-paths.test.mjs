import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPath = join(projectRoot, "bin", "osd-workflow-init.mjs");

function tempProject(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }
function run(...args) { return execFileSync(process.execPath, [cliPath, ...args], { encoding: "utf8" }); }

// ===== STAGE GATE ERRORS =====

test("approve is rejected when not in specification stage", (t) => {
  const target = tempProject("osd-err-gate-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "err-gate", target, "--adapter", "fallback");
  run("approve", "err-gate", target); // advance to planning
  // approve again should fail
  assert.throws(() => run("approve", "err-gate", target), /not allowed while stage is/);
});

test("verify is rejected when not in verification stage", (t) => {
  const target = tempProject("osd-err-ver-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "err-ver", target, "--adapter", "fallback");
  assert.throws(() => run("verify", "err-ver", target), /not allowed while stage is/);
});

test("archive is rejected when not in archive stage", (t) => {
  const target = tempProject("osd-err-arch-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "err-arch", target, "--adapter", "fallback");
  assert.throws(() => run("archive", "err-arch", target), /not allowed while stage is/);
});

// ===== FEATURE NAME ERRORS =====

test("start rejects empty feature name", (t) => {
  const target = tempProject("osd-err-name-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  assert.throws(() => run("start", "", target), /Error/);
});

test("start rejects feature with special characters", (t) => {
  const target = tempProject("osd-err-spec-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  assert.throws(() => run("start", "../escape", target), /Error/);
});

// ===== DUPLICATE START =====

test("start rejects duplicate feature name", (t) => {
  const target = tempProject("osd-err-dup-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "err-dup", target, "--adapter", "fallback");
  assert.throws(() => run("start", "err-dup", target, "--adapter", "fallback"), /already exists/);
});

// ===== NONEXISTENT FEATURE =====

test("status reports error for nonexistent feature", (t) => {
  const target = tempProject("osd-err-nofeat-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  assert.throws(() => run("status", "nonexistent", target), /No OSD delivery found/);
});

// ===== INVALID ARGUMENTS =====

test("parseArgs rejects unknown options", (t) => {
  const target = tempProject("osd-err-opt-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  assert.throws(() => run("start", "err-opt", target, "--bogus"), /Unknown option/);
});

test("review requires --result flag", (t) => {
  const target = tempProject("osd-err-rev-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  assert.throws(() => run("review", "some-feature", target), /Error/);
});

// ===== CONFIG ERRORS =====

test("config get rejects unsafe key", (t) => {
  const target = tempProject("osd-err-config-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  assert.throws(() => run("config", "get", "__proto__", "--target", target), /Unsafe config key/);
});

// ===== VERIFY FAILURE PATH =====

test("verify with failing command sets state to blocked", (t) => {
  const target = tempProject("osd-err-vfail-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  const configPath = join(target, ".osd", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.commands.verify = "exit 1";
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  run("start", "err-vfail", target, "--adapter", "fallback");
  run("approve", "err-vfail", target);
  run("plan", "err-vfail", target);
  run("implement", "err-vfail", target);
  // verify should fail (exit code 1)
  assert.throws(() => run("verify", "err-vfail", target), /Error/);
  // status should show blocked
  const statePath = join(target, ".osd", "changes", "err-vfail", "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(state.status, "blocked");
});

// ===== ADAPTER ERRORS =====

test("start with openspec adapter rejects when openspec unavailable", (t) => {
  const target = tempProject("osd-err-adapt-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  assert.throws(() => run("start", "err-adapt", target, "--adapter", "openspec"), /Error/);
});
