# Usage Guide

This guide explains how to use this workflow in daily multi-agent development, including prompt patterns, project custom instructions, and Lark MCP integration.

## Mental Model

Use this template as a project-level workflow contract.

```text
User-level Superpowers
-> How the AI agent should execute work
-> Planning, sequencing, verification, review discipline

Project-level OpenSpec
-> Why the project should change
-> What should change
-> How the change will be accepted
-> What knowledge should be archived

Project-level .ai template
-> Shared workflow, rules, skill mappings, and agent context contract
```

The normal flow is:

```text
Lark requirement
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
Use Lark MCP to read this requirement: {Lark requirement link or task ID}

Follow the current project workflow at .ai/workflows/feature-development.yaml.

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
```

This keeps the requirement-to-spec boundary explicit and prevents agents from jumping directly from a rough description into code.

## Prompt Templates

### Create OpenSpec From Lark Requirement

```text
Use Lark MCP to read requirement {Lark link or task ID}.

Extract:
- title
- background
- description
- acceptance criteria
- comments and decisions
- attachments or screenshots
- priority and expected release constraints

Then create a project-level OpenSpec change under openspec/changes/{feature}/.

Required files:
- proposal.md
- spec.md
- design.md

Follow:
- .ai/workflows/feature-development.yaml
- .ai/skills/openspec-create/SKILL.md

Stop after creating the OpenSpec change and wait for review.
```

### Continue After Spec Approval

```text
The OpenSpec change openspec/changes/{feature}/ is approved.

Continue the workflow:
- use .ai/skills/implementation-plan/SKILL.md
- follow .ai/rules/development-rule.md
- generate verification with .ai/skills/test-generation/SKILL.md
- follow .ai/rules/testing-rule.md
- review with .ai/rules/code-review-rule.md
- archive with .ai/skills/knowledge-archive/SKILL.md

Keep implementation scoped to the approved OpenSpec change.
```

### Handle A Bug Fix

```text
Use the current project AI workflow to handle this bug: {bug description or Lark link}.

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

When the user provides a Lark requirement, task link, bug report, feature request, or refactoring request:
1. Start with requirement analysis and project-level OpenSpec creation.
2. Do not jump directly into coding unless the user explicitly asks to skip the spec workflow.
3. Store OpenSpec assets under openspec/changes/{feature}/.
4. Treat OpenSpec as the project-level source of truth for requirement, spec, design, and acceptance criteria.
5. Use user-level Superpowers, when available and allowed, as the execution discipline for planning, coding, verification, review, and archive.
6. Archive completed work under knowledge/archive/{feature}/.
```

This instruction lets the user write shorter daily prompts, such as:

```text
Handle this Lark requirement with the project workflow: {link}
```

## Lark MCP Integration

When Lark MCP is configured locally, the agent should use it before creating OpenSpec assets.

Recommended MCP pull sequence:

```text
1. Read the Lark task or project requirement.
2. Extract title, description, owner, status, priority, and due date.
3. Extract acceptance criteria.
4. Read comments and discussion decisions.
5. Download or summarize attachments when relevant.
6. Normalize the result into requirement context.
7. Create OpenSpec change files.
```

Recommended prompt:

```text
Use Lark MCP to pull this requirement: {Lark link or task ID}

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
```

## Multi-Agent Usage

Different agents can participate as long as they share the same project-level assets.

Recommended division:

```text
Requirement / product agent
-> Pull Lark context
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

## Agent Guardrails

Use these rules in prompts or custom instructions:

- Do not code before the OpenSpec change exists, unless explicitly instructed.
- Do not treat the original Lark text as the only source of truth after OpenSpec is created.
- Keep code changes scoped to the accepted spec.
- Map each acceptance criterion to verification evidence.
- Archive requirement, spec, design, implementation, test, and review outputs.
- Keep Superpowers user-level and OpenSpec project-level.

## Minimal Prompt

Once project custom instructions are configured, this should be enough for daily use:

```text
Handle this Lark requirement with the project workflow: {link}
```

For safer execution:

```text
Handle this Lark requirement with the project workflow: {link}
Stop after OpenSpec creation and wait for my confirmation.
```

For continuation:

```text
Spec approved. Continue implementation, verification, review, and archive.
```
