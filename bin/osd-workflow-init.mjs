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
  console.log(`OSD Workflow initializer

Usage:
  osd-workflow [init] [target] [options]
  osd-workflow --target <path> [options]

Options:
  --target <path>   Target project directory. Defaults to current directory.
  --with-docs       Also copy docs/ usage guides into the target project.
  --force           Overwrite existing files.
  --dry-run         Show planned changes without writing files.
  -h, --help        Show this help message.

Examples:
  osd-workflow --target .
  osd-workflow init ./my-project --with-docs
  osd-workflow --target D:\\WorkPlace\\demo --dry-run
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    target: process.cwd(),
    withDocs: false,
    force: false,
    dryRun: false,
    help: false
  };

  if (args[0] === "init") {
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
      options.target = value;
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
      options.target = arg;
    }
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

function printSummary(target, summary, dryRun) {
  const prefix = dryRun ? "Dry run complete" : "Initialization complete";
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
  console.log("  4. Start from .ai/workflows/feature-development.yaml for feature work.");
  console.log("  5. Before handoff, run: node scripts/verify-workflow-artifacts.mjs --target . --feature <feature>.");
}

function run() {
  const options = parseArgs(process.argv.slice(2));

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

  ensureTargetDirectory(options.target, options.dryRun);

  for (const entry of entries) {
    const source = path.join(templateRoot, entry);
    const destination = path.join(options.target, entry);

    if (!fs.existsSync(source)) {
      throw new Error(`Template entry is missing: ${entry}`);
    }

    copyEntry(source, destination, options, summary);
  }

  printSummary(options.target, summary, options.dryRun);
}

try {
  run();
} catch (error) {
  console.error(`osd-workflow: ${error.message}`);
  process.exitCode = 1;
}
