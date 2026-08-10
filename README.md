# OSD Workflow 2.0

OSD is a **native-first delivery orchestrator** for AI-assisted software development: a single global CLI that owns the delivery contract — task routing, stage order, evidence, review gates, and archive status — so AI-generated changes ship with the same discipline as hand-written ones.

## Why OSD

Coding agents are great at producing code, but they do not naturally produce a *process*. Without an explicit contract, a delivery has no agreed workflow, no evidence that work actually happened, no gate before a change ships, and no record of what was delivered. OSD closes that gap:

- **Native-first routing** — OpenSpec and Superpowers keep their native strengths when present; a minimal, traceable fallback covers their stages when they are not. A missing specialist never skips the specification, verification, review, or archive gates.
- **Evidence-governed stages** — every stage writes file evidence under `.osd/changes/<feature>/`, and verification and review results decide whether a delivery may advance or archive.
- **Risk-adaptive modes** — `osd start` scores task type, declared scope, risk signals, and touched paths to select `lite`, `standard`, or `strict` automatically.
- **Reversible** — `osd rollback <feature> --to <stage>` moves a delivery back to an earlier stage without deleting artifacts.
- **Non-invasive** — a project receives only a small config and an Agent rule; no copied templates, no `AGENTS.md`, `.ai/`, `openspec/`, or `knowledge/` boilerplate.

OSD is not a workflow template and does not replace either native tool. It is installed once as a global CLI and initialized only in repositories that need the delivery contract.

## Install

**Prerequisite:** Node.js `>=20.11`.

OSD is not published to the npm registry; install the CLI globally from source:

```bash
node -v                        # check Node.js first
git clone https://github.com/hpuhsp/OSD-Workflow.git
cd OSD-Workflow
npm install --global .         # install the osd CLI globally
osd --version                  # verify the installation
```

Upgrade the CLI by pulling the latest source and re-installing; refresh a project's contract with `osd upgrade` (run inside the project):

```bash
cd OSD-Workflow
git pull
npm install --global .
osd upgrade
```

To remove the CLI:

```bash
npm uninstall --global osd-workflow
```

Uninstalling leaves existing `.osd/` directories untouched; delete them per project if they are no longer needed.

## Initialize

Run `osd init` in the project root that needs the delivery contract:

```bash
cd your-project
osd init
```

The interactive prompt selects one or more Agent rule targets with arrow keys, Space, and Enter. For automation, pass `--agents` explicitly:

```bash
osd init --agents qoder,claude --yes   # write rules for these agents
osd init --agents auto --yes           # keep only detected targets
osd init --agents none --yes           # contract only, no Agent rule
```

`init` writes exactly three small files (plus the selected Agent rule):

```text
.osd/config.json               # delivery contract: verification command, gates, adapters
.osd/rules/workflow.md         # OSD workflow rules, read by the Agent
.claude/rules/osd-workflow.md  # Agent rule entry (example: Claude Code)
```

It deliberately creates no `AGENTS.md`, `.ai/`, `openspec/`, `knowledge/`, or project-local runner scripts. The package owns the contract, templates, and runtime code; a project receives only the configuration and the Agent-facing rule it needs. Delivery state is created lazily when work begins.

After initialization, run `osd doctor` to inspect the resolved Agent rules, verification command, and native/fallback adapter selection before starting a delivery.

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
- If a delivery reaches the wrong stage or becomes blocked, `osd rollback <feature> --to <stage>` moves the state back to an earlier workflow stage and records the rollback in history without deleting existing artifacts.

## Agent Rules

`osd init` supports `qoder`, `claude`, `gemini`, `trae`, and `cursor`.

- Qoder: `.qoder/rules/osd-workflow.md`. Its Model Decision mode is configured in Qoder's Rules UI; OSD does not invent unsupported frontmatter.
- Claude Code: `.claude/rules/osd-workflow.md`.
- Gemini CLI: `GEMINI.md`, importing `.osd/rules/workflow.md`.
- Trae: `.trae/rules/osd-workflow.md` with `description` and `alwaysApply: false`.
- Cursor: `.cursor/rules/osd-workflow.mdc` with an Agent Requested rule (`description`, empty `globs`, `alwaysApply: false`).

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
