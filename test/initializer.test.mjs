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

test("update rejects a directory without an existing installation", (t) => {
  const target = mkdtempSync(join(tmpdir(), "osd-workflow-missing-"));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  assert.throws(
    () => execFileSync(process.execPath, [cliPath, "update", target], { stdio: "pipe" }),
    (error) => error.status === 1 && error.stderr.toString().includes("No existing OSD Workflow installation"),
  );
});
