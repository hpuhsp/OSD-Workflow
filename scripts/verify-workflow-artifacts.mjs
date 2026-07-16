#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function parseArgs(argv) {
  const options = {
    target: process.cwd(),
    feature: "",
    strictOptional: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--target") {
      options.target = argv[++index];
    } else if (arg === "--feature") {
      options.feature = argv[++index];
    } else if (arg === "--strict-optional") {
      options.strictOptional = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`OSD workflow artifact verifier

Usage:
  node scripts/verify-workflow-artifacts.mjs --target <project> [--feature <feature>] [--strict-optional]

Options:
  --target <project>     Project directory to verify. Defaults to current directory.
  --feature <feature>    Verify one feature under openspec/changes/{feature}.
  --strict-optional      Require outputs for optional workflow stages too.
  -h, --help             Show this help message.
`);
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function existsFile(root, relativePath) {
  const absolutePath = join(root, relativePath);
  return existsSync(absolutePath) && statSync(absolutePath).isFile();
}

function existsPath(root, relativePath) {
  return existsSync(join(root, relativePath));
}

function parseWorkflow(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  const stages = [];
  const references = new Set();
  const templates = new Set();
  let currentStage = null;
  let inRequiredOutputs = false;

  for (const line of lines) {
    for (const match of line.matchAll(/"(\.ai\/[^"]+)"/g)) {
      references.add(match[1]);
    }

    const ruleOrSkill = line.match(/(?:skill|rule): "([^"]+)"/);
    if (ruleOrSkill) {
      references.add(ruleOrSkill[1]);
    }

    const template = line.match(/(?:stage_report|feishu_project_requirement): "([^"]+)"/);
    if (template) {
      templates.add(template[1]);
    }

    const stageId = line.match(/^\s{4}- id: ([^\s]+)/);
    if (stageId) {
      currentStage = {
        id: stageId[1],
        optional: false,
        skill: "",
        rules: [],
        requiredOutputs: [],
      };
      stages.push(currentStage);
      inRequiredOutputs = false;
      continue;
    }

    if (!currentStage) {
      continue;
    }

    const optional = line.match(/^\s{6}optional: true/);
    if (optional) {
      currentStage.optional = true;
      continue;
    }

    const skill = line.match(/^\s{6}skill: "([^"]+)"/);
    if (skill) {
      currentStage.skill = skill[1];
      references.add(skill[1]);
      continue;
    }

    const rulesStart = line.match(/^\s{6}rules:/);
    if (rulesStart) {
      inRequiredOutputs = false;
      continue;
    }

    const requiredOutputsStart = line.match(/^\s{6}required_outputs:/);
    if (requiredOutputsStart) {
      inRequiredOutputs = true;
      continue;
    }

    const listItem = line.match(/^\s{8}- "([^"]+)"/);
    if (listItem && inRequiredOutputs) {
      currentStage.requiredOutputs.push(listItem[1]);
      continue;
    }

    if (listItem && listItem[1].includes(".ai/rules/")) {
      currentStage.rules.push(listItem[1]);
      references.add(listItem[1]);
      continue;
    }

    if (/^\s{6}[a-zA-Z0-9_-]+:/.test(line)) {
      inRequiredOutputs = false;
    }
  }

  return { stages, references: [...references], templates: [...templates] };
}

function discoverFeatures(root, requestedFeature) {
  if (requestedFeature) {
    return [requestedFeature];
  }

  const changesRoot = join(root, "openspec", "changes");
  if (!existsSync(changesRoot)) {
    return [];
  }

  return readdirSync(changesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function shouldRequireOptionalStage(root, stage, strictOptional) {
  if (!stage.optional) {
    return true;
  }

  if (strictOptional) {
    return true;
  }

  if (stage.id === "codegraph-analysis") {
    return existsPath(root, ".codegraph");
  }

  return false;
}

function replaceFeature(path, feature) {
  return path.replaceAll("{feature}", feature);
}

function verify(options) {
  const root = resolve(options.target);
  const workflowRelative = ".ai/workflows/feature-development.yaml";
  const workflowAbsolute = join(root, workflowRelative);
  const errors = [];
  const warnings = [];

  if (!existsFile(root, workflowRelative)) {
    errors.push(`Missing workflow file: ${workflowRelative}`);
    return { root, errors, warnings, checkedFeatures: [] };
  }

  const workflow = parseWorkflow(readText(workflowAbsolute));

  for (const reference of [...workflow.references, ...workflow.templates]) {
    if (!existsFile(root, reference)) {
      errors.push(`Missing referenced workflow file: ${reference}`);
    }
  }

  const features = discoverFeatures(root, options.feature);

  if (features.length === 0) {
    warnings.push("No feature directories found under openspec/changes. Structural checks only.");
  }

  for (const feature of features) {
    for (const stage of workflow.stages) {
      const required = shouldRequireOptionalStage(root, stage, options.strictOptional);
      if (!required) {
        warnings.push(`Skipped optional stage output check for ${feature}:${stage.id}`);
        continue;
      }

      if (stage.requiredOutputs.length === 0 && !stage.optional) {
        errors.push(`Stage has no required_outputs: ${stage.id}`);
      }

      for (const output of stage.requiredOutputs) {
        const relativeOutput = replaceFeature(output, feature);
        if (!existsPath(root, relativeOutput)) {
          errors.push(`Missing required output for ${feature}:${stage.id}: ${relativeOutput}`);
        }
      }
    }
  }

  return { root, errors, warnings, checkedFeatures: features };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      printHelp();
      return;
    }

    const result = verify(options);

    console.log(`OSD workflow artifact verification`);
    console.log(`Target: ${result.root}`);
    console.log(`Features: ${result.checkedFeatures.length > 0 ? result.checkedFeatures.join(", ") : "(none)"}`);

    if (result.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const warning of result.warnings) {
        console.log(`  - ${warning}`);
      }
    }

    if (result.errors.length > 0) {
      console.error("\nErrors:");
      for (const error of result.errors) {
        console.error(`  - ${error}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log("\nResult: PASS");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
