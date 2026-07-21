# OSD Workflow Agent Entry

For every task that changes code, tests, documentation, configuration, or project artifacts:

1. Treat OSD Workflow as the top-level controller. Before choosing tools or announcing a process, read `.ai/AI_WORKFLOW.md`, `.ai/workflow-manifest.json`, and `.ai/rules/workflow-execution-rule.md` in that order.
2. Let OSD classify the task, select `lite`, `standard`, or `strict`, select the development strategy, and determine stage order and required outputs.
3. Use OpenSpec as the specification authority and Superpowers as an execution method inside the current OSD stage. Neither may replace, prepend, skip, or reorder OSD stages.
4. Do not ask the user to choose a mode or strategy when the repository context makes the route clear. Escalate only when risk or uncertainty requires it.
5. Start with one concise status line: `OSD: <task_type> | <mode> | <strategy> | <current_stage>`. Do not lead with a generic OpenSpec or Superpowers process.
6. Delegate each stage according to `.ai/workflow-manifest.json`; do not reproduce OpenSpec commands or Superpowers skill internals in OSD.
7. Record concise OpenSpec and Superpowers participation evidence, complete only the selected mode's required outputs, and run the verifier before handoff.

If OpenSpec or Superpowers is unavailable, report the missing required runtime instead of substituting a different top-level process.

Normal development requests trigger this workflow automatically. The shortest explicit fallback prompt is: `Execute with OSD: {task}`.
