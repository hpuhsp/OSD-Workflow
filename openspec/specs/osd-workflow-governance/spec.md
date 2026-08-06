# osd-workflow-governance Specification

## Purpose
Provides machine-checkable governance for OSD changes so approval, task traceability, verification evidence, and archival status are explicit without replacing OpenSpec or delegated development methods.
## Requirements
### Requirement: Change state and approval are explicit

The workflow SHALL persist `osd-state.json` for standard and strict changes, and SHALL require an approved `approval.md` before implementation is considered eligible. The state SHALL identify the feature, mode, strategy, stage, status, specification path, and update time.

#### Scenario: Standard change advances after approval
- **WHEN** a standard change has non-empty proposal and specification documents and an approval decision of `approved`
- **THEN** the verifier permits the change to advance to planning or implementation

#### Scenario: Unapproved change is blocked
- **WHEN** a standard or strict change has no approval decision or has `rejected` or `changes_requested`
- **THEN** the verifier rejects implementation or delivery verification

### Requirement: Acceptance criteria and tasks are traceable

The workflow SHALL require stable acceptance-criterion IDs and atomic tasks that reference defined criteria, affected areas, ownership, dependencies, status, and verification methods. Every non-trivial acceptance criterion SHALL be covered by at least one task.

#### Scenario: Complete task traceability passes
- **WHEN** each defined acceptance criterion is referenced by one or more valid tasks and every dependency names an existing task
- **THEN** the verifier accepts the task plan

#### Scenario: Undefined or uncovered criteria fail
- **WHEN** a task references an unknown criterion, a criterion ID is duplicated, or a criterion has no task
- **THEN** the verifier reports a traceability error and rejects the change

### Requirement: Verification evidence is structured and strategy-aware

For standard and strict changes, verification SHALL be represented by `verification.json` or an equivalent tool-generated artifact. Each evidence item SHALL record its strategy step, command identifier, zero or non-zero exit code, observation time, covered criteria, and summary. The verifier SHALL enforce the required steps for `tdd`, `test_first`, and `verification_only` without executing commands from user-authored documents.

#### Scenario: Valid strategy evidence passes
- **WHEN** evidence contains all required steps for the selected strategy, successful exit codes, and coverage for required criteria
- **THEN** the verifier accepts the verification evidence

#### Scenario: Incomplete evidence fails
- **WHEN** required strategy steps are missing, a command exits unsuccessfully, or required criteria are not covered
- **THEN** the verifier rejects verification even if a report claims success

### Requirement: Agent handoffs carry task context

Developer and test-agent execution contracts SHALL require the feature name, accepted specification, state file, task plan, assigned task ID, and linked acceptance criteria. Handoffs SHALL record completed tasks, blocked tasks, and the next task context.

#### Scenario: Task-aware handoff passes
- **WHEN** a handoff identifies an assigned task that exists in the task plan and links its defined acceptance criteria
- **THEN** the verifier accepts the handoff context

#### Scenario: Unknown task handoff fails
- **WHEN** a handoff names a task ID that is absent from the task plan
- **THEN** the verifier rejects the handoff

### Requirement: Delivery and archive status are evidenced

The delivery record SHALL link the accepted specification, approval, task IDs, changed files where practical, verification evidence, review findings, residual risks, and archive result. Strict changes SHALL require successful native OpenSpec archival, a passing delivery record, valid evidence and review artifacts, an archived or complete state, and the native archive result with its archived location.

#### Scenario: Strict archive completion passes
- **WHEN** native OpenSpec archive succeeds and all required delivery, evidence, review, and state artifacts are valid
- **THEN** the verifier records the change as archived or complete

#### Scenario: False archive claim fails
- **WHEN** a strict delivery claims `pass` or `archived` but native archive evidence or required traceability is missing
- **THEN** the verifier rejects the delivery

### Requirement: Legacy migration is explicit

The workflow SHALL continue to verify existing v3 changes during migration, but SHALL label them as legacy and SHALL NOT infer the new approval, task-traceability, or structured-evidence guarantees from legacy artifacts.

#### Scenario: Legacy change remains verifiable
- **WHEN** a v3 change passes its legacy artifact checks and is identified as a migration-era change
- **THEN** verification passes with an explicit legacy warning

#### Scenario: New guarantees are not silently inferred
- **WHEN** a legacy change lacks the new approval or structured evidence artifacts
- **THEN** the verifier reports the missing guarantees instead of claiming full v4 compliance

