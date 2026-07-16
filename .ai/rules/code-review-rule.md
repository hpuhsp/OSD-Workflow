# Code Review Rule

## Purpose

Review code for behavioral correctness, engineering quality, and alignment with the accepted OpenSpec.

## Review Priorities

Review findings should focus on:

- Bugs and behavioral regressions
- Missing acceptance criteria
- Unsafe migrations or compatibility breaks
- Incomplete tests
- Security, privacy, or data integrity risks
- Maintainability issues that affect the current change

## Review Inputs

- OpenSpec proposal, spec, and design
- Implementation plan
- Changed files
- Test report
- CodeGraph impact analysis, when available
- RepoWiki context, when available

## Review Output

Write review evidence to `knowledge/archive/{feature}/review-report.md` and include:

- Summary of reviewed scope
- Findings ordered by severity
- Open questions or assumptions
- Required follow-up actions
- Final review result

## Done Criteria

- Critical and high severity issues are fixed or explicitly accepted.
- Test gaps are documented.
- Review result is archived with the requirement.
