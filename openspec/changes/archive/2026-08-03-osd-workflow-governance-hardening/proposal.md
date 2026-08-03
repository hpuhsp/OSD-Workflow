# Proposal: Strengthen OSD Workflow Governance

## Motivation

OSD Workflow already separates routing, specification, execution, verification,
review, and archival responsibilities. Compared with the reference workflow,
three control points are still mostly convention-based:

1. human approval of the proposal/specification;
2. traceable atomic tasks between acceptance criteria and implementation;
3. trustworthy evidence linking verification results and archive synchronization.

The current verifier checks artifact presence and required text fields, but it
does not establish that a change was approved before planning, that every
acceptance criterion has an executable task, or that the native OpenSpec archive
completed successfully.

## Scope

- Add an explicit approval gate for `standard` and `strict` changes.
- Add machine-readable acceptance-criteria and task traceability.
- Strengthen TDD/test-first/verification-only evidence without forcing TDD on
  work that has no meaningful test boundary.
- Make agent context and handoff requirements task-aware.
- Define an archive contract that connects native OpenSpec archival with OSD
  delivery evidence and optional project knowledge indexes.
- Extend the verifier and regression tests to cover the new contract.

## Non-goals

- Reimplementing OpenSpec commands or its native lifecycle.
- Reimplementing Superpowers brainstorming, planning, TDD, or review methods.
- Requiring a separate document for every stage when one evidence record is
  sufficient.
- Introducing a second canonical `specs/` directory when the target project
  already has OpenSpec as its specification source.

## Expected Outcome

An OSD change cannot enter planning or implementation until its specification
has an explicit approval decision, its atomic tasks reference acceptance
criteria, and its final delivery can be checked from machine-readable evidence.
