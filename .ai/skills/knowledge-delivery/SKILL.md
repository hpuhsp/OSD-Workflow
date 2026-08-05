# Knowledge Delivery

## Principle

Keep only the delivery context worth reusing. Required files are defined per mode in `.ai/workflow-manifest.json`.

Standard and strict changes must retain the approval decision, change state,
atomic task mapping, and structured verification evidence alongside the native
OpenSpec artifacts. These are traceability records, not replacements for the
native OpenSpec archive lifecycle.

## Lite

Keep only:

- `openspec/changes/{feature}/spec.md`
- `stage-report.md`

## Standard

Keep:

- `openspec/changes/{feature}/proposal.md`
- `openspec/changes/{feature}/spec.md`
- `implementation.md`
- `stage-report.md`

Add `requirement.md`, `test-report.md`, `review-report.md`, or optional OpenSpec files only when they add useful context or risk control.

## Strict

Keep links to the accepted OpenSpec spec/design plus the implementation decisions, verification, review, and delivery record required by the manifest. Do not copy OpenSpec content into duplicate delivery files.

## Handoff

Create `handoff-brief.md` only when another agent will continue the task. It is conditional, not a universal archive requirement.

Avoid copying the same text into multiple files. Link to the source when a short reference is sufficient.
