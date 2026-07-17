# Knowledge Archive

## Principle

Archive only the context worth reusing. Required files are defined per mode in `.ai/workflow-manifest.json`.

## Lite

Keep only:

- `openspec/changes/{feature}/spec.md`
- `test-report.md`
- `stage-report.md`

## Standard

Keep:

- `openspec/changes/{feature}/proposal.md`
- `openspec/changes/{feature}/spec.md`
- `implementation.md`
- `test-report.md`
- `review-report.md`
- `stage-report.md`

Add `requirement.md` or OpenSpec files only when they add useful context.

## Strict

Keep the complete requirement, accepted spec/design, implementation decisions, verification, review, and delivery record required by the manifest.

## Handoff

Create `handoff-brief.md` only when another agent will continue the task. It is conditional, not a universal archive requirement.

Avoid copying the same text into multiple files. Link to the source when a short reference is sufficient.
