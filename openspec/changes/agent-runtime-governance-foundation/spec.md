# Specification: Agent Runtime Governance Foundation

## Status

- Status: approved
- Change type: existing_change
- Target: OSD Workflow template, verifier, CLI helpers, fixtures, and documentation
- Intended delivery mode: standard
- Compatibility: manifest v4 projects remain valid until they explicitly opt in

## Problem Statement

OSD currently guarantees specifications, task traceability, verification, review, and archive evidence. It does not define a consistent runtime interface for agents to obtain approved context, validate permissions, emit operational signals, or establish a repeatable quality baseline.

This creates four gaps: each harness reconstructs context differently; command/tool permissions remain primarily instruction-based; pass/fail records cannot show delivery latency, retries, blocked actions, or handoffs; and teams cannot compare models, prompts, or tool integrations against a stable evaluation suite.

## Goals

1. Keep OSD a thin, tool-neutral governance layer.
2. Make minimum agent context machine-readable and task-scoped.
3. Add policy-as-data for execution risk, approvals, and command allowlists without executing user-authored commands.
4. Provide structured, privacy-safe events and evaluation summaries that work locally now and through future adapters later.
5. Preserve existing file workflows and v4 changes during migration.
6. Define portable subagent roles and safety boundaries while leaving concrete
   scheduling, worktree provisioning, and sandbox lifecycle to harness adapters.

## Requirements

### R1. Task-scoped context package

For standard and strict changes, OSD MUST generate a context package before implementation or verification. It MUST contain:

- feature, task type, mode, strategy, stage, and state-file path;
- accepted proposal/specification paths and linked acceptance-criteria IDs;
- assigned task ID, dependencies, affected areas, and verification method;
- policy path, allowed resource IDs, contract version, and generation timestamp.

The package MUST store paths and IDs rather than duplicate the complete specification. An unapproved change, unknown task, unsatisfied dependency, or mismatched criterion MUST produce a non-runnable package. Lite MAY use a compact package for handoffs or audits.

### R2. Unified resource catalog and MCP boundary

OSD MUST define one repository-local runtime catalog as the canonical entry point for accepted specs, task plans, state, verification evidence, review records, archive records, execution-policy references, and evaluation-suite references. Each entry MUST have a stable versioned ID, read/write capability, sensitivity classification, required workflow stage, and canonical-owner field.

The runtime catalog MUST avoid per-agent copies and scattered top-level configuration. Managed runtime configuration MUST be resolved from this one catalog and grouped under one dedicated OSD directory; per-change context, telemetry, and evaluation outputs MAY remain with their corresponding OpenSpec change for traceability.

The catalog MUST not start a network service or require MCP. A future adapter MAY expose catalog entries as read-only MCP resources and policy-approved actions as narrowly scoped tools.

### R3. Execution policy

OSD MUST support a repository-owned execution-policy file with allowed command IDs, prohibited command categories and path boundaries, approval thresholds by mode/risk, allowed tool/resource capabilities by role, and data-capture defaults.

Validation MUST be pure. Helpers and verifiers MUST NOT execute command strings discovered in specifications, tasks, telemetry, or other user-authored artifacts. A policy denial or missing approval MUST produce a machine-readable blocked result.

### R4. Run telemetry

OSD MUST define append-safe run events. Each event MUST include run ID, feature, task ID when applicable, stage, actor/role, event type, status, timestamp, and contract version.

Optional fields MAY include duration, command ID, tool ID, retry count, external trace ID, and token/cost totals. Raw prompts, source code, secrets, credentials, and raw tool input/output MUST be excluded by default.

A local summarizer MUST report run count, completed/blocked state, supplied stage duration, verification outcome, and evaluation outcome. Missing optional telemetry MUST not fail delivery verification.

### R5. Evaluation baseline

For standard and strict work, OSD MUST define a versioned evaluation record linked to the change, context-package version, policy version, deterministic verification, and covered acceptance criteria.

A passing result MUST include deterministic repository checks. Optional model-assisted grading MAY be recorded, but it MUST include grader identity, rubric version, and a pass/fail/not_run status without retaining raw inputs by default. Required deterministic-check failure blocks final delivery; an unavailable optional grader MUST report not_run rather than pass.

### R6. Policy-defined subagent roles

