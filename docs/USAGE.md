# Usage Guide

This guide explains how to use this workflow in daily multi-agent development, including prompt patterns, project custom instructions, and Feishu Project MCP (`FeishuProjectMcp`) integration.

## Mental Model

Use this template as a project-level workflow contract.

```text
Agent/Harness-level Superpowers
-> How the AI agent should execute work
-> Planning, sequencing, verification, review discipline

Global OpenSpec CLI
-> Installed once with npm install -g @fission-ai/openspec@latest
-> Provides OpenSpec commands

Project-level OpenSpec workspace
-> Why the project should change
-> What should change
-> How the change will be accepted
-> What knowledge should be archived

Project-level .ai template
-> Shared workflow, rules, skill mappings, and agent context contract
```

The normal flow is:

```text
Feishu project requirement
-> Requirement context
-> OpenSpec change
-> Spec review
-> Implementation plan
-> Coding
-> Test generation
-> Verification
-> Code review
-> Knowledge archive
```

## Recommended Daily Mode

Use a two-step workflow by default.

Step 1: create and review the spec before coding.

```text
Use Feishu Project MCP (`FeishuProjectMcp`) to read this requirement: {Feishu project requirement link or task ID}

Strictly execute the current project workflow at .ai/workflows/feature-development.yaml.
Before each stage, read every skill and rule file referenced by that stage.

Only execute through requirement analysis, OpenSpec creation, and spec review.
Create:
- openspec/changes/{feature}/proposal.md
- openspec/changes/{feature}/spec.md
- openspec/changes/{feature}/design.md

Stop after the spec review point and wait for my confirmation. Do not start coding.
```

Step 2: continue after the spec is accepted.

```text
The OpenSpec change at openspec/changes/{feature}/ is approved.

Continue with .ai/workflows/feature-development.yaml:
1. Create the implementation plan.
2. Implement the change.
3. Generate or update tests.
4. Run verification.
5. Perform code review.
6. Archive the result under knowledge/archive/{feature}/.

Before each stage, read every skill and rule file referenced by that stage.
Do not treat TodoWrite, internal task lists, or chat summaries as workflow artifacts.
Every required artifact must be written to disk.
```

This keeps the requirement-to-spec boundary explicit and prevents agents from jumping directly from a rough description into code.

## CLI Bootstrap

Use the installer when you need to connect an existing project to this workflow.

PowerShell, recommended for Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path $env:TEMP 'osd-workflow-install.ps1'; iwr https://raw.githubusercontent.com/hpuhsp/OSD-Workflow/main/scripts/install.ps1 -OutFile $p; & $p -Target . -WithDocs"
```

From a cloned copy of this repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target D:\WorkPlace\demo -WithDocs
```

Node.js / npx:

```bash
npx --yes github:hpuhsp/OSD-Workflow --target . --with-docs
```

Preview before writing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target D:\WorkPlace\demo -WithDocs -DryRun
```

The installer copies `.ai/`, `openspec/`, `knowledge/`, and `scripts/verify-workflow-artifacts.mjs` by default. It copies `docs/` only when `--with-docs` or `-WithDocs` is set. Existing files are skipped unless `--force` or `-Force` is provided.

## Production Handoff Gate

Before handoff, run the production artifact gate:

```bash
node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}
```

The gate checks:

- workflow-referenced skill, rule, and template files
- OpenSpec change files
- archive files
- per-stage `required_outputs`
- `knowledge/archive/{feature}/stage-report.md`

## Prompt Templates

### Strict Workflow Execution Prefix

Use this prefix when the agent tends to skip stages or treat the workflow as advisory.

```text
Strictly execute .ai/workflows/feature-development.yaml as a binding workflow contract.

Before starting, read:
- .ai/workflows/feature-development.yaml
- .ai/rules/workflow-execution-rule.md

Before each stage:
- read every skill file referenced by that stage
- read every rules file referenced by that stage
- update knowledge/archive/{feature}/stage-report.md using .ai/templates/stage-report.md
- report current stage id, files read, files created or updated, and required_outputs status

