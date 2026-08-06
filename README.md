# OSD Workflow

## Native-First Workflow Coordination for AI-Assisted Delivery

OSD is a global CLI that adds a small, explicit workflow contract to an existing software project. It coordinates the strongest capability already available in the developer's environment, then uses a minimal fallback only when that native capability is unavailable.

OSD is not a project template, an Agent replacement, or another execution framework. It gives people and coding Agents a shared way to decide what work is needed, which adapter should perform it, and what evidence should remain after delivery.

## Why OSD

AI-assisted delivery commonly fails in one of two ways: every change is forced through too much ceremony, or meaningful work skips specification, verification, and review entirely. OSD addresses this with four rules:

1. **Global CLI, light projects**: install once; each project receives only a `.osd` contract.
2. **Native first**: prefer OpenSpec, Superpowers, and Agent-native capabilities rather than reimplementing them.
3. **Runtime routing**: decide task depth from scope, risk, and uncertainty while doing the work, not from an initialization preset.
4. **Observable fallback**: when a native adapter is unavailable, select the configured fallback and surface that decision in diagnostics and delivery evidence.

## Operating Model

Every non-trivial task flows through the same six stages. The selected adapter can change, but the delivery intent remains stable.

```text
Specification -> Planning -> Implementation -> Verification -> Review -> Archive
```

| Stage | Native-first adapter | Minimal fallback |
| --- | --- | --- |
| Specification | OpenSpec | OSD markdown specification |
| Planning | Superpowers writing-plans | OSD minimal plan |
| Implementation | Superpowers TDD | Agent-native execution |
| Verification | Superpowers verification | Project verification command |
| Review | Superpowers review | Agent review |
| Archive | OpenSpec | OSD markdown archive |

The exact adapters, governance controls, selected Agent rules, and verification command are stored in `.osd/config.json` under the `osd.config/v2` schema.

## Quick Start

### 1. Install globally

Install from your npm registry when `osd-workflow` is published there:

```bash
npm install --global osd-workflow
```

Or install the current GitHub source directly:

```bash
npm install --global github:hpuhsp/OSD-Workflow
```

OSD exposes two equivalent commands:

```bash
osd --help
osd-workflow --help
```

### 2. Initialize a project

At the root of the project you want to configure:

```bash
cd path/to/project
osd init
```

The interactive command displays a banner and lets you select Agent targets. For CI, scripts, and repeatable setup, provide all choices explicitly:

```bash
osd init --agents qoder,cursor --yes
```

Initialization creates only:

```text
.osd/config.json
.osd/rules/workflow.md
<selected Agent rule files>
```

Supported Agent targets are `qoder`, `claude`, `gemini`, `trae`, and `cursor`.

```bash
osd init --agents all --yes
osd init --agents none --yes
osd init --agents qoder,claude --yes --dry-run
```

Repeated initialization updates only OSD's managed block in an existing Agent rule. It never removes user-authored instructions or creates duplicate managed blocks.

### 3. Verify the environment

```bash
osd doctor
osd adapters list
```

`doctor` checks the OSD config, selected Agent rules, OpenSpec availability, Superpowers availability, the project verification command, and the resolved adapter for every stage. `adapters list` provides the same adapter availability view without the project health summary.

## Project Contract

OSD writes the following configuration keys to `.osd/config.json`:

```text
schema: osd.config/v2
native_first
dynamic_routing
fallback_allowed
agents
workflow
governance
commands
```

Set `commands.verify` when a project requires a specific verification command. If it is absent, OSD detects common package-manager test commands during initialization.

## What OSD Does Not Do

- It does not copy `.ai/`, `openspec/`, `knowledge/`, `scripts/`, or `AGENTS.md` into projects.
- It does not impose `light`, `standard`, `full`, or preset installation modes.
- It does not replace OpenSpec, Superpowers, or an Agent's native workflow.
- It does not require a hosted service, scheduler, RAG store, or control plane.

## Product Specification

The OSD 2.0 product specification is available in [Chinese](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md).
