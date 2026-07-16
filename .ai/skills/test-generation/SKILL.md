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
4. Keep tests focused on changed behavior and impacted contracts.
5. Run or define the minimum required verification commands.
6. Record results and gaps in the test report.

## Output

Create or update:

```text
knowledge/archive/{feature}/test-report.md
```

Recommended structure:

```markdown
# Test Report: {Feature Name}

## Scope

## Acceptance Criteria Mapping

## Commands

## Results

## Coverage Notes

## Gaps and Risks
```

## Done Criteria

- Acceptance criteria have verification coverage.
- Test commands or manual verification steps are documented.
- Residual risk is explicit.
- Results are written to `knowledge/archive/{feature}/test-report.md`; an internal todo list or chat summary does not satisfy this skill.
- If verification commands cannot be run, the reason and residual risk are documented in the test report.
