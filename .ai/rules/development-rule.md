# Development Rule

## Before Editing

- Read the selected specification.
- Confirm the task type and mode recorded in the delivery record.
- Confirm the selected development strategy: `tdd`, `test_first`, or `verification_only`.
- Inspect only the code and context needed to understand the affected behavior.
- Escalate the mode if scope, uncertainty, or risk is larger than expected.

## Implementation

- Make the smallest coherent change that satisfies the specification.
- Preserve existing behavior outside the declared change.
- Follow repository conventions and avoid unrelated cleanup.
- For standard and strict work, record affected areas and key decisions in `implementation.md`.
- For lite work, a separate implementation plan is optional.

## TDD

When strategy is `tdd`, use the active Superpowers TDD method. OSD does not redefine that method; it requires only concise Red, Green, and Refactor evidence against the accepted OpenSpec behavior.

## Test-First

When strategy is `test_first`, use the applicable Superpowers debugging or test-first method. OSD requires concise failing-before and passing-after evidence but does not prescribe the internal steps.

## Verification-Only

When strategy is `verification_only`, use Superpowers verification discipline, record why a meaningful test-first boundary is unavailable or disproportionate, and provide focused evidence against the specification.

## Completion

- Run focused verification appropriate to the change.
- Record changed files, verification result, and residual risk in the delivery record.
- Do not generate additional process documents solely to satisfy ceremony.
