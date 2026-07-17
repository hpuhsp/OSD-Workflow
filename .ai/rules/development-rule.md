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

When strategy is `tdd`:

1. Red: write the smallest test that expresses one accepted behavior and confirm it fails for the expected reason.
2. Green: make the smallest coherent implementation that passes the test.
3. Refactor: improve code and tests without changing accepted behavior, then rerun relevant verification.

Repeat in small behavior increments. Record concise Red, Green, and Refactor evidence; do not paste full logs.

## Test-First

When strategy is `test_first`, establish a failing regression, reproduction, or characterization before editing, then implement until it passes. Refactor when useful, but a separate refactor cycle is not mandatory.

## Verification-Only

When strategy is `verification_only`, record why a meaningful test-first boundary is unavailable or disproportionate. Still run focused verification against the specification.

## Completion

- Run focused verification appropriate to the change.
- Record changed files, verification result, and residual risk in the delivery record.
- Do not generate additional process documents solely to satisfy ceremony.
