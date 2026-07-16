# Implementation Plan

## Purpose

Translate an accepted OpenSpec change into a concrete implementation plan before editing code.

This step is expected to be orchestrated by user-level Superpowers using project-level OpenSpec context.

## Inputs

- `openspec/changes/{feature}/proposal.md`
- `openspec/changes/{feature}/spec.md`
- `openspec/changes/{feature}/design.md`
- RepoWiki context, when available
- CodeGraph context, when available
- Existing source code

## Steps

1. Identify affected modules, files, interfaces, and tests.
2. List required code changes in execution order.
3. Identify compatibility, migration, and rollback concerns.
4. Decide the minimum verification scope.
5. Record assumptions and unresolved questions.

## Output

Append or create an implementation section in:

```text
knowledge/archive/{feature}/implementation.md
```

Recommended structure:

```markdown
# Implementation Plan: {Feature Name}

## Affected Areas

## Steps

## Verification Plan

## Risks

## Assumptions
```

## Done Criteria

- The plan maps to the accepted spec.
- Affected areas are explicit.
- Verification scope is defined before implementation.
