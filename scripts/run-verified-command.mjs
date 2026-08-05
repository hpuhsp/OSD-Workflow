#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";

import { validatePolicyAction } from "./runtime-governance.mjs";

const SAFE_FEATURE = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;

function parseArgs(argv) {
  const options = { target: process.cwd(), role: "test_verifier", criteria: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unknown argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    if (key === "--criteria") options.criteria = value.split(",").map((item) => item.trim()).filter(Boolean);
    else options[key.slice(2)] = value;
    index += 1;
  }
  for (const field of ["feature", "command-id", "step"]) if (!options[field]) throw new Error(`--${field} is required.`);
  if (!SAFE_FEATURE.test(options.feature) || options.feature === "." || options.feature === "..") throw new Error("--feature must be a single safe directory name without path separators.");
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function within(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

function gitValue(target, args) {
  const result = spawnSync("git", args, { cwd: target, encoding: "utf8", shell: false });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const target = resolve(options.target);
  const manifest = readJson(resolve(target, ".ai/workflow-manifest.json"));
  const catalog = readJson(resolve(target, manifest.runtime_governance.catalog_file));
  const statePath = resolve(target, `openspec/changes/${options.feature}/osd-state.json`);
  const state = readJson(statePath);
  if (state.feature !== options.feature) throw new Error("Change state feature does not match --feature.");
  const command = catalog.policy.commands?.find((candidate) => candidate.id === options["command-id"]);
  if (!command || !Array.isArray(command.argv) || command.argv.length === 0) throw new Error(`No fixed command definition exists for ${options["command-id"]}.`);
  if (!command.roles?.includes(options.role)) throw new Error(`Role ${options.role} cannot execute ${command.id}.`);
  if (!command.modes?.includes(state.mode)) throw new Error(`Command ${command.id} is not allowed for ${state.mode}.`);

  const evidencePath = resolve(target, options.evidence ?? `openspec/changes/${options.feature}/verification.json`);
  if (!within(target, evidencePath)) throw new Error("Evidence path escapes target root.");
  const approved = ["approved", "in_progress", "verified", "reviewed", "archived", "complete"].includes(state.status);
  const policyErrors = validatePolicyAction({ command_id: command.id, role: options.role, mode: state.mode, approved, paths: [relative(target, evidencePath)] }, catalog);
  if (policyErrors.length > 0) throw new Error(policyErrors.join("\n"));

  const startedAt = new Date().toISOString();
  const result = spawnSync(command.argv[0], command.argv.slice(1), { cwd: target, encoding: "utf8", shell: false });
  const observedAt = new Date().toISOString();
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const evidence = existsSync(evidencePath)
    ? readJson(evidencePath)
    : { schema: "osd-verification-evidence/v1", feature: options.feature, strategy: state.strategy, steps: [] };
  if (evidence.feature !== options.feature || evidence.strategy !== state.strategy || !Array.isArray(evidence.steps)) throw new Error("Existing verification evidence does not match the selected change state.");
  evidence.steps.push({
    step: options.step,
    command_id: command.id,
    exit_code: exitCode,
    observed_at: observedAt,
    covered_acceptance_criteria: options.criteria,
    summary: `Verified command ${command.id} exited with ${exitCode}.`,
    provenance: {
      schema: "osd-command-attestation/v1",
      runner: "osd-verified-command",
      command_definition_sha256: digest(command),
      repository_revision: gitValue(target, ["rev-parse", "HEAD"]),
      workspace_dirty: gitValue(target, ["status", "--porcelain"]) !== "",
      started_at: startedAt,
      recorded_at: observedAt,
    },
  });
  mkdirSync(resolve(evidencePath, ".."), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ command_id: command.id, exit_code: exitCode, evidence: relative(target, evidencePath) }, null, 2));
  return exitCode;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
