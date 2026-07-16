# Workflow Execution Rule

## Purpose

Ensure AI agents execute `.ai/workflows/feature-development.yaml` as a binding workflow contract, not as optional guidance.

## Mandatory Preflight

Before starting or continuing feature work:

- Read `.ai/workflows/feature-development.yaml`.
- Read `.ai/workflow-manifest.json` when present and use it as the compact stage index.
- Identify the current stage and the next stage.
- Read every `skill` file referenced by the current stage unless it was already read in this run and its hash is unchanged.
- Read every `rules` file referenced by the current stage unless it was already read in this run and its hash is unchanged.
- If a referenced skill or rule file cannot be read, stop and report the missing file as a blocker.

## Execution Modes

Use `standard` mode by default.

- `strict`: reread referenced files at every stage and use the full stage report. Use for high-risk, ambiguous, regulated, or release-critical work.
- `standard`: reuse previously-read files when their hash is unchanged, use compact stage reports, and keep handoff briefs for agent transitions.
- `lite`: only for low-risk work when the user explicitly allows a shortcut. Verification evidence and final artifact gate still remain required.

If the user requests a mode, record it in `knowledge/archive/{feature}/stage-report.md`.

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
- Do not paste full previously-read workflow, skill, rule, OpenSpec, or archive files back into context when a stable path, hash, and short summary are enough.
- When another agent continues the work, create or update `knowledge/archive/{feature}/handoff-brief.md` using `.ai/templates/handoff-brief.md`.

## Required Stage Report

At each stage boundary, update `knowledge/archive/{feature}/stage-report.md`.

Use:

- `.ai/templates/stage-report-compact.md` in `standard` or `lite` mode.
- `.ai/templates/stage-report.md` in `strict` mode, or when a blocker, skipped non-optional stage, failed verification, or material risk requires detail.

The report must include:

- Current stage id.
- Execution mode.
- Skill files read.
- Rule files read.
- Hashes or timestamps for referenced files reused from prior context.
- Files created or updated.
- Verification commands run, when applicable.
- Blockers or skipped items, with explicit reason.
- Whether every `required_outputs` path for the stage exists.

## Done Criteria

- Every required stage has been executed in workflow order.
- Every referenced skill and rule for executed stages has been read before action.
- Every required artifact exists on disk.
- Test and review evidence are archived.
- If work crosses agent boundaries, `knowledge/archive/{feature}/handoff-brief.md` exists and points to the next required context.
- `scripts/verify-workflow-artifacts.mjs --target . --feature {feature}` passes, when Node.js is available.
