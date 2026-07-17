# OSD Workflow Usage Guide

## Core Rule

OpenSpec and Superpowers participate in every task:

- OpenSpec defines expected behavior and acceptance criteria.
- Superpowers routes and executes the task with verification and review discipline.
- Complexity changes process depth and artifact volume, not whether these capabilities participate.

The shared SDD baseline is: specify first, implement to the specification, verify with evidence.

## Route In Six Steps

1. Classify the task: `new_feature`, `bug_fix`, `existing_change`, `refactor`, or `maintenance`.
2. Assess complexity, risk, impact scope, and uncertainty.
3. Select `lite`, `standard`, or `strict`.
4. Select `tdd`, `test_first`, or `verification_only` as the development strategy.
5. Execute through Superpowers and escalate if new risk appears.
6. Run the lightweight delivery verifier.

## Modes

### Lite

For clear, localized, low-risk work.

```text
Superpowers routing -> compact OpenSpec spec -> implementation -> focused verification
```

Required artifacts:

```text
openspec/changes/{feature}/spec.md
knowledge/archive/{feature}/test-report.md
knowledge/archive/{feature}/stage-report.md
```

### Standard

Default for medium-scope daily work.

```text
Superpowers routing -> OpenSpec proposal/spec -> concise plan -> implementation -> verification -> concise review
```

### Strict

For complex, ambiguous, cross-module, high-risk, regulated, or release-critical work.

```text
Superpowers routing -> full OpenSpec -> spec review -> plan -> implementation -> full verification -> review -> archive
```

## Development Strategies

- `tdd`: Red -> Green -> Refactor for core business logic, algorithms, state machines, permissions, billing, public APIs, and other executable behavior.
- `test_first`: failing reproduction or characterization -> implementation -> passing regression for bugs, existing behavior changes, and refactors.
- `verification_only`: implementation -> focused verification for docs, config, pure styling, exploration, or work without a practical test-first boundary. Record the reason.

Mode controls process depth; strategy controls implementation mechanics. A simple business rule can use `lite + tdd`, while a complex configuration migration may use `strict + verification_only`.

## Task Examples

### Simple Bug

Start with `lite`. Specify reproduction, observed behavior, expected behavior, acceptance criteria, and regression evidence.

```text
Use Superpowers and OpenSpec to fix {bug} with OSD Workflow lite mode.
Record reproduction, observed/expected behavior, and acceptance criteria in the OpenSpec spec first.
Select test_first, establish failing regression evidence, implement the smallest fix until it passes, and write a compact delivery record.
```

### Existing Behavior Change

Use `lite` for a local low-risk delta, otherwise `standard`. Specify current behavior, desired delta, unchanged behavior, compatibility, and affected consumers.

### New Feature

Use `standard` by default and `strict` for cross-module or high-risk work. Specify user value, scope, non-goals, scenarios, acceptance criteria, and compatibility before coding.

### Refactor

Use `lite` for a local refactor, `standard` for normal refactors, and `strict` for architecture changes. Specify behavior invariants, impact boundary, rollback, and regression coverage.

### Maintenance, Docs, Or Config

Usually use `lite`. Keep the OpenSpec spec short and avoid separate plan/review files unless operational or compatibility risk justifies them.

## FeishuProjectMcp

When a requirement comes from Feishu Project, use `FeishuProjectMcp` to pull only the context needed for routing and specification.

```text
Use FeishuProjectMcp to pull {link or ID}.
Use Superpowers to classify task type, complexity, risk, and impact.
Select an OSD Workflow mode and create the corresponding OpenSpec specification before implementation.
```

## Verification

Verify a delivery:

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode}
```

Require a cross-agent handoff brief:

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode} --handoff
```

Verify only the installed contract:

```bash
node scripts/verify-workflow-artifacts.mjs --structural-only
```

The verifier checks only minimal delivery facts. It does not audit chat history or require a report for every stage.

## Compact Delivery Record

For lite and standard work, record only task type, selected mode, specification path, changed files, verification command/result, review result or N/A, and residual risk.

Use the full report only for strict work. Create `handoff-brief.md` only when another agent will continue the task.

## Project Instruction

```text
This project uses OSD Workflow adaptive SDD.
Superpowers and OpenSpec must participate in every development task.
First classify task type, complexity, risk, scope, and uncertainty.
Select lite, standard, or strict from .ai/workflows/feature-development.yaml.
Select tdd, test_first, or verification_only as the development strategy.
Follow only the selected mode's required flow and outputs from .ai/workflow-manifest.json.
Always specify before coding and record focused verification evidence.
For tdd/test_first, record concise failing-before and passing-after evidence.
Do not add process documents that are not required by the selected mode.
```