Do not skip non-optional stages unless I explicitly say to skip them.
Do not treat TodoWrite, internal task lists, chat summaries, or unstored reasoning as workflow artifacts.
The stage is complete only when the required file or verification evidence exists on disk.
Before handoff, run node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}.
```

### Create OpenSpec From Feishu Project Requirement

```text
Use Feishu Project MCP (FeishuProjectMcp) to read requirement {Feishu project link or task ID}.

Strictly execute .ai/workflows/feature-development.yaml as a binding workflow contract.
Before each stage, read every skill and rule file referenced by that stage.

Extract:
- title
- background
- description
- acceptance criteria
- comments and decisions
- attachments or screenshots
- priority and expected release constraints

Then create a project-level OpenSpec change under openspec/changes/{feature}/ after the project has run openspec init.

Required files:
- proposal.md
- spec.md
- design.md

Follow:
- .ai/workflows/feature-development.yaml
- .ai/rules/workflow-execution-rule.md
- .ai/skills/openspec-create/SKILL.md

Stop after creating the OpenSpec change and wait for review.
```

### Continue After Spec Approval

```text
The OpenSpec change openspec/changes/{feature}/ is approved.

Continue the workflow:
- follow .ai/rules/workflow-execution-rule.md
- use .ai/skills/implementation-plan/SKILL.md
- follow .ai/rules/development-rule.md
- generate verification with .ai/skills/test-generation/SKILL.md
- follow .ai/rules/testing-rule.md
- review with .ai/rules/code-review-rule.md
- archive with .ai/skills/knowledge-archive/SKILL.md

Keep implementation scoped to the approved OpenSpec change.
Do not treat TodoWrite or chat summaries as implementation plan, test report, review report, or archive.
Update knowledge/archive/{feature}/stage-report.md at every stage.
Before handoff, run node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}.
```

### Handle A Bug Fix

```text
Use the current project AI workflow to handle this bug: {bug description or Feishu project link}.

First create an OpenSpec change that captures:
- observed behavior
- expected behavior
- reproduction steps
- acceptance criteria
- regression test expectation

Stop after the OpenSpec change is ready for review.
```

### Small Change With Explicit Skip

Use this only when the change is low risk and the user explicitly wants to skip the full spec flow.

```text
This is a low-risk change. Skip full OpenSpec creation, but still follow the project rules:
- summarize the requirement
- identify affected files
- implement the smallest safe change
- run focused verification
- document any residual risk
```

## Project Custom Instruction

Add a short instruction like this to the project-level agent rules, such as `.agent/AGENTS.md`, `.agents/AGENTS.md`, or the equivalent project instruction file used by your AI agent.

```text
This project uses .ai/workflows/feature-development.yaml as the default AI Coding Workflow.

When the user provides a Feishu project requirement, task link, bug report, feature request, or refactoring request:
1. Read .ai/workflows/feature-development.yaml and .ai/rules/workflow-execution-rule.md before action.
2. Before each workflow stage, read every skill and rule file referenced by that stage.
3. Start with requirement analysis and project-level OpenSpec creation.
4. Do not jump directly into coding unless the user explicitly asks to skip the spec workflow.
5. Store OpenSpec assets under openspec/changes/{feature}/.
6. Treat OpenSpec as the project-level source of truth for requirement, spec, design, and acceptance criteria.
7. Use Superpowers from the active AI agent or harness, when available and allowed, as the execution discipline for planning, coding, verification, review, and archive.
8. Do not treat TodoWrite, internal task lists, chat summaries, or unstored reasoning as workflow artifacts.
9. Archive completed work under knowledge/archive/{feature}/ with the required files from .ai/skills/knowledge-archive/SKILL.md.
10. Update knowledge/archive/{feature}/stage-report.md using .ai/templates/stage-report.md at every stage.
11. Before handoff, run node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}.
```

This instruction lets the user write shorter daily prompts, such as:

```text
Handle this Feishu project requirement with the project workflow: {link}
```

## Feishu Project MCP Integration

When Feishu Project MCP (`FeishuProjectMcp`) is configured locally, the agent should use it before creating OpenSpec assets.

Recommended MCP pull sequence:

```text
1. Read the Feishu project task or project requirement.
2. Extract title, description, owner, status, priority, and due date.
3. Extract acceptance criteria.
4. Read comments and discussion decisions.
5. Download or summarize attachments when relevant.
6. Normalize the result into requirement context.
7. Create OpenSpec change files.
```

Recommended prompt:

```text
Use Feishu Project MCP (FeishuProjectMcp) to pull this requirement: {Feishu project link or task ID}

