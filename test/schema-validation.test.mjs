import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPath = join(projectRoot, "bin", "osd-workflow-init.mjs");

function tempProject(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }
function run(...args) { return execFileSync(process.execPath, [cliPath, ...args], { encoding: "utf8" }); }

// Test 1: Valid state is accepted
test("status works with valid state", (t) => {
  const target = tempProject("osd-sv-valid-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "sv-test", target, "--adapter", "fallback");
  // Should work without errors
  const status = run("status", "sv-test", target);
  assert.ok(status.includes("specification"));
});

// Test 2: Corrupted state is rejected
test("corrupted state.json with invalid stage is rejected", (t) => {
  const target = tempProject("osd-sv-badstage-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "sv-test2", target, "--adapter", "fallback");

  // Corrupt the state.json
  const statePath = join(target, ".osd", "changes", "sv-test2", "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  state.stage = "nonsense";
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // Should now reject operations
  assert.throws(
    () => run("status", "sv-test2", target),
    /Corrupted|Invalid/,
  );
});

// Test 3: Corrupted state with invalid mode
test("corrupted state.json with invalid mode is rejected", (t) => {
  const target = tempProject("osd-sv-badmode-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "sv-test3", target, "--adapter", "fallback");

  const statePath = join(target, ".osd", "changes", "sv-test3", "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  state.mode = "super_strict";
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  assert.throws(
    () => run("status", "sv-test3", target),
    /Corrupted|Invalid/,
  );
});

// Test 4: Corrupted config is rejected
test("corrupted config.json is rejected", (t) => {
  const target = tempProject("osd-sv-badconfig-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");

  const configPath = join(target, ".osd", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.schema = "osd.config/v1";
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  // doctor returns non-zero for bad config; check stderr for the validation message
  try {
    execFileSync(process.execPath, [cliPath, "doctor", target], { encoding: "utf8", stdio: "pipe" });
    assert.fail("Expected doctor to fail");
  } catch (err) {
    const combined = (err.stderr || "") + (err.stdout || "");
    assert.match(combined, /osd.config/, "Should mention invalid config schema");
  }
});

// Test 5: Missing state schema is rejected
test("state without schema field is rejected", (t) => {
  const target = tempProject("osd-sv-noschema-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "sv-test5", target, "--adapter", "fallback");

  const statePath = join(target, ".osd", "changes", "sv-test5", "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  delete state.schema;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  assert.throws(
    () => run("status", "sv-test5", target),
    /Corrupted|Invalid/,
  );
});
