#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SAFE_FEATURE = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;

function parseArgs(argv) {
  const options = { target: process.cwd(), skipSpecs: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skip-specs") {
      options.skipSpecs = true;
      continue;
    }
    if (arg !== "--feature" && arg !== "--target") throw new Error(`Unknown argument: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
    options[arg.slice(2)] = value;
    index += 1;
  }
  if (!options.feature) throw new Error("--feature is required.");
  if (!SAFE_FEATURE.test(options.feature) || options.feature === "." || options.feature === "..") {
    throw new Error("--feature must be a single safe directory name without path separators.");
  }
  return options;
}

function within(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

function gitValue(target, args) {
  const result = spawnSync("git", args, { cwd: target, encoding: "utf8", shell: false });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

function findArchivedChangeDirectory(target, feature) {
  const archiveRoot = resolve(target, "openspec", "changes", "archive");
  if (!existsSync(archiveRoot) || !statSync(archiveRoot).isDirectory()) return null;
  const suffix = `-${feature}`;
  const matches = readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(suffix))
    .map((entry) => join(archiveRoot, entry.name));
  if (matches.length !== 1) throw new Error(`Expected one native OpenSpec archive for ${feature}, found ${matches.length}.`);
  return matches[0];
}

export function main(argv = process.argv.slice(2), { spawn = spawnSync, log = console.log } = {}) {
  const options = parseArgs(argv);
  const target = resolve(options.target);
  const activeChange = resolve(target, "openspec", "changes", options.feature);
  if (!within(target, activeChange) || !existsSync(activeChange) || !statSync(activeChange).isDirectory()) {
    throw new Error(`Active OpenSpec change does not exist: openspec/changes/${options.feature}`);
  }

  const command = ["archive", options.feature, "--yes", ...(options.skipSpecs ? ["--skip-specs"] : [])];
  const startedAt = new Date().toISOString();
  const result = spawn("openspec", command, { cwd: target, encoding: "utf8", shell: false });
  const completedAt = new Date().toISOString();
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  if (exitCode !== 0) {
    process.stderr.write(result.stderr || result.stdout || `openspec archive exited with ${exitCode}.\n`);
    return exitCode;
  }

  const archivedChange = findArchivedChangeDirectory(target, options.feature);
  if (existsSync(activeChange)) throw new Error(`OpenSpec archive did not remove active change directory: ${relative(target, activeChange)}`);
  const location = relative(target, archivedChange).replaceAll("\\", "/");
  const archiveResultPath = join(archivedChange, "archive-result.json");
  const nativeCommand = ["openspec", ...command].join(" ");
  const archiveResult = {
    schema: "osd-archive-result/v1",
    feature: options.feature,
    status: "archived",
    native_command: nativeCommand,
    exit_code: 0,
    archived_change_location: location,
    knowledge_sync: "not_required",
    completed_at: completedAt,
    summary: "Native OpenSpec archive completed successfully.",
    provenance: {
      schema: "osd-native-archive-attestation/v1",
      runner: "osd-openspec-archive",
      argv: ["openspec", ...command],
      repository_revision: gitValue(target, ["rev-parse", "HEAD"]),
      workspace_dirty: gitValue(target, ["status", "--porcelain"]) !== "",
      started_at: startedAt,
      recorded_at: completedAt,
    },
  };
  writeFileSync(archiveResultPath, `${JSON.stringify(archiveResult, null, 2)}\n`, "utf8");
  log(JSON.stringify({ feature: options.feature, archived_change_location: location, exit_code: 0 }, null, 2));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
