# AI Coding Workflow

This template defines a lightweight production-oriented workflow for running an OpenSpec + Superpowers AI coding process in a real project.

It is an integration template, not a replacement implementation for OpenSpec or Superpowers.

## Goal

Move feature work from direct prompt-to-code execution into a traceable engineering loop:

```text
Requirement
-> Specification
-> Plan
-> Implementation
-> Verification
-> Knowledge Archive
```

## Scope

This template is intentionally project-local and lightweight. It does not introduce a platform, marketplace, gateway, or GitLab automation layer.

## Local Environment Contract

This workflow assumes the following local setup:

- Superpowers is installed per AI agent or harness, usually as a user-level plugin or extension rather than a project dependency.
- OpenSpec CLI is installed globally, for example with `npm install -g @fission-ai/openspec@latest`.
- Each target project runs `openspec init` and maintains its own project-level OpenSpec workspace.
- This `.ai/` directory provides the project workflow contract, rules, and skill mapping.
- The project stores OpenSpec change assets under `openspec/changes/{feature}/`.
- The project stores completed requirement archives under `knowledge/archive/{feature}/`.

Recommended responsibility split:

```text
Agent / Harness level
-> Superpowers
-> General AI agent execution discipline
-> Reusable personal workflow habits

Global tool level
-> OpenSpec CLI
-> npm install -g @fission-ai/openspec@latest

Project level
-> openspec init
-> OpenSpec workspace assets
-> .ai workflow, rules, and skill mapping
-> openspec/changes
-> knowledge/archive
-> .qoder/repowiki
-> .codegraph
```

Superpowers answers how a specific agent or harness should execute the work.

OpenSpec CLI provides the toolchain; the initialized project OpenSpec workspace answers why the project should change, what should change, and how it will be accepted.

## Knowledge Boundaries

OpenSpec answers why a change exists:

- Requirement context
- Proposal
- Specification
- Design decisions
- Archive

RepoWiki answers what the system is:

- Project structure
- Architecture notes
- Module understanding

CodeGraph answers how code is connected:

- Call relationships
- Impact analysis
- Test generation support

These knowledge systems stay independent and should not be merged.

## Workflow

Use Agent/Harness-level Superpowers to orchestrate `.ai/workflows/feature-development.yaml` as the default production workflow:

1. Requirement analysis
2. OpenSpec creation through the project OpenSpec workspace
3. Spec review
4. Implementation planning
5. Coding
6. CodeGraph impact analysis
7. Test generation
8. Verification
9. Code review
10. Knowledge archive

## Execution Contract

The workflow is a binding execution contract.

- Read `.ai/workflows/feature-development.yaml` before starting or continuing feature work.
- Read `.ai/workflow-manifest.json` as the compact stage index when present.
- Before each stage, read every `skill` and `rules` file referenced by that stage unless the same file was already read in this run and its hash is unchanged.
- If a referenced file cannot be read, stop and report it as a blocker.
- Do not treat internal task lists, TodoWrite entries, chat summaries, or unstored reasoning as workflow artifacts.
- Do not skip non-optional stages unless the user explicitly asks to skip them.
- Verification must run relevant commands or document why they could not be run.
- Archive is incomplete until `.ai/skills/knowledge-archive/SKILL.md` required files exist.
- Production handoff requires `scripts/verify-workflow-artifacts.mjs --target . --feature {feature}` to pass when Node.js is available.

## Token Optimization Modes

Use `standard` mode by default:

- `strict`: highest assurance, rereads referenced files at every stage, uses full stage reports.
- `standard`: daily production mode, reuses previously-read files when hashes are unchanged, uses compact stage reports, and writes handoff briefs for agent transitions.
- `lite`: low-risk user-approved shortcut, still requires verification evidence and final artifact gate.

Use `.ai/templates/stage-report-compact.md` for standard/lite mode and `.ai/templates/handoff-brief.md` when another agent continues the work.

## Expected Outputs

For each real requirement, the workflow should produce:

- `openspec/changes/{feature}/proposal.md`
- `openspec/changes/{feature}/spec.md`
- `openspec/changes/{feature}/design.md`
- `knowledge/archive/{feature}/requirement.md`
- `knowledge/archive/{feature}/spec.md`
- `knowledge/archive/{feature}/design.md`
- `knowledge/archive/{feature}/implementation.md`
- `knowledge/archive/{feature}/test-report.md`
- `knowledge/archive/{feature}/review-report.md`
- `knowledge/archive/{feature}/stage-report.md`
- `knowledge/archive/{feature}/handoff-brief.md` when work is handed to another agent

## Operating Rules

- Start from requirement context before implementation.
- Treat Superpowers as Agent/Harness-level execution capability, not as project-owned content.
- Treat OpenSpec CLI as a globally installed toolchain.
- Treat initialized OpenSpec workspace assets as the project-level source of truth for requirement, spec, design, and archive.
- Keep acceptance criteria explicit and testable.
- Generate or update tests according to risk and impact.
- Use CodeGraph for impact analysis when available.
- Use RepoWiki for architecture and module context when available.
- Archive the final requirement, design, implementation, verification, and review results.
