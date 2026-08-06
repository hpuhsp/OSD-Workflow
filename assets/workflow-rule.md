# OSD 2.0 Delivery Contract

OSD owns delivery routing, stage order, required evidence, and acceptance gates. Before changing repository code, read `.osd/config.json` and use `osd status <feature>` for the active task.

1. Classify the task as `new_feature`, `bug_fix`, `existing_change`, `refactor`, or `maintenance`. Select the mode and implementation strategy from the OSD route.
2. Start the change through `osd start <feature>`. Do not claim a stage is complete merely because an Agent discussed it.
3. For every stage, use the configured preferred adapter when present. When OpenSpec is selected, create its native artifacts with the Agent integration's `/opsx:propose` workflow, then use `osd approve` only after those artifacts exist. OpenSpec is the native specification and archive authority; Superpowers is an execution method when the current harness supplies it. Do not recreate either tool's internal method.
4. If a preferred adapter is unavailable, use only the configured fallback and keep the fallback record OSD creates. Missing tools do not permit skipping specification, verification, review, or archive gates.
5. Advance the delivery contract through `osd approve`, `osd plan`, `osd implement`, `osd verify`, `osd review`, and `osd archive`. Run `osd verify` before reporting delivery complete.

OSD: <task_type> | <mode> | <strategy> | <stage> | <adapters>
