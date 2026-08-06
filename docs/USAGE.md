# OSD 2.0 Usage

OSD 2.0 is a project-light, native-first orchestrator. Install it once as a global CLI and initialize each project with a small `.osd` contract.

```bash
npm install --global osd-workflow
osd init
```

`osd-workflow` is an equivalent command alias.

## Initialize

```bash
osd init [target] [--agents qoder,claude] [--yes] [--dry-run]
```

Interactive terminals show a banner and allow a comma-separated Agent multi-select. In automation, pass `--agents` and `--yes`; a non-interactive invocation never waits for input.

Supported targets are `qoder`, `claude`, `gemini`, `trae`, and `cursor`. Use `all`, `none`, or `auto` as shortcuts. With no Agent selection, OSD retains already configured Agent rules and creates no `AGENTS.md`.

The default output is intentionally limited:

```text
.osd/config.json
.osd/rules/workflow.md
<selected Agent rule>
```

No `.ai/`, `openspec/`, `knowledge/`, `scripts/`, or template-owned project directories are copied. Re-running `init` updates OSD's managed block in an Agent rule without duplicating it or deleting user content.

## Runtime Routing

The config schema is `osd.config/v2`. Every task passes through these stages: `specification`, `planning`, `implementation`, `verification`, `review`, and `archive`.

Each stage has a preferred native adapter and a minimal fallback. OpenSpec is preferred for specification and archive. Superpowers is preferred for planning, implementation, verification, and review. When a preferred adapter is unavailable, OSD uses the configured fallback only if `fallback_allowed` is enabled, and records the fallback in task evidence.

`dynamic_routing` decides task depth at runtime. There are no `light`, `standard`, `full`, or preset initialization modes.

## Inspect

```bash
osd doctor [target]
osd adapters list [target]
```

`doctor` validates the configuration, reports Agent rule presence, detects OpenSpec and Superpowers, finds the verification command, and shows the resolved adapter for each stage. A fallback selection is displayed explicitly.

`adapters list` shows the current availability of every native and fallback adapter.

## PowerShell Wrapper

The repository includes `scripts/install.ps1` as a compatibility wrapper around the same CLI:

```powershell
./scripts/install.ps1 -Target . -Agents qoder,cursor -Yes
```

It creates the same minimal OSD state and does not download or copy a project template.
