# OSD Workflow 2.0

OSD is a global CLI that adds a small, native-first workflow contract to an existing project. It does not copy an OSD project template.

Install the package globally, then run either command alias from a project:

```bash
npm install --global osd-workflow
osd init
# or: osd-workflow init
```

By default, initialization creates only:

```text
.osd/config.json
.osd/rules/workflow.md
```

Agent rules are opt-in. OSD supports `qoder`, `claude`, `gemini`, `trae`, and `cursor`:

```bash
osd init --agents qoder,cursor --yes
osd init --agents all --yes
osd init --agents none --yes
```

`init` never creates `AGENTS.md`, `.ai/`, `openspec/`, `knowledge/`, or `scripts/`. Existing Agent rule files keep user-authored content; OSD updates only its managed block.

## Native-First Routing

`.osd/config.json` uses `osd.config/v2`. It defines `native_first`, `dynamic_routing`, `fallback_allowed`, Agent targets, governance, verification commands, and six workflow stages:

| Stage | Preferred adapter | Fallback |
| --- | --- | --- |
| specification | OpenSpec | OSD markdown specification |
| planning | Superpowers writing-plans | OSD minimal plan |
| implementation | Superpowers TDD | Agent-native execution |
| verification | Superpowers verification | configured command |
| review | Superpowers review | Agent review |
| archive | OpenSpec | OSD markdown archive |

Task depth is chosen at runtime through `dynamic_routing`; OSD 2.0 has no installation presets or light/standard/full template variants. When a preferred adapter is unavailable, OSD selects its configured fallback and reports that decision.

## Diagnostics

```bash
osd doctor
osd adapters list
```

`doctor` reports config validity, selected Agent rules, OpenSpec and Superpowers detection, the verification command, and stage-by-stage adapter resolution. `adapters list` lists native and fallback availability.

For CI and automation, use non-interactive flags. They never prompt:

```bash
osd init --agents qoder,claude --yes --dry-run
```

See [the usage guide](docs/USAGE.md) and [the OSD 2.0 specification](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md).
