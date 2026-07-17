#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templateRoot = path.resolve(__dirname, "..");

const REQUIRED_ENTRIES = [".ai", "openspec", "knowledge", "scripts/verify-workflow-artifacts.mjs"];
const DOC_ENTRIES = ["docs"];

function printHelp() {
  console.log(`OSD Workflow initializer and updater

Usage:
  osd-workflow [init] [target] [options]
  osd-workflow update [target] [options]
  osd-workflow --target <path> [options]

Options:
  --target <path>   Target project directory. Defaults to current directory.
  --with-docs       Also copy docs/ usage guides into the target project.
  --force           Overwrite existing files during init. Update enables this automatically.
  --dry-run         Show planned changes without writing files.
  -h, --help        Show this help message.

Examples:
  osd-workflow --target .
  osd-workflow init ./my-project --with-docs
  osd-workflow update .
  osd-workflow update D:\\WorkPlace\\demo --with-docs
  osd-workflow --target D:\\WorkPlace\\demo --dry-run
`);
}

export function parseArgs(argv) {
  const args = [...argv];
  const options = {
    command: "init",
    target: process.cwd(),
    withDocs: false,
    force: false,
    dryRun: false,
    help: false
  };
  let targetSource = "default";

  if (args[0] === "init" || args[0] === "update") {
    options.command = args[0];
    args.shift();
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--target") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--target requires a path value.");
      }
      if (targetSource !== "default") {
        throw new Error("Specify the target only once, using either a positional path or --target.");
      }
      options.target = value;
      targetSource = "option";
      i += 1;
    } else if (arg === "--with-docs") {
      options.withDocs = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      if (targetSource !== "default") {
        throw new Error("Specify the target only once, using either a positional path or --target.");
      }
      options.target = arg;
      targetSource = "positional";
    }
  }

  if (options.command === "update") {
    options.force = true;
  }
  options.target = path.resolve(process.cwd(), options.target);
  return options;
}

function ensureTargetDirectory(target, dryRun) {
  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) {
      throw new Error(`Target exists but is not a directory: ${target}`);
    }
    return;
  }

  if (!dryRun) {
    fs.mkdirSync(target, { recursive: true });
  }
}

function ensureUpdateTarget(options) {
  if (options.command !== "update") {
    return;
  }

  const manifest = path.join(options.target, ".ai", "workflow-manifest.json");
  if (!fs.existsSync(manifest) || !fs.statSync(manifest).isFile()) {
    throw new Error(`No existing OSD Workflow installation found at: ${options.target}`);
  }
}

function copyEntry(source, destination, options, summary) {
  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    if (!fs.existsSync(destination)) {
      summary.createdDirs.push(destination);
      if (!options.dryRun) {
        fs.mkdirSync(destination, { recursive: true });
      }
    }

    for (const child of fs.readdirSync(source)) {
      copyEntry(
        path.join(source, child),
        path.join(destination, child),
        options,
        summary
      );
    }
    return;
  }

  if (path.resolve(source) === path.resolve(destination)) {
    summary.skipped.push(destination);
    return;
  }

  if (fs.existsSync(destination)) {
    if (!options.force) {
      summary.skipped.push(destination);
      return;
    }
    summary.overwritten.push(destination);
  } else {
    summary.createdFiles.push(destination);
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function relativeList(target, items) {
  return items.map((item) => path.relative(target, item).replaceAll(path.sep, "/"));
}

function printSummary(target, summary, options) {
  const action = options.command === "update" ? "Update" : "Initialization";
  const prefix = options.dryRun ? `${action} dry run complete` : `${action} complete`;
  console.log(`${prefix}: ${target}`);

  const groups = [
    ["Created directories", summary.createdDirs],
    ["Created files", summary.createdFiles],
    ["Overwritten files", summary.overwritten],
    ["Skipped existing files", summary.skipped]
  ];

  for (const [label, items] of groups) {
    if (items.length === 0) {
      continue;
    }
    console.log(`\n${label}:`);
    for (const item of relativeList(target, items)) {
      console.log(`  - ${item}`);
    }
  }

  console.log("\nNext steps:");
  console.log("  1. Install or confirm the global OpenSpec CLI: npm install -g @fission-ai/openspec@latest.");
  console.log("  2. Run openspec init in the target project if it has not been initialized.");
  console.log("  3. Ensure Superpowers is available in each developer's AI agent or harness.");
  console.log("  4. Use Superpowers to route the task to lite, standard, or strict mode.");
  console.log("  5. Select tdd, test_first, or verification_only as the development strategy.");
  console.log("  6. Create the mode-appropriate OpenSpec specification before implementation.");
  console.log("  7. Before handoff, run: node scripts/verify-workflow-artifacts.mjs --target . --feature <feature> --mode <mode>.");
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help) {
    printHelp();
    return;
  }

  const entries = [...REQUIRED_ENTRIES, ...(options.withDocs ? DOC_ENTRIES : [])];
  const summary = {
    createdDirs: [],
    createdFiles: [],
    overwritten: [],
    skipped: []
  };

  ensureUpdateTarget(options);
  ensureTargetDirectory(options.target, options.dryRun);

  for (const entry of entries) {
    const source = path.join(templateRoot, entry);
    const destination = path.join(options.target, entry);

    if (!fs.existsSync(source)) {
      throw new Error(`Template entry is missing: ${entry}`);
    }

    copyEntry(source, destination, options, summary);
  }

  printSummary(options.target, summary, options);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  try {
    run();
  } catch (error) {
    console.error(`osd-workflow: ${error.message}`);
    process.exitCode = 1;
  }
}
