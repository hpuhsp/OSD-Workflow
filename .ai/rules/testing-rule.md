# Testing And Verification Rule

## Verification Principle

Verification depth scales with risk, but every task needs concrete evidence against its acceptance criteria.

## Development Strategy Evidence

- `tdd`: preserve concise Red, Green, and Refactor evidence. Red must fail for the expected behavior gap, not because of a broken test environment.
- `test_first`: preserve concise failing-before and passing-after evidence.
- `verification_only`: record why test-first is not appropriate and provide focused verification.

Evidence belongs in the delivery record for lite and standard work. Strict work keeps a separate test report. Do not create a separate TDD report.

## By Mode

- `lite`: run the smallest focused command or manual check that proves the requested behavior.
- `standard`: cover acceptance criteria, relevant regression paths, and affected interfaces.
- `strict`: include full acceptance mapping, regression scope, failure cases, and any required non-functional checks.

## Bug Fixes

- Capture reproduction or observed behavior before the fix when practical.
- Add or identify regression evidence that fails before and passes after the fix.
- If a regression test is not practical, record the reason and residual risk.

## Evidence

For lite and standard work, record the following in `knowledge/archive/{feature}/stage-report.md`. Use `test-report.md` only when risk, complexity, or handoff value justifies a separate report. Strict work always writes `test-report.md` with:

- What was verified.
- Command or manual procedure.
- Exit code or observed result.
- Acceptance criteria covered.
- Gaps and residual risk.

Keep logs summarized unless full output is required for diagnosis.
