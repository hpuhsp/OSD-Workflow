# Adaptive SDD Workflow

OSD Workflow is a lightweight team standard for specification-driven AI development.

## Control Model

OSD Workflow is the top-level controller. It decides task type, mode, development strategy, stage order, and required outputs before supporting methods are invoked.

- OpenSpec owns the specification inside the OSD specification stage.
- Superpowers supplies execution discipline inside the active OSD stage.
- Neither OpenSpec nor Superpowers may replace, prepend, skip, or reorder OSD stages.

For repository-changing work, load this file, `.ai/workflow-manifest.json`, and `.ai/rules/workflow-execution-rule.md` before announcing a process. Start with one line: `OSD: <task_type> | <mode> | <strategy> | <current_stage>`.

OSD is a thin control plane. It routes and governs minimum outcomes, then delegates native specification lifecycle work to OpenSpec and execution methods to Superpowers. It does not recreate either tool's internal workflow.

## Required Runtime

- Superpowers participates in specification support, implementation discipline, verification, and review inside OSD-controlled stages for every task.
- OpenSpec participates as the specification source for every task.
- The project stores shared workflow rules in `.ai/`, specifications in `openspec/changes/{feature}/`, and concise delivery evidence in `knowledge/archive/{feature}/`.

## What Stays Constant

Every task follows the same SDD baseline:

1. Specify expected behavior and acceptance criteria with OpenSpec.
2. Implement within the accepted specification through Superpowers-guided execution.
3. Verify the result with concrete evidence.

## What Scales

The amount of process scales with complexity and risk:

- `lite`: compact OpenSpec spec plus one delivery record containing focused verification.
- `standard`: OpenSpec proposal/spec, concise plan, and one delivery record containing verification and review.
- `strict`: full OpenSpec proposal/spec/design, review checkpoints, plan, implementation, full verification, review, archive.

The default is `standard`. Use `lite` for clear low-risk work and `strict` for high-risk, ambiguous, cross-module, or release-critical work.

## Development Strategy

After selecting a mode, select how implementation will be produced:

- `tdd`: Red -> Green -> Refactor for core executable behavior.
- `test_first`: failing reproduction/characterization -> implementation -> passing regression, especially for bugs and refactors.
- `verification_only`: implementation -> focused verification for docs, config, pure styling, or work without a practical test-first boundary.

TDD evidence stays in the existing delivery record. Do not create a separate TDD report.

## Task Types

- New feature: focus on value, scope, non-goals, acceptance, compatibility.
- Bug fix: focus on reproduction, expected behavior, root cause, regression evidence.
- Existing change: focus on current behavior, desired delta, compatibility, consumers.
- Refactor: focus on invariants, impact, rollback, regression coverage.
- Maintenance: focus on exact change, operational impact, focused verification.

## Machine Contract

`.ai/workflow-manifest.json` is the single machine-readable source for mode-specific required outputs. `.ai/workflows/feature-development.yaml` explains routing and human execution semantics without duplicating artifact lists.

Before handoff, run:

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode}
```

Add `--handoff` only when another agent will continue the work.
