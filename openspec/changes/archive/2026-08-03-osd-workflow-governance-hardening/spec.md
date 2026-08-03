# Specification: OSD Workflow Governance Hardening

## Status

- Status: approved
- Change type: existing_change
- Target: OSD Workflow template, manifest, verifier, documentation, and tests
- Compatibility: manifest version must be incremented with a migration path

## Problem Statement

OSD currently expresses the desired lifecycle, but several critical transitions
are not represented as explicit machine-checkable state:

- a proposal can be treated as accepted without a recorded approval decision;
- implementation plans do not have to enumerate atomic tasks;
- tasks do not have to map to acceptance criteria or verification evidence;
- TDD evidence is checked as text rather than as structured execution evidence;
- agent context requirements are declared but task identity is not propagated;
- archive records do not prove that the native OpenSpec archive completed or
  that any project knowledge index was refreshed.

The improvement must close these gaps while preserving OSD's adaptive depth and
its rule that OpenSpec and Superpowers remain delegated systems rather than being
reimplemented by OSD.

## Goals

1. Make approval, planning, implementation, verification, review, and archive
   transitions explicit for the modes that require them.
2. Create traceability from acceptance criteria to tasks, changed files, tests,
   and final evidence.
3. Make verification evidence structured and auditable without executing
   arbitrary commands from untrusted markdown.
4. Ensure every implementation/test agent receives the same change and task
   context.
5. Preserve `lite` as a genuinely lightweight path.
6. Keep the OpenSpec workspace as the canonical specification source.

## Non-goals

- No replacement for the OpenSpec CLI or `/opsx:*` integrations.
- No OSD-owned implementation of brainstorming, writing-plans, TDD, debugging,
  or code-review mechanics.
- No mandatory human approval for low-risk `lite` work unless a project policy
  explicitly escalates it.
- No requirement to duplicate OpenSpec specifications into a separate `specs/`
  tree.

## Terminology

- **Change**: `openspec/changes/{feature}/`.
- **Acceptance criterion**: A uniquely identified, testable behavior in `spec.md`.
- **Task**: An atomic implementation or verification unit linked to one or more
  acceptance criteria.
- **Approval**: An explicit human decision allowing a change to enter planning.
- **Evidence**: Structured facts produced by a real verification step, including
  command identity, exit code, and covered criteria.
- **Archive completion**: Successful native OpenSpec archival plus a valid OSD
  delivery record.

## Target Lifecycle

```text
route
  -> proposal/specification
  -> approval gate (standard/strict)
  -> design and atomic task plan
  -> implementation strategy
  -> verification evidence
  -> risk-proportional review
  -> native OpenSpec archive and knowledge sync (when required)
```

`lite` remains:

```text
route -> concise spec -> implementation -> focused verification
```

## Requirements

### R1. Explicit change state

The change directory MUST contain one machine-readable state file named
`osd-state.json` for `standard` and `strict` work. `lite` MAY use it when a
handoff or escalation requires persistent state.

The file MUST contain:

```json
{
  "schema": "osd-change-state/v1",
  "feature": "feature-name",
  "task_type": "new_feature|bug_fix|existing_change|refactor|maintenance",
  "mode": "lite|standard|strict",
  "strategy": "tdd|test_first|verification_only",
  "stage": "specification|approval|planning|implementation|verification|review|archive|complete",
  "status": "draft|proposed|approved|in_progress|verified|reviewed|archived|blocked",
  "specification": "openspec/changes/feature-name/spec.md",
  "updated_at": "ISO-8601 timestamp"
}
```

The verifier MUST reject a state file whose mode, strategy, feature, or current
stage conflicts with the selected command arguments or required artifacts.

### R2. Approval gate

For `standard` and `strict` changes:

1. `proposal.md` and `spec.md` MUST exist and be non-empty.
2. `approval.md` MUST exist before `implementation.md` is considered valid.
3. `approval.md` MUST contain:
   - decision: `approved`, `rejected`, or `changes_requested`;
   - reviewer identity;
   - decision timestamp;
   - reviewed proposal/spec paths;
   - scope or acceptance-criteria notes;
   - residual risks or explicit `none`.
4. Only `approved` permits the planning stage to advance to implementation.
5. `rejected` or `changes_requested` MUST leave the change blocked.

For `strict`, `spec-review.md` remains the detailed review artifact when the
risk profile requires it. `approval.md` is the gate decision, not a replacement
for detailed findings.

### R3. Acceptance-criteria IDs

Every acceptance criterion in `spec.md` MUST have a stable ID using the form
`AC-<number>` or a project-approved equivalent.

Each criterion MUST state:

- expected behavior;
- boundary or non-goal;
- observable verification method;
- compatibility or migration impact when applicable.

The verifier MUST reject duplicate criterion IDs and MUST report criteria that
are referenced but not defined.

### R4. Atomic task plan

For `standard` and `strict`, `tasks.md` MUST exist in the change directory, or
the native OpenSpec task artifact MUST be discoverable through the configured
OpenSpec integration.

Each task MUST contain:

- task ID `T-<number>`;
- one-line objective;
- linked acceptance criteria, such as `AC-01`;
- affected areas or files;
- owner or agent role;
- dependency IDs, or `none`;
- completion status: `todo`, `in_progress`, `done`, or `blocked`;
- verification method.

Each non-trivial acceptance criterion MUST be covered by at least one task.
Tasks MUST be small enough to implement and verify independently where
practical. The plan MUST NOT redefine the accepted specification.

### R5. Task-aware agent context

Developer and test-agent contracts MUST require the following context before
execution:

