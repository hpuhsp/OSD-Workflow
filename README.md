# OSD Workflow 2.0

OSD is a native-first delivery orchestrator for AI-assisted software development. It owns the delivery contract: routing, stage order, evidence, review gates, and archive status. OpenSpec and Superpowers remain native specialists when they are present; OSD records a minimal, explicit fallback when they are not.

OSD is installed once as a CLI and initialized only in repositories that need the delivery contract. It is not a copied workflow template and does not replace either native tool.

```bash
npm install --global osd-workflow
osd init --agents qoder,claude
```

Requirements: Node.js `>=20.11`. Install OpenSpec or an Agent harness exposing Superpowers only when the project should use their native capabilities.

Initialization is intentionally small:

```text
.osd/config.json
.osd/rules/workflow.md
<selected Agent rule>
```

It does not generate `AGENTS.md`, `.ai/`, `openspec/`, `knowledge/`, or project-local runner scripts. The package owns its contract, templates, and runtime code; a project receives only the configuration and Agent-facing rule it needs. Delivery state is created lazily when work begins.

Run `osd doctor` after initialization to inspect the resolved Agent rules, verification command, and native/fallback adapter selection.

## Native-First Routing

| Delivery stage | Preferred adapter | Recorded fallback |
| --- | --- | --- |
| Specification and archive | OpenSpec | OSD Markdown specification/archive |
| Planning | Superpowers `writing-plans` | OSD minimal plan |
| Implementation | Superpowers TDD | Agent-native implementation |
| Verification | Superpowers verification | Configured verification command |
| Review | Superpowers review | Agent review record |

OpenSpec is selected only when its CLI and the target project's `openspec/` workspace both exist. Superpowers is selected only when the current Agent harness exposes it. A missing specialist never bypasses the specification, verification, review, or archive gates.

## Delivery Lifecycle

```bash
osd start checkout --type bug_fix --adapter auto
osd approve checkout
osd plan checkout
osd implement checkout
osd verify checkout
osd review checkout --result pass --summary "No regression found"
osd archive checkout
```

`start` determines a task mode and implementation strategy, resolves adapters, and creates a task-scoped state record. Mode selection is adaptive by default: task type provides a base score, while declared scope, risk signals, and touched paths can upgrade `lite` to `standard` or `strict`. The selected score and factors are stored in `state.json`.

- OpenSpec is used for specification and archive only when both its CLI and project workspace are available.
- Superpowers is selected for planning, implementation, verification, and review only when the current Agent harness exposes it.
- Fallback artifacts live under `.osd/changes/<feature>/` and are archived under `.osd/archive/`.
- Verification records a `unit_test` check and runs `commands.verify` from `.osd/config.json`, normally inferred from `package.json` as `npm test`. A dedicated `commands.unitTest` or `test:unit` script is used when present; otherwise the unit-test slot is recorded as covered by the broader verification command.
- Standard and strict work require a proposal and task plan. Every archive requires successful verification; strict work additionally requires a passing review and acceptance-criteria evaluation.

## Agent Rules

`osd init` supports `qoder`, `claude`, `gemini`, `trae`, and `cursor`.

- Qoder: `.qoder/rules/osd-workflow.md`. Its Model Decision mode is configured in Qoder's Rules UI; OSD does not invent unsupported frontmatter.
- Claude Code: `.claude/rules/osd-workflow.md`.
- Gemini CLI: `GEMINI.md`, importing `.osd/rules/workflow.md`.
- Trae: `.trae/rules/osd-workflow.md` with `description` and `alwaysApply: false`.
- Cursor: `.cursor/rules/osd-workflow.mdc` with an Agent Requested rule (`description`, empty `globs`, `alwaysApply: false`).

Interactive terminals use arrow keys, Space, and Enter for multi-selection. Non-interactive use is explicit: `--agents auto` keeps detected targets, `--agents none` writes no Agent rule, and `--agents qoder,cursor --yes` selects targets directly.

## Diagnostics And Governance

```bash
osd doctor
osd adapters list
osd status checkout
osd config get workflow.verification
osd config set commands.unitTest '"npm run test:unit"'
osd config set commands.verify '"pnpm test"'
osd upgrade
```

For governed team delivery, `osd context`, `osd authorize`, `osd event`, `osd evaluate`, and `osd summarize` create task-scoped context, allow only configured commands, store metadata-only runtime events, evaluate acceptance-criterion coverage, and produce a compact summary. This governance layer is optional for ordinary work and required by the strict archive gate.

See [the detailed usage guide](docs/USAGE.md), [the Chinese 2.0 architecture note](docs/OSD_2_0_ARCHITECTURE_zh.md), and [the original improvement specification](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md).
