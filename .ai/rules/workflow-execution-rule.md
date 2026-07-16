# Workflow Execution Rule

## Purpose

Ensure AI agents execute `.ai/workflows/feature-development.yaml` as a binding workflow contract, not as optional guidance.

## Mandatory Preflight

Before starting or continuing feature work:

- Read `.ai/workflows/feature-development.yaml`.
- Identify the current stage and the next stage.
- Read every `skill` file referenced by the current stage.
- Read every `rules` file referenced by the current stage.
- If a referenced skill or rule file cannot be read, stop and report the missing file as a blocker.

## Stage Execution Rules

- A non-optional stage must not be skipped unless the user explicitly says to skip it.
- A stage with `skill` must follow that `SKILL.md` file before producing stage output.
- A stage with `rules` must follow all referenced rule files before producing stage output.
- Stage output must be a material file or a concrete verification result at the path required by the workflow, skill, or rule.
- Stage `required_outputs` in `.ai/workflows/feature-development.yaml` are binding production outputs.
- Internal task lists, TodoWrite entries, chat summaries, or unstored reasoning are not workflow artifacts.
- A conversation message only counts as evidence when the workflow explicitly allows conversational output for that stage.
- Verification must either run the relevant commands or document why they could not be run.
- Archive is incomplete until every required file listed by `.ai/skills/knowledge-archive/SKILL.md` exists.
- Optional stages may be skipped only when their dependency is unavailable or irrelevant; the skip reason must be recorded in the stage report.

## Required Stage Report

At each stage boundary, update `knowledge/archive/{feature}/stage-report.md` using `.ai/templates/stage-report.md`.

The report must include:

- Current stage id.
- Skill files read.
- Rule files read.
- Files created or updated.
- Verification commands run, when applicable.
- Blockers or skipped items, with explicit reason.
- Whether every `required_outputs` path for the stage exists.

## Done Criteria

- Every required stage has been executed in workflow order.
- Every referenced skill and rule for executed stages has been read before action.
- Every required artifact exists on disk.
- Test and review evidence are archived.
- `scripts/verify-workflow-artifacts.mjs --target . --feature {feature}` passes, when Node.js is available.
