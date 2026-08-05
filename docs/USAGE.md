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
6. Run the native OpenSpec archive, then verify the archived delivery.

## Modes

### Lite

For clear, localized, low-risk work.

```text
OSD route -> compact OpenSpec spec -> implementation -> focused verification -> native archive
```

Required artifacts:

```text
openspec/changes/{feature}/spec.md
openspec/changes/{feature}/archive-result.json
knowledge/delivery/{feature}/stage-report.md
```

`lite` does not require a proposal, implementation plan, test report, or review report. Add those only when they improve risk control or handoff.

### Standard

Default for medium-scope daily work.

```text
OSD route -> OpenSpec proposal/spec -> approval -> atomic tasks -> concise plan -> implementation -> verification -> concise review -> native archive
```

Verification and review are summarized in `stage-report.md`; separate reports are optional unless risk or handoff value justifies them.

Required artifacts are `proposal.md`, `spec.md`, `approval.md`, `osd-state.json`, `tasks.md`, `verification.json`, `archive-result.json`, `knowledge/delivery/{feature}/implementation.md`, and `stage-report.md`.

### Strict

For complex, ambiguous, cross-module, high-risk, regulated, or release-critical work.

```text
OSD route -> full OpenSpec -> spec review -> approval -> atomic tasks -> plan -> implementation -> full verification -> review -> archive
```

Required artifacts are `proposal.md`, `spec.md`, `design.md`, `approval.md`, `osd-state.json`, `tasks.md`, `verification.json`, `archive-result.json`, `implementation.md`, `test-report.md`, `review-report.md`, and `stage-report.md` under their mode-specific directories.

## Development Strategies

- `tdd`: Red -> Green -> Refactor for core business logic, algorithms, state machines, permissions, billing, public APIs, and other executable behavior.
- `test_first`: failing reproduction or characterization -> implementation -> passing regression for bugs, existing behavior changes, and refactors.
- `verification_only`: implementation -> focused verification for docs, config, pure styling, exploration, or work without a practical test-first boundary. Record the reason.

Mode controls process depth; strategy controls implementation mechanics. A simple business rule can use `lite + tdd`, while a complex configuration migration may use `strict + verification_only`.

## Runtime Governance (Release 0.7)

Runtime governance is local-first and policy-first. It adds no OSD scheduler, MCP server, RAG store, or hosted control plane. The sole managed catalog is `.ai/runtime-governance/governance.json`; per-change evidence stays next to its OpenSpec change.

For standard and strict work, first create a runnable package for every atomic task:

```bash
node scripts/runtime-governance.mjs context --feature {feature} --task T-01 --owned-area src/example.js --isolated true
```

Then record metadata-only lifecycle events, evaluate deterministic checks against `AC-*`, and create the summary:

```bash
node scripts/runtime-governance.mjs authorize --feature {feature} --action '{"command_id":"node-test","role":"test_verifier","paths":["test/example.test.mjs"]}'
node scripts/run-verified-command.mjs --feature {feature} --command-id node-test --step focused --criteria AC-01
node scripts/runtime-governance.mjs evaluate --feature {feature}
node scripts/runtime-governance.mjs record-event --feature {feature} --event '{"schema":"osd-run-event/v1","run_id":"run-1","feature":"{feature}","task_id":"T-01","stage":"verification","actor_role":"test_verifier","event_type":"verification_completed","status":"completed","timestamp":"2026-08-05T00:00:00+08:00","contract_version":"1"}'
node scripts/runtime-governance.mjs summarize --feature {feature}
```

`authorize` is a pure permit-or-deny check. `run-verified-command.mjs` executes only a catalog-defined argv, then writes attested structured evidence. Use `--require-trusted-evidence` with the final verifier once the project has migrated its delivery process; this opt-in gate prevents old self-reported evidence from being misrepresented as attested evidence.

## Native Archive

After verification, archive every completed change through the controlled native command:

