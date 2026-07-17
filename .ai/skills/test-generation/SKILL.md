# Test Generation

## Goal

Choose the smallest verification set that credibly proves the accepted specification.

## Steps

1. Map acceptance criteria to automated tests, static checks, or manual verification.
2. Prioritize changed behavior and likely regression paths.
3. For bug fixes, capture regression evidence when practical.
4. Reuse the project's test framework and conventions.
5. Run the checks or state why they could not run.

## Strategy

- For `tdd`, confirm the new behavior test fails for the expected reason before implementation, passes after the minimum implementation, and remains green after refactoring.
- For `test_first`, confirm a regression or characterization fails before editing and passes afterward.
- For `verification_only`, record why test-first is not practical and run focused verification.

## Outputs

- Always write actual results to `knowledge/archive/{feature}/test-report.md`.
- Create a separate `test-plan.md` only for strict work or when test design is materially complex.
- Do not create a separate TDD report; use the delivery record for concise Red/Green/Refactor evidence.