The unified runtime catalog MUST define coordinator, executor, test_verifier, reviewer, and monitor profiles. A coordinator routes work, creates the task graph, assigns roles, and aggregates results; it MUST NOT modify business code. An executor performs one assigned atomic task and is the only role allowed to modify that task's owned area. Test_verifier and reviewer are read-only by default; reviewer MUST NOT merge, approve, or change source files. Monitor reads run events and policy outcomes to report timeout, retry, authorization, verification-coverage, and blocked-task signals; it MUST NOT modify source, approve delivery, or automatically remediate findings.

Policy MUST define triggers by mode and risk. Lite uses one executor by default and MAY invoke independent verification after failure, escalation, or an explicit trigger. Standard uses an executor and MAY invoke test_verifier and reviewer when risk, scope, or policy requires independent validation. Strict MUST invoke test_verifier, reviewer, and monitor before final delivery review.

Parallel execution MUST be allowed only for dependency-independent tasks with explicit ownership and adapter-provided isolated worktrees or sandboxes. A task MUST have no more than one active write-capable executor. This phase defines role, trigger, context, and result contracts only; it MUST NOT implement an OSD-owned scheduler, queue, worktree manager, or monitor daemon.

### R7. Compatibility and documentation

Existing manifest v4 changes MUST remain verifiable until a project opts into the new contract. Legacy reports MUST say runtime-governance checks were not applied.

Chinese and English documentation MUST cover: context generation, policy authoring, privacy defaults, deterministic versus model-assisted evaluation, role boundaries, mode/risk triggers, monitor authority limits, future MCP adapter boundaries, migration, and rollback.

## Acceptance Criteria

- AC-01: A valid standard change generates a runnable context package pointing to its approved spec, assigned task, linked criteria, and policy.
- AC-02: Unknown task, unapproved change, unsatisfied dependency, or mismatched criteria produce a rejected package with a reason code.
- AC-03: The single runtime catalog declares canonical artifacts, policy/evaluation references, capabilities, sensitivity, and stage constraints without requiring an MCP server or per-agent copies.
- AC-04: Policy validation rejects unknown command IDs, prohibited paths, unauthorized capabilities, and missing required approval.
- AC-05: Policy helpers never execute a command read from user-authored change artifacts.
- AC-06: Run events and summaries omit prompts, source code, credentials, and raw tool I/O by default.
- AC-07: Summaries show completed/blocked state plus any supplied duration, retry, verification, and evaluation data.
- AC-08: Required deterministic evaluation failure blocks final delivery; unavailable optional grading is visible as not_run.
- AC-09: A legacy v4 fixture still verifies and explicitly reports that runtime governance is disabled.
- AC-10: Chinese and English documentation include a complete local-first example and describe the future MCP adapter boundary.
- AC-11: The runtime catalog defines coordinator, executor, test_verifier,
  reviewer, and monitor profiles with capabilities, inputs, outputs, and
  authority boundaries.
- AC-12: A task cannot have more than one active write-capable executor, and a
  parallel assignment is rejected unless tasks are dependency-independent and
  declare isolated execution ownership.
- AC-13: Lite, standard, and strict triggers follow configured default and risk
  rules; strict delivery lacks a pass result when required verifier, reviewer,
  or monitor outputs are absent.
- AC-14: A monitor can report timeout, retry, authorization, verification, and
  blocked-task signals but cannot modify source, approve delivery, or create an
  automatic remediation action.

## Verification Plan

1. Unit-test context, catalog, policy, telemetry, and evaluation parsers.
2. Add pass/fail fixtures for every acceptance criterion.
3. Prove policy handling rejects untrusted command strings without spawning them.
4. Run repository tests and structural verification.
5. Walk one standard fixture through context generation, policy check, telemetry, deterministic evaluation, and summary generation.
6. Verify role-profile, parallel-write denial, mode-trigger, and read-only
   monitor fixtures.
7. Verify a legacy v4 fixture produces the explicit compatibility warning.

## Risks

| Risk | Mitigation |
|---|---|
| New files increase ceremony | Opt in only for standard/strict; generate artifacts through helpers. |
| Telemetry captures sensitive data | Metadata-only default; policy-based redaction; no raw I/O. |
| MCP scope grows prematurely | Phase 1 supplies only a resource catalog. |
| Model grading is inconsistent | Deterministic verification remains mandatory for pass. |
| Policy blocks valid work | Begin in observe mode; use fixtures and explicit override approval. |
