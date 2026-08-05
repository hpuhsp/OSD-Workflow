#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templateRoot = path.resolve(__dirname, "..");

const REQUIRED_ENTRIES = [".ai", "openspec", "knowledge", "scripts/verify-workflow-artifacts.mjs", "scripts/runtime-governance.mjs"];
const DOC_ENTRIES = ["docs"];
const AGENT_ENTRY_TEMPLATE = ".ai/templates/agent-entry.md";
const MANAGED_ENTRY_START = "<!-- osd-workflow:start -->";
const MANAGED_ENTRY_END = "<!-- osd-workflow:end -->";
const AGENT_ENTRY_FILES = [
  "AGENTS.md",
];

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

function renderManagedAgentEntry(template) {
  const block = `${MANAGED_ENTRY_START}\n${template.trim()}\n${MANAGED_ENTRY_END}`;
  return block;
}

function ensureCursorAlwaysApply(content) {
  const defaultFrontmatter = "---\ndescription: Use OSD Workflow as the top-level controller for repository changes\nalwaysApply: true\n---\n\n";
  if (!content.startsWith("---")) {
    return `${defaultFrontmatter}${content}`;
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error("Malformed Cursor frontmatter in OSD agent entry file.");
  }

  const frontmatter = content.slice(0, end);
  const normalized = /^alwaysApply:/im.test(frontmatter)
    ? frontmatter.replace(/^alwaysApply:.*$/im, "alwaysApply: true")
    : `${frontmatter}\nalwaysApply: true`;
  return `${normalized}${content.slice(end)}`;
}

function mergeManagedAgentEntry(destination, template, options, summary) {
  const block = renderManagedAgentEntry(template);
  const exists = fs.existsSync(destination);
  const current = exists ? fs.readFileSync(destination, "utf8") : "";
  const start = current.indexOf(MANAGED_ENTRY_START);
  const end = current.indexOf(MANAGED_ENTRY_END);

  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error(`Malformed OSD managed block in agent entry file: ${destination}`);
  }

  let next;
  if (start !== -1) {
    const after = end + MANAGED_ENTRY_END.length;
    next = `${current.slice(0, start)}${block}${current.slice(after)}`;
  } else if (current.trim()) {
    next = `${current.trimEnd()}\n\n${block}\n`;
  } else {
    next = `${block}\n`;
  }

  if (destination.endsWith(".mdc")) {
    next = ensureCursorAlwaysApply(next);
  }

  if (next === current) {
    summary.skipped.push(destination);
    return;
  }

  if (exists) {
    summary.overwritten.push(destination);
  } else {
    summary.createdFiles.push(destination);
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, next, "utf8");
  }
}

function installAgentEntries(options, summary) {
  const source = path.join(templateRoot, AGENT_ENTRY_TEMPLATE);
  if (!fs.existsSync(source)) {
    throw new Error(`Template entry is missing: ${AGENT_ENTRY_TEMPLATE}`);
  }

  const template = fs.readFileSync(source, "utf8");
  for (const entry of AGENT_ENTRY_FILES) {
    mergeManagedAgentEntry(path.join(options.target, entry), template, options, summary);
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
  console.log("  4. Start a new agent session and describe the task normally; the generated agent entries activate OSD.");
  console.log("  5. If an agent does not load project instructions, use: Execute with OSD: <task>.");
  console.log("  6. Before handoff, run: node scripts/verify-workflow-artifacts.mjs --target . --feature <feature> --mode <mode>.");
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

  installAgentEntries(options, summary);

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
