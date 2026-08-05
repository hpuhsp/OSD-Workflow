# Proposal: Agent Runtime Governance Foundation

## Motivation

OSD Workflow already supplies routing, an OpenSpec source of truth, task-aware context, verification evidence, approval, and archive records. It is intentionally a file-based template, so it does not yet provide a uniform runtime contract for context delivery, execution policy, telemetry, or repeatable agent evaluation.

Current agent stacks increasingly expose tools, specialized agents, guardrails, traces, evaluations, and MCP resources. OSD should be able to consume those capabilities without becoming dependent on one model, harness, cloud provider, or MCP implementation.

## Scope

Establish a local-first operational foundation that adds:

1. one unified, adapter-neutral runtime catalog for agent context, policy, evaluation, and future MCP resources;
2. a policy-controlled execution contract for commands, approvals, and risk;
3. structured, privacy-safe run telemetry and delivery metrics;
4. a repeatable evaluation record combining deterministic checks with optional agent-quality evaluations;
5. compatibility rules, fixtures, and documentation for incremental adoption.
6. policy-defined subagent roles, triggers, and read-only monitoring feedback
   without building an OSD-owned scheduler.

## Non-goals

- Build a centralized SaaS control plane, vector database, or RAG service.
- Implement an MCP server in this phase.
- Replace OpenSpec, Superpowers, CI, IDEs, or the agent harness.
- Schedule fleets of parallel agents or provision remote sandboxes.
- Capture raw prompts, source code, credentials, or raw tool payloads by default.
- Change existing lite / standard / strict semantics without an explicit migration.

## Expected Outcome

An opted-in target project can give every agent a stable minimum context package; enforce reviewable execution policy; record what an agent run did; and evaluate whether the result met delivery and quality expectations. The artifacts remain repository-local and can later be exposed through MCP or sent to an observability platform.
