# OSD Workflow 2.0

OSD is a global CLI that gives any repository a lightweight, native-first AI delivery contract. It coordinates the work already available in your environment instead of copying a workflow template into every project.

OSD keeps the project footprint small, prefers native OpenSpec and Superpowers capabilities when present, and falls back to minimal local guidance when they are not. Task depth is decided at runtime through `dynamic_routing`, not by installation presets.

## What You Get

- A single global CLI with two aliases: `osd` and `osd-workflow`.
- A small project contract in `.osd/`, using the `osd.config/v2` schema.
- Optional native rules for Qoder, Claude, Gemini, Trae, and Cursor.
- Stage-by-stage native adapter selection with explicit fallback reporting.

OSD does not create `AGENTS.md`, `.ai/`, `openspec/`, `knowledge/`, or `scripts/` by default. It does not replace an Agent's own rules or tools.

## Quick Start

### 1. Install OSD globally

Install from npm when the package is available to your registry:

```bash
npm install --global osd-workflow
```

Or install the current GitHub source directly:

```bash
npm install --global github:hpuhsp/OSD-Workflow
```

Confirm either command alias is available:

```bash
osd --help
# Equivalent alias: osd-workflow --help
```

### 2. Initialize a project

Run the command from the repository you want to configure:

```bash
cd path/to/your-project
osd init
```

Interactive terminals show an Agent multi-select. For CI, scripts, or repeatable setup, make the selection explicit:

```bash
osd init --agents qoder,cursor --yes
```

The default project output is intentionally limited:

```text
.osd/config.json
.osd/rules/workflow.md
<selected Agent rule files>
```

Supported Agent targets are `qoder`, `claude`, `gemini`, `trae`, and `cursor`. Use `all`, `none`, or `auto` when appropriate:

```bash
osd init --agents all --yes
osd init --agents none --yes
osd init --agents qoder,claude --yes --dry-run
```

Re-running `init` updates only OSD's managed block in an existing Agent rule, preserving user-authored content.

### 3. Check the active adapters

```bash
osd doctor
osd adapters list
```

`doctor` validates the config, checks selected Agent rules, detects OpenSpec and Superpowers, finds a verification command, and shows the resolved adapter for every stage.

## Native-First Workflow

`.osd/config.json` defines six workflow stages. Each stage selects its preferred native adapter first, then its configured fallback only when `fallback_allowed` is enabled.

| Stage | Preferred adapter | Fallback |
| --- | --- | --- |
| specification | OpenSpec | OSD markdown specification |
| planning | Superpowers writing-plans | OSD minimal plan |
| implementation | Superpowers TDD | Agent-native execution |
| verification | Superpowers verification | configured command |
| review | Superpowers review | Agent review |
| archive | OpenSpec | OSD markdown archive |

When a preferred adapter is unavailable, the selected fallback is visible in `osd doctor` and should be recorded with the task evidence. OSD does not have `light`, `standard`, `full`, or preset installation modes.

## Configuration

The generated `.osd/config.json` uses `osd.config/v2` and includes:

```text
native_first, dynamic_routing, fallback_allowed,
agents, workflow, governance, commands
```

Set `commands.verify` when your project needs a specific verification command. Otherwise OSD detects common package-manager test commands during initialization.

## More Information

- [Usage guide](docs/USAGE.md)
- [Chinese usage guide](docs/USAGE_zh.md)
- [OSD 2.0 product specification](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md)
