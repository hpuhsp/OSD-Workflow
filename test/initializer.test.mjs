import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { parseArgs } from "../bin/osd-workflow-init.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const cliPath = join(projectRoot, "bin", "osd-workflow-init.mjs");

test("initializer accepts one positional target", () => {
  const options = parseArgs(["target-project", "--dry-run"]);
  assert.equal(options.command, "init");
  assert.equal(options.dryRun, true);
  assert.equal(options.force, false);
  assert.ok(options.target.endsWith("target-project"));
});

test("update command enables overwrite by default", () => {
  const options = parseArgs(["update", "target-project"]);
  assert.equal(options.command, "update");
  assert.equal(options.force, true);
  assert.ok(options.target.endsWith("target-project"));
});

test("initializer rejects multiple positional targets", () => {
  assert.throws(
    () => parseArgs(["first-target", "second-target", "--dry-run"]),
    /Specify the target only once/,
  );
});

test("initializer rejects mixed positional and target option", () => {
  assert.throws(
    () => parseArgs(["first-target", "--target", "second-target"]),
    /Specify the target only once/,
  );
});

test("update refreshes managed files and preserves project artifacts", (t) => {
  const target = mkdtempSync(join(tmpdir(), "osd-workflow-update-"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  execFileSync(process.execPath, [cliPath, "init", target], { stdio: "pipe" });

  const managedFile = join(target, ".ai", "AI_WORKFLOW.md");
  const projectArtifact = join(target, "openspec", "changes", "active-feature", "notes.md");
  writeFileSync(managedFile, "outdated workflow", "utf8");
  mkdirSync(resolve(projectArtifact, ".."), { recursive: true });
  writeFileSync(projectArtifact, "keep project-owned content", "utf8");

  execFileSync(process.execPath, [cliPath, "update", target], { stdio: "pipe" });

  assert.equal(readFileSync(managedFile, "utf8"), readFileSync(join(projectRoot, ".ai", "AI_WORKFLOW.md"), "utf8"));
  assert.equal(readFileSync(projectArtifact, "utf8"), "keep project-owned content");
});

test("initializer installs only the default AGENTS discovery entry", (t) => {
  const target = mkdtempSync(join(tmpdir(), "osd-workflow-agents-"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  execFileSync(process.execPath, [cliPath, "init", target], { stdio: "pipe" });

  const content = readFileSync(join(target, "AGENTS.md"), "utf8");
  assert.match(content, /<!-- osd-workflow:start -->/);
  assert.match(content, /OSD Workflow as the top-level controller/);
  assert.match(content, /<!-- osd-workflow:end -->/);
  for (const entry of ["CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md", ".cursor/rules/osd-workflow.mdc"]) {
    assert.throws(() => readFileSync(join(target, entry), "utf8"));
  }
});

test("initializer and updater preserve project-owned agent instructions", (t) => {
  const target = mkdtempSync(join(tmpdir(), "osd-workflow-agent-merge-"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  const agentFile = join(target, "AGENTS.md");
  writeFileSync(agentFile, "# Project Rules\n\nKeep this instruction.\n", "utf8");
  execFileSync(process.execPath, [cliPath, "init", target], { stdio: "pipe" });
  writeFileSync(
    agentFile,
    readFileSync(agentFile, "utf8").replace("# OSD Workflow Agent Entry", "# Stale OSD Entry"),
    "utf8",
  );

  execFileSync(process.execPath, [cliPath, "update", target], { stdio: "pipe" });

  const updated = readFileSync(agentFile, "utf8");
  assert.match(updated, /Keep this instruction\./);
  assert.match(updated, /# OSD Workflow Agent Entry/);
  assert.doesNotMatch(updated, /# Stale OSD Entry/);
  assert.equal((updated.match(/<!-- osd-workflow:start -->/g) ?? []).length, 1);
});

test("initializer leaves an optional existing Cursor rule untouched", (t) => {
  const target = mkdtempSync(join(tmpdir(), "osd-workflow-cursor-"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  const cursorRule = join(target, ".cursor", "rules", "osd-workflow.mdc");
  mkdirSync(resolve(cursorRule, ".."), { recursive: true });
  writeFileSync(cursorRule, "---\ndescription: Existing project rule\nalwaysApply: false\n---\n\nKeep this Cursor instruction.\n", "utf8");

  execFileSync(process.execPath, [cliPath, "init", target], { stdio: "pipe" });

  const updated = readFileSync(cursorRule, "utf8");
  assert.match(updated, /^alwaysApply: false$/m);
  assert.match(updated, /Keep this Cursor instruction\./);
  assert.doesNotMatch(updated, /<!-- osd-workflow:start -->/);
});

test("update rejects a directory without an existing installation", (t) => {
  const target = mkdtempSync(join(tmpdir(), "osd-workflow-missing-"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  assert.throws(
    () => execFileSync(process.execPath, [cliPath, "update", target], { stdio: "pipe" }),
    (error) => error.status === 1 && error.stderr.toString().includes("No existing OSD Workflow installation"),
  );
});
