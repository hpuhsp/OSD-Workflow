# Implementation: Agent Runtime Governance Foundation

- Added one local runtime catalog at `.ai/runtime-governance/governance.json` for resources, policy, role boundaries, and evaluation rules.
- Added `scripts/runtime-governance.mjs` for pure catalog/policy validation, task-scoped context generation, metadata-only event recording, and summaries.
- Upgraded the manifest and verifier to v5. Standard and strict deliveries now require per-task context, events, deterministic evaluation, and a derived summary; v3/v4 remain compatible with an explicit warning.
- Added policy-defined coordinator, executor, test verifier, reviewer, and monitor boundaries. The implementation deliberately leaves scheduling, worktrees, sandboxes, queues, MCP transport, and monitor daemons to harness adapters.
- Added unit and integration coverage, plus English and Chinese local-first operational guidance.

Phase-2 decision: defer centralized scheduling/MCP/control-plane work until an opted-in pilot produces actionable evidence about adoption friction, blocked actions, and runtime cost.
