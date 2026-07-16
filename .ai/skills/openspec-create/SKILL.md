# OpenSpec Create

## Purpose

Convert a project requirement into an OpenSpec change package that can guide design, implementation, testing, and archive.

This skill mapping assumes OpenSpec CLI is installed globally and the target project has been initialized with `openspec init`. It describes how the project should use OpenSpec; it does not implement OpenSpec itself.

## Inputs

- Requirement title
- Requirement description
- Acceptance criteria
- Comments or discussion context
- Attachments or references
- RepoWiki context, when available
- CodeGraph context, when available

## Output Path

Create or update:

```text
openspec/changes/{feature}/
├── proposal.md
├── spec.md
└── design.md
```

## Steps

0. Confirm OpenSpec CLI is available and the target repository has run `openspec init`.
1. Normalize the requirement into a concise problem statement.
2. Extract explicit acceptance criteria.
3. Identify affected users, systems, modules, and constraints.
4. Draft `proposal.md` with motivation, scope, and expected value.
5. Draft `spec.md` with behavior, acceptance criteria, and non-goals.
6. Draft `design.md` with implementation approach, tradeoffs, and risks.
7. Mark unresolved questions clearly instead of hiding assumptions.

## Proposal Template

```markdown
# Proposal: {Feature Name}

## Motivation

## Scope

## Non-Goals

## Acceptance Criteria

## Risks
```

## Spec Template

```markdown
# Spec: {Feature Name}

## Behavior

## Requirements

## Acceptance Criteria

## Compatibility

## Open Questions
```

## Design Template

```markdown
# Design: {Feature Name}

## Context

## Proposed Approach

## Affected Modules

## Alternatives Considered

## Risks and Mitigations
```

## Done Criteria

- The project-level OpenSpec workspace is the source of truth for the change package.
- The change has a dedicated `openspec/changes/{feature}/` directory.
- Proposal, spec, and design are present.
- Acceptance criteria are testable.
- Open questions are explicit.
