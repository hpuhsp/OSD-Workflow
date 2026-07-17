# Adaptive SDD Execution Rule

## Goal

Use the smallest workflow that still makes the requested change specification-driven and verifiable.

The workflow standardizes outcomes, not ceremony. Do not execute stages or create files that do not improve clarity, delivery confidence, or handoff quality.

## Non-Negotiable SDD Baseline

Every task must satisfy three conditions:

1. Use Superpowers from the active agent or harness to route and execute the task.
2. Use OpenSpec as the specification source before implementation.
3. Keep implementation within that specification.
4. Run focused verification and record concrete evidence.

For a simple task, these may fit in three short files. More process is required only when complexity or risk justifies it.

## Route The Task First

Classify the task by type, complexity, risk, impact scope, uncertainty, and development strategy.

- `lite`: simple, localized, low-risk work with clear expected behavior.
- `standard`: normal feature, bug fix, or existing behavior change with moderate scope. This is the default when uncertain.
- `strict`: complex, cross-module, ambiguous, high-risk, regulated, data-sensitive, or release-critical work.

Task type changes the specification focus:

- New feature: user value, scope, non-goals, acceptance criteria, compatibility.
- Bug fix: reproduction, observed and expected behavior, root cause, regression evidence.
- Existing behavior change: current behavior, desired delta, compatibility, affected consumers.
- Refactor: behavior invariants, impact boundary, rollback, regression coverage.
- Maintenance/docs/config: exact change, operational impact, focused verification.

Record the selected task type and mode in `knowledge/archive/{feature}/stage-report.md`. Escalate the mode when new risk or uncertainty appears. A lighter user-requested mode is allowed when residual risk is recorded.

## Select A Development Strategy

The delivery mode controls process depth. The development strategy controls how implementation is produced.

- `tdd`: use Red -> Green -> Refactor. Select it for core business logic, algorithms, state machines, permissions, billing, public APIs, and other executable behavior where tests can drive design.
- `test_first`: capture a failing reproduction or characterization before editing, then make it pass. Select it for bug fixes, existing behavior changes, and refactors when a stable test boundary exists.
- `verification_only`: implement and run focused verification. Use it for docs, configuration, pure styling, exploratory work, or when test-first is impractical.

For `tdd`, record concise Red, Green, and Refactor evidence. For `test_first`, record Red and Green evidence. For `verification_only`, record why test-first is not appropriate.

Do not force TDD onto work without a meaningful executable test boundary. Do not use `verification_only` merely to avoid writing practical regression tests.

## Mode Rules

### Lite

Flow: Superpowers routing -> compact OpenSpec -> implementation -> verification.

- Keep `openspec/changes/{feature}/spec.md` concise: expected change, boundaries, acceptance criteria.
- Do not require a separate proposal, design, plan, review report, or full archive.
- Write one compact delivery record and focused verification evidence.

### Standard

Flow: Superpowers routing -> OpenSpec -> plan -> implementation -> verification -> review.

- Use a concise OpenSpec proposal and spec; add design only when it adds value.
- Keep the plan in `implementation.md` and the review in `review-report.md`.
- Avoid one report per stage. Update a single compact delivery record.

### Strict

Flow: Superpowers routing -> intake -> full OpenSpec -> spec review -> plan -> implementation -> verification -> review -> archive.

- Use the global OpenSpec CLI against the project workspace.
- Use full specification, design, verification, review, and archive evidence.
- Use the detailed stage report only when traceability requires it.

## Artifact Rules

The machine-readable required output list is `.ai/workflow-manifest.json`.

- Required outputs must be non-empty regular files.
- Internal task lists, TodoWrite entries, chat summaries, and unstored reasoning are not artifacts.
- A command result may be summarized; do not paste large logs when command, exit code, and key evidence are enough.
- Create `handoff-brief.md` only when another agent will continue the work.
- Do not duplicate the same information across requirement, spec, plan, and report files.

## Done Criteria

- The selected mode's required outputs exist and contain meaningful content.
- The delivery record identifies task type, mode, development strategy, specification, verification, and result.
- The specification points to the project OpenSpec workspace.
- Verification demonstrates the acceptance criteria or records why it could not, with residual risk.
- Run `node scripts/verify-workflow-artifacts.mjs --target . --feature {feature} --mode {mode}` before final handoff.
