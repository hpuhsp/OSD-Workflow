import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { main as archiveOpenSpecChange } from "../scripts/archive-openspec-change.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runner = join(projectRoot, "scripts", "run-verified-command.mjs");
const runtime = join(projectRoot, "scripts", "runtime-governance.mjs");
const powerShellInstaller = join(projectRoot, "scripts", "install.ps1");

function tempProject(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  cpSync(join(projectRoot, ".ai"), join(root, ".ai"), { recursive: true });
  return root;
}

test("verified command runner executes only a catalog command and writes provenance", (t) => {
  const root = tempProject("osd-runner-");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const catalogPath = join(root, ".ai", "runtime-governance", "governance.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  catalog.policy.commands[0].argv = [process.execPath, "--version"];
  writeFileSync(catalogPath, JSON.stringify(catalog), "utf8");
  const change = join(root, "openspec", "changes", "runner-check");
  mkdirSync(change, { recursive: true });
  writeFileSync(join(change, "spec.md"), "# Spec\n\n## Acceptance Criteria\n\n- AC-01: command can run.\n", "utf8");
  writeFileSync(join(change, "osd-state.json"), JSON.stringify({ schema: "osd-change-state/v1", feature: "runner-check", mode: "standard", strategy: "verification_only", stage: "verification", status: "approved", specification: "openspec/changes/runner-check/spec.md", updated_at: "2026-08-05T00:00:00+08:00" }), "utf8");

  execFileSync(process.execPath, [runner, "--target", root, "--feature", "runner-check", "--command-id", "node-test", "--step", "focused", "--criteria", "AC-01"], { stdio: "pipe" });
  const evidence = JSON.parse(readFileSync(join(change, "verification.json"), "utf8"));
  assert.equal(evidence.steps[0].exit_code, 0);
  assert.equal(evidence.steps[0].provenance.runner, "osd-verified-command");
  assert.equal(evidence.steps[0].provenance.schema, "osd-command-attestation/v1");
  execFileSync(process.execPath, [runtime, "evaluate", "--target", root, "--feature", "runner-check"], { stdio: "pipe" });
  const evaluation = JSON.parse(readFileSync(join(change, "evaluation.json"), "utf8"));
  assert.deepEqual(evaluation.deterministic_checks[0].covered_acceptance_criteria, ["AC-01"]);
});

test("verified command runner rejects unsafe feature paths before reading target artifacts", () => {
  assert.throws(
    () => execFileSync(process.execPath, [runner, "--feature", "../escape", "--command-id", "node-test", "--step", "focused"], { stdio: "pipe" }),
    (error) => error.status === 1 && error.stderr.toString().includes("safe directory name"),
  );
});

test("native archive command records evidence only after OpenSpec moves the change", (t) => {
  const root = tempProject("osd-native-archive-");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const change = join(root, "openspec", "changes", "native-check");
  mkdirSync(change, { recursive: true });
  writeFileSync(join(change, "spec.md"), "# Spec\n", "utf8");

  const exitCode = archiveOpenSpecChange(["--target", root, "--feature", "native-check"], {
    spawn(command, args, options) {
      assert.equal(command, "openspec");
      assert.deepEqual(args, ["archive", "native-check", "--yes"]);
      assert.equal(options.shell, false);
      const archived = join(root, "openspec", "changes", "archive", "2026-08-05-native-check");
      mkdirSync(resolve(archived, ".."), { recursive: true });
      renameSync(change, archived);
      return { status: 0, stdout: "archived" };
    },
    log() {},
  });
  const archived = join(root, "openspec", "changes", "archive", "2026-08-05-native-check");
  assert.equal(exitCode, 0);
  assert.equal(existsSync(change), false);
  const result = JSON.parse(readFileSync(join(archived, "archive-result.json"), "utf8"));
  assert.equal(result.provenance.runner, "osd-openspec-archive");
  assert.equal(result.archived_change_location, "openspec/changes/archive/2026-08-05-native-check");
});

test("PowerShell installer includes every runtime dependency", { skip: process.platform !== "win32" }, (t) => {
  const root = mkdtempSync(join(tmpdir(), "osd-powershell-install-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", powerShellInstaller, "-Target", root], { stdio: "pipe" });
  for (const file of ["verify-workflow-artifacts.mjs", "runtime-governance.mjs", "run-verified-command.mjs", "archive-openspec-change.mjs"]) {
    assert.equal(existsSync(join(root, "scripts", file)), true);
  }
});
