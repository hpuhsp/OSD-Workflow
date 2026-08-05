# Adaptive SDD Execution Rule

## Goal

Use the smallest workflow that still makes the requested change specification-driven and verifiable.

The workflow standardizes outcomes, not ceremony. Do not execute stages or create files that do not improve clarity, delivery confidence, or handoff quality.

## Orchestration Precedence

OSD Workflow is the top-level controller. It owns task classification, mode selection, development strategy, stage order, and required outputs.

- OpenSpec is the specification authority inside the OSD specification stage.
- Superpowers is the required execution method inside the active OSD stage.
- OpenSpec and Superpowers must not replace, prepend, skip, or reorder OSD stages.
- Superpowers brainstorming belongs inside the OSD specification stage. It is not a top-level stage before OpenSpec.
- Standard and strict work must record explicit approval before planning advances to implementation.

Before announcing or executing a process:

1. Read `.ai/AI_WORKFLOW.md`, `.ai/workflow-manifest.json`, and this rule.
2. Classify the task and select the mode and development strategy.
3. Announce only `OSD: <task_type> | <mode> | <strategy> | <current_stage>`.
4. Invoke OpenSpec and Superpowers only in their roles within the current OSD stage.

For standard and strict work, the required OpenSpec artifacts, `osd-state.json`,
`approval.md`, `tasks.md`, and structured `verification.json` evidence must exist
before implementation or final delivery.

Do not lead with “Superpowers is loaded” or restate a generic `brainstorm -> plan -> implement` process. For `standard` and `strict`, the required OpenSpec artifacts must exist before planning or implementation.

## Non-Negotiable SDD Baseline

Every task must satisfy four conditions:

1. Use OSD Workflow to route and control the task.
2. Use OpenSpec as the specification source before implementation.
3. Use Superpowers as the execution method within the selected OSD stages.
4. Keep implementation within that specification and record focused verification evidence.

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

`intake` is conditional. Run it only when the request and repository context are insufficient to classify or specify the task. Otherwise begin at `specification`.

## Delegate, Do Not Duplicate

- OSD owns routing and minimum outcome governance only.
- OpenSpec owns its native specification and change lifecycle.
- Superpowers owns planning, implementation discipline, TDD, debugging, verification, and review methods inside the selected OSD stages.
- Do not recreate OpenSpec commands or Superpowers skill internals in OSD rules.
- Record concise OpenSpec and Superpowers participation evidence in the delivery record.

## Select A Development Strategy

The delivery mode controls process depth. The development strategy controls how implementation is produced.

- `tdd`: use Red -> Green -> Refactor. Select it for core business logic, algorithms, state machines, permissions, billing, public APIs, and other executable behavior where tests can drive design.
- `test_first`: capture a failing reproduction or characterization before editing, then make it pass. Select it for bug fixes, existing behavior changes, and refactors when a stable test boundary exists.
- `verification_only`: implement and run focused verification. Use it for docs, configuration, pure styling, exploratory work, or when test-first is impractical.

For `tdd`, record concise Red, Green, and Refactor evidence. For `test_first`, record Red and Green evidence. For `verification_only`, record why test-first is not appropriate.

Do not force TDD onto work without a meaningful executable test boundary. Do not use `verification_only` merely to avoid writing practical regression tests.

Acceptance criteria use stable `AC-*` identifiers. Standard and strict tasks use
stable `T-*` identifiers and must link each non-trivial acceptance criterion to
an atomic task and verification evidence.

## Mode Rules

### Lite

Flow: OSD route -> compact OpenSpec with Superpowers assistance -> implementation -> verification.

- Keep `openspec/changes/{feature}/spec.md` concise: expected change, boundaries, acceptance criteria.
- Do not require a separate proposal, design, plan, review report, or full archive.
- Put focused verification and review evidence in one compact delivery record. Create separate reports only when they add value.

### Standard

Flow: OSD route -> OpenSpec with Superpowers assistance -> approval -> atomic tasks -> plan -> implementation -> verification -> review.

- Use a concise OpenSpec proposal and spec; add design only when it adds value.
- Keep the plan in `implementation.md` and summarize verification and review in the compact delivery record.
- Create separate test or review reports only when complexity, risk, or handoff value justifies them.

### Strict

Flow: OSD route -> optional intake -> full OpenSpec with Superpowers assistance -> spec review -> approval -> atomic tasks -> plan -> implementation -> verification -> review -> archive.

- Use the global OpenSpec CLI against the project workspace.
- Use full specification, design, verification, review, and archive evidence.
- Use the detailed stage report only when traceability requires it.

## Runtime Governance

For `standard` and `strict` delivery, use the single resource and policy catalog at `.ai/runtime-governance/governance.json`.

- Generate one runnable context package per atomic `T-*` task under `openspec/changes/{feature}/context/`.
- The coordinator routes, decomposes, assigns, and aggregates; it does not write business code.
- Each atomic task has exactly one active write-capable executor with declared owned areas and isolated execution.
- Test verifier and reviewer stay read-only. They run approved verification or inspect the specification, task, diff, and evidence; neither merges changes.
- Monitor stays read-only and may only report timeout, retry, policy, verification, or blockage signals. It cannot approve delivery or modify code.
- `lite` defaults to the executor only; `standard` adds test/review/monitor only when risk requires them; `strict` requires executor, test verifier, reviewer, and monitor evidence.
- Record metadata-only runtime events in `run-events.jsonl`; do not store prompts, source, credentials, raw inputs, or raw tool outputs.
- Record deterministic acceptance-criterion evaluation in `evaluation.json` and derive `runtime-summary.json` from the event log.

## Artifact Rules

The machine-readable required output list is `.ai/workflow-manifest.json`.

- Required outputs must be non-empty regular files.
- Internal task lists, TodoWrite entries, chat summaries, and unstored reasoning are not artifacts.
- A command result may be summarized; do not paste large logs when command, exit code, and key evidence are enough.
- Create `handoff-brief.md` only when another agent will continue the work.
- Do not duplicate the same information across requirement, spec, plan, and report files.

## Done Criteria

- The selected mode's required outputs exist and contain meaningful content.
- The delivery record declares `osd_workflow` as controller and contains non-empty OpenSpec and Superpowers participation evidence.
- The delivery record identifies task type, mode, development strategy, specification, verification, and result.
- The specification points to the project OpenSpec workspace.
- Verification demonstrates the acceptance criteria or records why it could not, with residual risk.
- Run `node scripts/verify-workflow-artifacts.mjs --target . --feature {feature} --mode {mode}` before final handoff.
