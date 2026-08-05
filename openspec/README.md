# Project OpenSpec Workspace

Run `openspec init` in each target project after installing OSD Workflow. This repository only provides the compatible `openspec/` layout; it does not install or replace the OpenSpec CLI. OpenSpec is the specification source for every OSD Workflow task.

OSD selects specification depth but does not recreate OpenSpec commands or lifecycle behavior. Use the installed OpenSpec integration for proposal, specification, tasks, validation, apply, and archive. The paths below are the current OSD compatibility contract for minimum delivery verification.

Artifact depth scales by mode:

- `lite`: concise `openspec/changes/{feature}/spec.md`
- `standard`: `proposal.md` and `spec.md`; `design.md` when useful
- `strict`: full `proposal.md`, `spec.md`, and `design.md`

Every spec must define expected behavior, boundaries, and testable acceptance criteria before implementation begins. Record the OpenSpec change path and concise validation or acceptance result in `knowledge/delivery/{feature}/stage-report.md`.

For standard and strict changes, OSD additionally requires an explicit approval
decision, `osd-state.json`, atomic `T-*` tasks covering `AC-*` criteria, and
structured `verification.json` evidence. These files strengthen the OSD delivery
contract without replacing OpenSpec's native proposal, task, validation, apply,
or archive lifecycle.

Use the current OpenSpec CLI lifecycle for proposal, specification, validation, apply, and archive. Every accepted completed OSD change uses native `openspec archive`; OpenSpec moves it under `openspec/changes/archive/`, while `knowledge/delivery/` retains only supplementary delivery records.
