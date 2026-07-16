# Development Rule

## Purpose

Ensure implementation work follows the accepted OpenSpec and remains traceable from requirement to code.

## Required Inputs

- Requirement title and description
- Acceptance criteria
- OpenSpec proposal and spec, when available
- Existing RepoWiki context, when available
- Existing CodeGraph context, when available

## Development Principles

- Do not start coding until the requirement and expected behavior are clear.
- Prefer the existing project architecture, framework, and conventions.
- Keep changes scoped to the accepted requirement.
- Avoid unrelated refactoring during feature or bug-fix work.
- Record meaningful design decisions in `openspec/changes/{feature}/design.md`.
- Update documentation only when behavior, interfaces, setup, or operational expectations change.

## Implementation Checklist

- Confirm the feature or fix maps to an OpenSpec change.
- Identify affected modules and integration points.
- Review related RepoWiki and CodeGraph context when available.
- Produce an implementation plan before code changes.
- Implement the smallest coherent change that satisfies the spec.
- Keep compatibility and migration impact explicit.
- Prepare verification evidence before archiving.

## Done Criteria

- Implementation satisfies acceptance criteria.
- Relevant tests pass or a documented reason explains why they could not run.
- Code review findings are resolved or documented.
- Knowledge archive is updated for the completed requirement.
