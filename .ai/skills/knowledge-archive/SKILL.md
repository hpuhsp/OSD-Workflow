# Knowledge Archive

## Purpose

Archive each completed requirement as a reusable engineering knowledge unit.

The archive belongs to the project-level OpenSpec workspace. Agent/Harness-level Superpowers may trigger the archive step, but the archived knowledge must stay with the project.

## Inputs

- Original requirement context
- OpenSpec proposal, spec, and design
- Implementation notes
- Test report
- Code review report
- Related decisions, risks, and unresolved follow-ups

## Output Path

Create or update:

```text
knowledge/archive/{feature}/
├── requirement.md
├── spec.md
├── design.md
├── implementation.md
├── test-report.md
└── review-report.md
```

## Steps

1. Copy or summarize the original requirement into `requirement.md`.
2. Archive the accepted OpenSpec spec and design.
3. Record implementation decisions and affected modules.
4. Record verification evidence and test gaps.
5. Record code review findings and final result.
6. Link related commits, issues, documents, or task IDs when available.

## Done Criteria

- The archive directory exists for the completed feature.
- Requirement, spec, design, implementation, test report, and review report are present.
- The archive explains why the change exists, what changed, and how it was verified.
