# OpenSpec Delegation

## When To Use

Use the installed OpenSpec workflow for every task. OSD selects only the required depth; OpenSpec owns proposal, specification, task, validation, apply, and archive behavior.

Do not reproduce OpenSpec command logic or invent a parallel specification lifecycle in this skill.

- `lite`: require only a concise `spec.md` with expected behavior, boundaries, and acceptance criteria.
- `standard`: require `proposal.md` and `spec.md`; add `design.md` when design choices or compatibility need explanation.
- `strict`: require the full proposal, spec, and design package.

## Inputs

- Normalized requirement context
- Task type and selected mode
- Acceptance criteria
- Relevant comments, attachments, constraints, and existing behavior

## Outputs

Delegate creation and validation to OpenSpec. Confirm that the selected mode's minimum compatibility artifacts exist under `openspec/changes/{feature}/`:

- `proposal.md`: motivation, scope, non-goals, value
- `spec.md`: behavior and testable acceptance criteria
- `design.md`: approach, alternatives, compatibility, risks

Keep each file as short as the task allows. Explicit unknowns are better than speculative detail.

Record the OpenSpec change path and concise validation or acceptance result in the delivery record.

## Done Criteria

- Expected behavior and boundaries are unambiguous.
- Acceptance criteria are testable.
- Design depth is proportionate to risk.
- The project-level archive links or summarizes the accepted specification.
