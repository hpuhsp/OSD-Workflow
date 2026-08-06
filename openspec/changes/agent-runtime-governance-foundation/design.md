# Design: Agent Runtime Governance Foundation

## Principles

- Local-first and inspectable: contracts are repository files that work in CI and local harnesses.
- Adapter-neutral: OSD defines inputs and outputs; harnesses choose model, tool, MCP client, trace exporter, or sandbox.
- Evidence over narration: state transitions and results are structured facts.
- Privacy by default: record identifiers and outcomes, not raw prompts, code, secrets, or tool payloads.
- Progressive adoption: v4 projects keep working until they opt in.

## Proposed Layout

~~~text
.ai/
  runtime-governance/
    governance.json             # one catalog: resources, policy, evaluation, versions
openspec/changes/{feature}/
  context/{task-id}.json
  run-events.jsonl
  evaluation.json
knowledge/delivery/{feature}/
  runtime-summary.json
~~~

The single governance.json is the runtime entry point. Existing proposal.md, spec.md, tasks.md, approval.md, osd-state.json, verification.json, and archive artifacts remain canonical for their current responsibilities. Per-change runtime records stay beside their OpenSpec change; no per-agent resource directories are created.

## Context Flow

~~~text
approved specification + task plan + state + policy
                         |
                         v
                 context generator
                         |
                         v
       context/{task-id}.json: runnable or blocked
                         |
                         v
       harness adapter or future MCP resource reader
~~~

The generator validates approval, task ownership, acceptance-criteria links, dependencies, and policy capabilities before returning runnable.

## Policy and Evaluation Flow

Execution policy uses named command IDs, not raw shell snippets. The repository owns the mapping between a command ID and the actual command. Policy evaluation returns allowed, approval_required, blocked with a reason code, or not_applicable.

~~~text
agent / verifier action
        |
        v
metadata-only run event ----> local runtime summary
        |
        +--> deterministic repository check ----+
        +--> optional grader result ------------> evaluation.json
                                                    |
                                                    v
                                     final delivery verification
~~~

Optional graders are tri-state: pass, fail, or not_run. A deterministic check cannot be claimed as passing without real verification evidence.

## Subagent Role Contract

The runtime catalog defines five role profiles, each with declared input resources, output records, read/write capability, budget, timeout, and approval requirements:

| Role | Default authority | Required output |
|---|---|---|
| coordinator | read-only for business code | task graph and assignment summary |
| executor | one atomic task's owned area only | implementation and task result |
| test_verifier | read-only | test/coverage/verification result |
| reviewer | read-only | spec/diff/evidence findings |
| monitor | read-only, no approval authority | lifecycle alerts and feedback |

The catalog is a scheduling contract, not a scheduler. A capable harness may create the declared agents, isolated worktrees, or sandboxes; a harness without subagent support may execute the same roles serially and record the limitation.

Parallel work is legal only when the task graph has no dependency edge between assignments, each task has a single write-capable executor, and the adapter confirms isolated execution. Test, review, and monitor roles normally consume a stable diff and structured evidence after the executor reaches its checkpoint.

Monitor feedback is event-driven where an adapter supports event watching; otherwise it is evaluated at stage checkpoints from run-events.jsonl. The monitor can flag and escalate, but only policy-verifier output and an authorized human/quality gate can permit final delivery.

## MCP Boundary

Phase 1 creates no MCP server. A future proposal may expose resource-catalog entries as read-only MCP resources and approved actions as narrow tools. Transport, authentication, client lifecycle, and server deployment stay out of this change.

## Rollout

1. Add schemas, fixtures, generators, and observe-mode policy reports.
2. Validate on the template and one opted-in pilot project.
3. Enforce policy/evaluation and required role outputs for strict pilot changes.
4. Review blocked-action rate, run duration, verifier failures, and adoption friction.
5. Only then propose phase 2: MCP adapter, trace exporter, centralized metrics, or an OSD-owned parallel-agent scheduler.
