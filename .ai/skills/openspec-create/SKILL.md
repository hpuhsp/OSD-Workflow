# OpenSpec Create

## When To Use

Use OpenSpec for every task. The selected mode controls how much of the change package is required.

- `lite`: require only a concise `spec.md` with expected behavior, boundaries, and acceptance criteria.
- `standard`: require `proposal.md` and `spec.md`; add `design.md` when design choices or compatibility need explanation.
- `strict`: require the full proposal, spec, and design package.

## Inputs

- Normalized requirement context
- Task type and selected mode
- Acceptance criteria
- Relevant comments, attachments, constraints, and existing behavior

## Outputs

Create only the files required by the selected mode under `openspec/changes/{feature}/`:

- `proposal.md`: motivation, scope, non-goals, value
- `spec.md`: behavior and testable acceptance criteria
- `design.md`: approach, alternatives, compatibility, risks

Keep each file as short as the task allows. Explicit unknowns are better than speculative detail.

## Done Criteria

- Expected behavior and boundaries are unambiguous.
- Acceptance criteria are testable.
- Design depth is proportionate to risk.
- The project-level archive links or summarizes the accepted specification.