- change feature name;
- `osd-state.json`;
- accepted `spec.md`;
- `tasks.md` or the native task artifact;
- the assigned task ID and linked acceptance criteria;
- relevant design/implementation context for `standard` and `strict`.

Handoff briefs MUST include the current task ID, completed task IDs, blocked
tasks, and the next task's acceptance-criteria links.

The verifier MUST reject a handoff that names a task ID not present in the task
plan.

### R6. Strategy-specific evidence

The existing strategies remain valid:

- `tdd`: Red -> Green -> Refactor;
- `test_first`: failing reproduction/characterization -> passing regression;
- `verification_only`: implementation -> focused verification with a reason.

For `standard` and `strict`, evidence MUST be represented in a structured
`verification.json` file or a tool-generated equivalent. Each evidence item MUST
include:

```json
{
  "step": "red|green|refactor|focused",
  "command_id": "repository-defined command identifier",
  "exit_code": 0,
  "observed_at": "ISO-8601 timestamp",
  "covered_acceptance_criteria": ["AC-01"],
  "summary": "short observed result"
}
```

The verifier MUST validate schema, strategy-specific required steps, exit-code
semantics, and criterion coverage. It MUST NOT execute arbitrary commands found
inside a user-authored artifact.

The project MAY provide an allowlisted verification runner that generates this
file from repository-defined commands such as `npm test`, structural verification,
and OpenSpec validation.

### R7. Delivery and review traceability

The delivery record MUST link:

- the accepted specification;
- the approval decision;
- the implementation plan and task IDs;
- changed files by task where practical;
- verification evidence;
- review findings and residual risks;
- archive result when archival is required.

The verifier MUST reject a `pass` result when any required acceptance criterion
has no task or verification evidence.

### R8. Archive and knowledge synchronization

For `strict` changes, archive completion MUST require:

1. successful native OpenSpec archive;
2. a final OSD delivery record with `Result: pass`;
3. valid `verification.json` and review evidence;
4. `osd-state.json` set to `archived` or `complete`;
5. an archive result containing the native command/result and archived change
   location.

For `standard`, native archive MAY be deferred according to project policy, but
the delivery record MUST state whether the change is active or archived.

If a target project maintains a canonical knowledge index, archive MUST update
that index through a project-provided hook. OSD MUST verify the hook result but
MUST NOT invent a duplicate canonical `specs/` tree.

### R9. Manifest and migration

The machine contract MUST be upgraded to a new manifest schema, for example
`osd-workflow-manifest/v4`, with:

- approval outputs and gate rules;
- task artifact discovery rules;
- state-file schema;
- verification evidence schema;
- archive completion policy;
- migration behavior for existing v3 changes.

Existing v3 changes MUST remain verifiable during migration. Migration MUST be
explicitly reported as legacy, and MUST NOT silently claim the new approval,
task-traceability, or structured-evidence guarantees.

### R10. Documentation and examples

Usage documentation MUST include:

- the six-stage target lifecycle;
- the adaptive `lite/standard/strict` mapping;
- an example approved proposal;
- an example task-to-criterion mapping;
- examples for all three development strategies;
- archive and knowledge-sync behavior;
- migration guidance from manifest v3.

The documentation MUST distinguish requirements enforced by the verifier from
processes delegated to OpenSpec or Superpowers.

## Acceptance Criteria

- **AC-01**: A standard change without an approved `approval.md` cannot pass
  delivery verification.
- **AC-02**: A strict change cannot pass unless its spec-review/approval,
  design, task plan, verification, review, and archive outputs are present.
- **AC-03**: Duplicate or undefined acceptance-criteria IDs fail verification.
- **AC-04**: An uncovered acceptance criterion fails verification.
- **AC-05**: A task referencing an undefined criterion or unknown task dependency
  fails verification.
- **AC-06**: The verifier accepts valid TDD, test-first, and verification-only
  evidence and rejects missing strategy-specific steps.
- **AC-07**: A passing delivery with incomplete task/evidence coverage fails
  verification even if the report text contains `Result: pass`.
- **AC-08**: Agent and handoff fixtures carry feature, task, and acceptance
  context; invalid task references fail verification.
- **AC-09**: Strict archive verification distinguishes active, archived, and
  blocked states and records the native archive result.
- **AC-10**: Existing v3 fixtures continue to pass legacy verification with an
  explicit legacy warning during migration.
- **AC-11**: The full repository test suite covers new pass/fail cases and the
  structural verifier remains passing.
- **AC-12**: Documentation explains which guarantees are hard-checked and which
  remain delegated to OpenSpec/Superpowers.

## Verification Plan

1. Unit-test state, approval, criterion, task, evidence, and archive parsers.
2. Add negative fixtures for missing approval, invalid IDs, uncovered criteria,
   incomplete evidence, invalid handoff tasks, and false archive claims.
3. Run the repository test suite and structural verifier.
4. Run a fixture-based standard delivery from proposal through review.
5. Run a fixture-based strict delivery through archive completion.
6. Run a v3 migration fixture and confirm the explicit legacy warning.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Added ceremony slows small changes | Keep all new gates out of default `lite` unless escalated. |
| Duplicate task system conflicts with OpenSpec | Prefer native OpenSpec task artifacts; make `tasks.md` a compatibility fallback. |
| Structured evidence is still forgeable | Generate evidence through an allowlisted runner and validate it in CI. |
| Migration breaks existing projects | Support v3 legacy verification and provide an explicit migration command/document. |
| Knowledge indexes differ by project | Use an optional project hook and verify its result instead of hard-coding one index. |
