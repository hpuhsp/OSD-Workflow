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
function run(...args) { return execFileSync(process.execPath, [cliPath, ...args], { encoding: "utf8", stdio: "pipe" }); }
function setVerifyCommand(target, command = `${process.execPath} --version`) {
  const configPath = join(target, ".osd", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.commands.verify = command;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

test("doctor reports active changes with their stages", (t) => {
  const target = tempProject("osd-dr-active-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "dr-feat1", target, "--adapter", "fallback");
  run("start", "dr-feat2", target, "--adapter", "fallback");
  run("approve", "dr-feat2", target);

  const output = run("doctor", target);
  assert.match(output, /Active changes: 2 total, 2 valid, 0 corrupted/);
  assert.match(output, /dr-feat1: specification/);
  assert.match(output, /dr-feat2: planning/);
});

test("doctor reports corrupted state files", (t) => {
  const target = tempProject("osd-dr-corr-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", "dr-corr", target, "--adapter", "fallback");

  // Corrupt the state
  const statePath = join(target, ".osd", "changes", "dr-corr", "state.json");
  writeFileSync(statePath, "not valid json", "utf8");

  let output;
  try {
    output = run("doctor", target);
  } catch (e) {
    // doctor exits non-zero when corruption is detected; capture output from stderr/stdout
    output = (e.stdout || "") + (e.stderr || "");
  }
  assert.match(output, /corrupted/);
  assert.match(output, /dr-corr/);
});

test("doctor reports archive count", (t) => {
  const target = tempProject("osd-dr-arch-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  setVerifyCommand(target);
  run("start", "dr-arch", target, "--adapter", "fallback");
  run("approve", "dr-arch", target);
  run("plan", "dr-arch", target);
  run("implement", "dr-arch", target);
  run("verify", "dr-arch", target);
  run("review", "dr-arch", target, "--result", "pass");
  run("archive", "dr-arch", target);

  const output = run("doctor", target);
  assert.match(output, /Archived deliveries: 1/);
  assert.match(output, /Active changes: 0/);
});
