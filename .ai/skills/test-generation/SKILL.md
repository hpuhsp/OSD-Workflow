# Test Generation

## Purpose

Generate focused verification for the accepted OpenSpec change using the strongest available context.

This step is expected to be orchestrated by Agent/Harness-level Superpowers. The project-level OpenSpec workspace remains the source for acceptance criteria.

## Context Priority

Use context in this order:

1. OpenSpec spec
2. Current code changes
3. CodeGraph
4. RepoWiki
5. Source code

## Inputs

- Acceptance criteria
- Implementation plan
- Changed files
- Existing test framework and test patterns
- CodeGraph impact analysis, when available
- RepoWiki context, when available

## Steps

1. Map each acceptance criterion to a verification method.
2. Reuse the existing project test framework and conventions.
3. Add regression coverage for bug fixes when practical.
4. Update affected existing tests when the accepted spec changes prior expected behavior.
5. Keep tests focused on changed behavior and impacted contracts.
6. Run or define the minimum required verification commands.
7. Record the planned tests, acceptance-criteria mapping, and any known gaps in the test plan.

## Output

Create or update:

```text
knowledge/archive/{feature}/test-plan.md
knowledge/archive/{feature}/stage-report.md
```

Recommended structure:

```markdown
# Test Plan: {Feature Name}

## Scope

## Acceptance Criteria Mapping

## Commands

## Expected Results

## Coverage Notes

## Gaps and Risks
```

## Done Criteria

- Acceptance criteria have verification coverage.
- Test commands or manual verification steps are documented.
- Residual risk is explicit.
- The test plan is written to `knowledge/archive/{feature}/test-plan.md`; an internal todo list or chat summary does not satisfy this skill.
- Actual command results are written later by the `verification` stage to `knowledge/archive/{feature}/test-report.md`.
- If verification commands cannot be run later, the reason and residual risk must be documented in the verification-stage test report.
- Stage report records files read, tests generated or updated, and verification command status.
