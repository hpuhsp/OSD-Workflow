# Project OpenSpec Workspace

Run `openspec init` in each target project. OpenSpec is the specification source for every OSD Workflow task.

OSD selects specification depth but does not recreate OpenSpec commands or lifecycle behavior. Use the installed OpenSpec integration for proposal, specification, tasks, validation, apply, and archive. The paths below are the current OSD compatibility contract for minimum delivery verification.

Artifact depth scales by mode:

- `lite`: concise `openspec/changes/{feature}/spec.md`
- `standard`: `proposal.md` and `spec.md`; `design.md` when useful
- `strict`: full `proposal.md`, `spec.md`, and `design.md`

Every spec must define expected behavior, boundaries, and testable acceptance criteria before implementation begins. Record the OpenSpec change path and concise validation or acceptance result in the OSD delivery record.