```bash
node scripts/archive-openspec-change.mjs --feature {feature}
```

Use `--skip-specs` only when the completed change has no specification delta. The command runs `openspec archive`, confirms the active change directory was moved beneath `openspec/changes/archive/`, then writes `archive-result.json` as an audit record. It is not accepted as self-reported proof. Run the final delivery verifier after this command.

Use `.ai/evals/routing-cases.json` and `.ai/evals/pilot-scorecard.template.json` for a pilot. Review mode selection, gate failures, policy denials, retries, delivery duration, and human intervention before changing the workflow depth or adding infrastructure.

The coordinator routes, decomposes, assigns, and aggregates but never writes business code. One executor has exclusive write ownership for an atomic task. Test verifier and reviewer are read-only; neither merges changes. Monitor only reports timeout, retry, authorization, verification-coverage, and blockage signals; it cannot approve delivery or remediate code. `lite` uses the executor by default, `standard` enables independent roles when risk demands them, and `strict` requires executor, test verifier, reviewer, and monitor completion evidence.

Events and evaluation records must omit prompts, source, credentials, and raw tool I/O. Deterministic checks are mandatory for a pass. Model-assisted graders are optional and must be recorded as `pass`, `fail`, or `not_run`. A future adapter may expose catalog resources through read-only MCP resources and policy-approved narrow tools, but transport, authentication, scheduling, worktrees, and sandboxes stay in the harness.

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

When a requirement comes from Feishu Project, use the available `FeishuProjectMcp` integration to pull only the context needed for routing and specification. If that integration is unavailable, continue only when the supplied requirement context is sufficient and record its source; do not treat guessed or synthetic data as an actual Feishu lookup.

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

Add `--with-docs` to refresh usage guides and `--dry-run` to preview. Update overwrites template-managed files but preserves project-owned active changes, native OpenSpec archives, and delivery records.

When upgrading an active delivery from manifest v3, use the migration guidance
to add approval, state, task, and structured-evidence artifacts. Legacy v3
verification must be explicit and must not claim the v4 guarantees.

## Verification

Verify a delivery:

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode}
```

`--target <project>` is available when the command is run outside the target project. `--mode` is optional: without it, the verifier reads the mode from `stage-report.md`, then uses `standard`. A successful delivery reports `Result: DELIVERY PASS`; structural-only checks report `STRUCTURAL PASS`.

Require a cross-agent handoff brief:

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode} --handoff
```

Verify only the installed contract:

```bash
node scripts/verify-workflow-artifacts.mjs --structural-only
```

The verifier checks regular, non-empty required files, approval state, `AC-*` criteria, `T-*` task coverage, structured evidence, selected delivery-record fields, strategy evidence, and the actual native OpenSpec archive location. It does not execute arbitrary commands from artifacts or audit chat history.

For standard and strict work, a passing delivery requires an approved `approval.md`,
an `osd-state.json` in a final state, tasks covering every acceptance criterion, and
`verification.json` covering those criteria. Every completed mode requires a
successful native OpenSpec archive. `lite` remains exempt from the approval,
state, task, and structured-evidence gates unless the task is escalated.

## Compact Delivery Record

For lite and standard work, record only task type, selected mode, OSD/OpenSpec/Superpowers participation, specification path, changed files, verification command/result, review result or N/A, and residual risk.

Use the full report only for strict work. Create `handoff-brief.md` only when another agent will continue the task.

## Agent Discovery And Minimal Prompt

The installer safely adds an OSD managed block to the root `AGENTS.md` by default. On a new Agent session, a normal request is enough:

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

Qoder is supported through its native `AGENTS.md` compatibility. Keep the generated root `AGENTS.md`; do not create a second `.qoder/rules` copy. If the project uses another Agent, copy the managed block to its native entry path only when needed: `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, or `.cursor/rules/osd-workflow.mdc`. Cursor additionally needs `alwaysApply: true` frontmatter.
