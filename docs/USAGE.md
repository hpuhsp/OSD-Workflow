# OSD Workflow Usage Guide

## Core Rule

OSD Workflow controls every repository-changing task. OpenSpec and Superpowers participate under that control:

- OSD owns task classification, mode, strategy, stage order, and required outputs.
- OpenSpec defines expected behavior and acceptance criteria inside the specification stage.
- Superpowers provides execution, verification, and review discipline inside the active OSD stage.
- Neither supporting capability may replace or reorder OSD stages.
- Complexity changes process depth and artifact volume, not whether these capabilities participate.

The shared SDD baseline is: specify first, implement to the specification, verify with evidence.

OSD routes and governs minimum outcomes only. OpenSpec owns its native specification lifecycle, and Superpowers owns its internal planning, implementation, TDD, debugging, verification, and review methods.

## Route In Six Steps

1. Classify the task: `new_feature`, `bug_fix`, `existing_change`, `refactor`, or `maintenance`.
2. Assess complexity, risk, impact scope, and uncertainty.
3. Select `lite`, `standard`, or `strict`.
4. Select `tdd`, `test_first`, or `verification_only` as the development strategy.
5. Execute each OSD stage with Superpowers and escalate if new risk appears.
6. Run the lightweight delivery verifier.

## Modes

### Lite

For clear, localized, low-risk work.

```text
OSD route -> compact OpenSpec spec -> implementation -> focused verification
```

Required artifacts:

```text
openspec/changes/{feature}/spec.md
knowledge/archive/{feature}/stage-report.md
```

### Standard

Default for medium-scope daily work.

```text
OSD route -> OpenSpec proposal/spec -> concise plan -> implementation -> verification -> concise review
```

Verification and review are summarized in `stage-report.md`; separate reports are optional unless risk or handoff value justifies them.

### Strict

For complex, ambiguous, cross-module, high-risk, regulated, or release-critical work.

```text
OSD route -> full OpenSpec -> spec review -> plan -> implementation -> full verification -> review -> archive
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
Execute with OSD: fix {bug}.
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
Execute with OSD using the Feishu requirement at {link or ID}.
```

## Updating The Workflow

```bash
osd-workflow update .
```

To fetch and apply the latest GitHub version in one command:

```bash
npx --yes github:hpuhsp/OSD-Workflow update .
```

Add `--with-docs` to refresh usage guides and `--dry-run` to preview. Update overwrites template-managed files but preserves project-owned OpenSpec changes and knowledge archives.

When upgrading an active delivery to manifest v3, add the OSD controller plus non-empty OpenSpec and Superpowers participation fields to its existing `stage-report.md`.

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

For lite and standard work, record only task type, selected mode, OSD/OpenSpec/Superpowers participation, specification path, changed files, verification command/result, review result or N/A, and residual risk.

Use the full report only for strict work. Create `handoff-brief.md` only when another agent will continue the task.

## Agent Discovery And Minimal Prompt

The installer safely adds an OSD managed block to common project instruction files. On a new Agent session, a normal request is enough:

```text
Fix the login timeout regression.
```

If the Agent does not load repository instructions, use:

```text
Execute with OSD: {task}
```

Expected startup response:

```text
OSD: bug_fix | lite | test_first | specification
```

An opening such as “Superpowers loaded; brainstorm, plan, implement...” is incorrect because it bypasses OSD routing and stage ownership.
