# Agent Runtime Governance

## ADDED Requirements

### Requirement: Task-scoped context package

The workflow SHALL generate a versioned, task-scoped context package for
standard and strict changes before implementation or verification. The package
MUST reference the approved change state, accepted specification, assigned task,
linked acceptance criteria, verification method, and active execution policy.
It MUST store identifiers and paths rather than duplicate full specification
text.

#### Scenario: Generate a runnable package for an approved task

- **GIVEN** a standard change with an approved proposal, accepted spec, and a
  todo task linked to AC-01
- **WHEN** the context generator is invoked for that task
- **THEN** it produces a versioned package marked runnable
- **AND** the package identifies the change, task, AC-01, verification method,
  and execution-policy path

#### Scenario: Reject a mismatched or unapproved task

- **GIVEN** an unapproved change, an unknown task ID, an unsatisfied dependency,
  or a task that references undefined criteria
- **WHEN** context generation is requested
- **THEN** it produces a non-runnable result with a machine-readable reason code

### Requirement: Unified resource catalog and adapter boundary

The workflow SHALL maintain one local runtime catalog for accepted
specifications, task plans, state, verification evidence, review records,
archive records, policy references, and evaluation-suite references. Every entry
MUST declare a stable versioned identifier, canonical owner, read/write
capability, sensitivity classification, and stage constraint. Managed runtime
configuration MUST live beneath one OSD directory and MUST NOT be copied into
per-agent resource directories. The catalog MUST NOT require an MCP server.

#### Scenario: Describe canonical workflow resources locally

- **GIVEN** an opted-in project
- **WHEN** its runtime resource catalog is read
- **THEN** the catalog identifies OpenSpec artifacts as canonical where
  applicable
- **AND** it describes OSD compatibility records without replacing them or
  creating per-agent copies
- **AND** no network service is required to consume the catalog

### Requirement: Policy-controlled execution

The workflow SHALL validate a repository-owned execution policy containing
named command IDs, path boundaries, role capabilities, and approval thresholds.
Policy evaluation MUST be pure validation and MUST NOT execute command strings
found in user-authored workflow artifacts.

#### Scenario: Block a prohibited or unapproved action

- **GIVEN** a task whose requested command ID, path, capability, or approval
  state violates policy
- **WHEN** policy evaluation is performed
- **THEN** the result is blocked with a reason code
- **AND** no user-authored command string is executed

### Requirement: Privacy-safe run telemetry

The workflow SHALL record append-safe lifecycle events containing run ID,
feature, task ID when applicable, stage, role, event type, status, timestamp,
and contract version. Raw prompts, source code, credentials, and raw tool
input/output MUST be excluded by default.

#### Scenario: Summarize a completed and blocked run

- **GIVEN** metadata-only events for one completed run and one blocked run
- **WHEN** the local runtime summarizer is invoked
- **THEN** it reports run counts, completed/blocked state, supplied duration or
  retry information, and verification/evaluation outcomes
- **AND** the summary contains no raw prompts, source code, credentials, or raw
  tool payloads

### Requirement: Deterministic evaluation baseline

The workflow SHALL create a versioned evaluation record for standard and strict
changes. A passing delivery MUST include linked deterministic repository checks.
Optional model-assisted grading MAY be recorded only with evaluator identity,
rubric version, and a pass/fail/not_run result.

#### Scenario: Block delivery after deterministic evaluation failure

- **GIVEN** a standard change whose required deterministic check has failed
- **WHEN** final delivery verification is performed
- **THEN** the delivery result fails
- **AND** an unavailable optional model-assisted grader is reported as not_run,
  never as pass

### Requirement: Policy-defined subagent roles and single-writer execution

The workflow SHALL define coordinator, executor, test_verifier, reviewer, and monitor role profiles in its unified runtime catalog. The coordinator MUST NOT modify business code. An executor MUST be the only active write-capable role for one atomic task's owned area. Test_verifier and reviewer MUST be read-only by default. Monitor MUST be read-only and MUST NOT approve delivery or remediate source changes.

Parallel assignments SHALL be allowed only for dependency-independent tasks with explicit ownership and adapter-provided isolated worktrees or sandboxes. This change SHALL define contracts and validation only; it SHALL NOT implement an OSD-owned scheduler, queue, worktree manager, or monitor daemon.

#### Scenario: Permit independent isolated assignments

- **GIVEN** two dependency-independent tasks with distinct owned areas and an adapter that confirms isolated execution
- **WHEN** the coordinator requests parallel executor assignments
- **THEN** policy validation permits the assignments
- **AND** each executor receives only its assigned task-scoped context package

#### Scenario: Reject concurrent writers and monitor overreach

- **GIVEN** two write-capable executors assigned to the same task or owned area
- **WHEN** assignment validation is performed
- **THEN** the second assignment is rejected with a single-writer reason code
- **AND** a monitor finding cannot change source, approve delivery, or create an automatic remediation action

### Requirement: Mode- and risk-based subagent triggers

The workflow SHALL apply subagent triggers by mode and risk. Lite SHALL use a single executor by default and MAY invoke independent verification after failure, escalation, or explicit policy trigger. Standard SHALL invoke test and review roles when configured risk or scope thresholds require them. Strict SHALL require test_verifier, reviewer, and monitor outputs before final delivery review.

#### Scenario: Require independent validation for strict delivery

- **GIVEN** a strict change with completed implementation
- **WHEN** final delivery verification is requested
- **THEN** it fails if required test_verifier, reviewer, or monitor output is absent
- **AND** it records the missing role output as a blocked delivery reason

### Requirement: Explicit legacy compatibility

The workflow SHALL preserve validation of existing manifest v4 changes until a
project opts into runtime governance. Legacy reports MUST state that
runtime-governance checks were not applied.

#### Scenario: Verify a v4 change without opt-in

- **GIVEN** a valid v4 fixture that has no context package, runtime events, or
  evaluation record
- **WHEN** delivery verification is run in legacy mode
- **THEN** the fixture remains valid according to v4 rules
- **AND** the report emits an explicit runtime-governance-not-enabled warning