Then execute the project workflow:
1. Normalize the requirement context.
2. Create openspec/changes/{feature}/proposal.md.
3. Create openspec/changes/{feature}/spec.md.
4. Create openspec/changes/{feature}/design.md.
5. Stop for spec review before coding.
```

After approval:

```text
Spec approved. Continue the workflow using the approved OpenSpec change.

Complete:
- implementation plan
- code changes
- verification
- review report
- knowledge archive
- production handoff gate
```

## Multi-Agent Usage

Different agents can participate as long as they share the same project-level assets.

Recommended division:

```text
Requirement / product agent
-> Pull Feishu Project context
-> Normalize requirement
-> Create OpenSpec proposal

Architecture / planning agent
-> Review OpenSpec
-> Produce design and implementation plan
-> Check RepoWiki and CodeGraph when available

Developer agent
-> Implement the accepted spec
-> Keep scope constrained to OpenSpec

Test agent
-> Map acceptance criteria to tests
-> Generate or update verification
-> Record test-report.md

Review agent
-> Review correctness, risks, and test gaps
-> Record review-report.md

Archive agent
-> Collect final artifacts
-> Write knowledge/archive/{feature}/
```

The handoff rule is simple: each agent should read the current OpenSpec change before acting.
Each agent must also read the workflow stage's referenced skill and rule files before acting.

## Agent Guardrails

Use these rules in prompts or custom instructions:

- Do not code before the OpenSpec change exists, unless explicitly instructed.
- Do not treat the original Feishu Project text as the only source of truth after OpenSpec is created.
- Keep code changes scoped to the accepted spec.
- Map each acceptance criterion to verification evidence.
- Read each stage's referenced skill and rule files before executing that stage.
- Do not treat TodoWrite, internal task lists, or chat summaries as workflow artifacts.
- Do not skip non-optional stages without explicit user instruction.
- Update `knowledge/archive/{feature}/stage-report.md` at every stage.
- Run `node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}` before handoff.
- Archive requirement, spec, design, implementation, test, and review outputs.
- Keep Superpowers installed per AI agent or harness.
- Keep OpenSpec CLI globally installed, then initialize and maintain OpenSpec assets per project.

## Qoder CLI Validation Notes

The recommended two-step prompts were validated with Qoder CLI on 2026-07-16 using `Qwen3.7-Plus` against a simulated `loyalty-points` feature.

Validated path:

```text
FeishuProjectMcp pull/fallback
-> requirement-analysis
-> openspec-create
-> spec-review
-> user approval
-> implementation-plan
-> coding
-> test-generation
-> verification
-> code-review
-> archive
-> production artifact gate
```

Observed result:

```text
node --test
15 tests passed, 0 failed

node scripts/verify-workflow-artifacts.mjs --target . --feature loyalty-points
Result: PASS
```

Practical findings:

- Use the long two-step prompt for new agents or first-time project adoption.
- Write `FeishuProjectMcp` explicitly; do not only say "Feishu MCP".
- Keep the instruction "read every referenced skill/rule file before each stage".
- Keep the instruction "TodoWrite and chat summaries are not workflow artifacts".
- Require every `required_output` to exist on disk before a stage is considered complete.
- Use the minimal prompt only after the agent has confirmed it loaded project-level instructions.
- Full artifact gate is for final handoff; it is expected to fail if you intentionally stop after spec review.

Detailed validation report:

```text
docs/QODER_CLI_PROMPT_VALIDATION_zh.md
```

## Minimal Prompt

Once project custom instructions are configured, this should be enough for daily use:

```text
Handle this Feishu project requirement with the project workflow: {link}
```

For safer execution:

```text
Handle this Feishu project requirement with the project workflow: {link}
Stop after OpenSpec creation and wait for my confirmation.
```

For continuation:

```text
Spec approved. Continue implementation, verification, review, and archive.
```
