# Project OpenSpec Workspace

Run `openspec init` in each target project. OpenSpec is the specification source for every OSD Workflow task.

Artifact depth scales by mode:

- `lite`: concise `openspec/changes/{feature}/spec.md`
- `standard`: `proposal.md` and `spec.md`; `design.md` when useful
- `strict`: full `proposal.md`, `spec.md`, and `design.md`

Every spec must define expected behavior, boundaries, and testable acceptance criteria before implementation begins.
