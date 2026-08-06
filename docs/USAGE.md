# OSD 2.0 Usage

## Install And Initialize

```bash
npm install --global osd-workflow
cd your-project
osd init
```

OSD requires Node.js `>=20.11`. The interactive prompt selects one or more Agent rule targets with arrow keys, Space, and Enter. Automation is explicit:

```bash
osd init --agents qoder,cursor --yes
osd init --agents auto --yes
osd init --agents none --yes
```

`auto` preserves detected rule targets; `none` creates the OSD project contract without an Agent-specific rule. For Qoder, set the generated rule's activation to **Model Decision** in Qoder's Rules UI. Its documented setting is not a rule-file frontmatter field, so OSD deliberately does not write an invented `trigger` property.

The only eager project files are `.osd/config.json`, `.osd/rules/workflow.md`, and selected Agent rules. This is intentional: OSD workflow artifacts are lazy, feature-scoped state rather than copied project boilerplate. The globally installed package owns the contract, templates, and runtime code; initialization never creates historical `.ai/`, `knowledge/`, project-local `scripts/`, or an OpenSpec workspace.

Before starting a delivery, run `osd doctor`. It reports configuration health, Agent rule presence, the verification command, and the adapter chosen for every stage.

## Start A Delivery

```bash
osd start account-lockout --type bug_fix
```

Task type selects the default route:

| Type | Default mode | Default strategy |
| --- | --- | --- |
| `new_feature` | `standard` | `tdd` |
| `bug_fix` | `lite` | `test_first` |
| `existing_change` | `standard` | `test_first` |
| `refactor` | `standard` | `test_first` |
| `maintenance` | `lite` | `verification_only` |

Override the route when needed:

```bash
osd start account-lockout --mode strict --strategy test_first --adapter fallback
```

`--adapter auto` chooses OpenSpec only when the global command and an initialized `openspec/` workspace are both available. `--adapter fallback` creates the minimum OSD specification, proposal, and task templates under `.osd/changes/<feature>/artifacts/`. `--adapter openspec` fails rather than silently pretending OpenSpec is available. Superpowers is independently selected for planning, implementation, verification, and review only when the active Agent harness exposes the skill.

## Advance The Contract

```bash
osd approve account-lockout
osd plan account-lockout
osd implement account-lockout
osd verify account-lockout
osd review account-lockout --result pass --summary "Focused tests and diff review passed"
osd archive account-lockout
```

The state machine is `specification -> planning -> implementation -> verification -> review -> archive -> complete`. Standard and strict deliveries require a proposal and task plan. Every archive requires successful verification. Strict deliveries also require a passing review and a passing acceptance-criteria evaluation.

When OpenSpec is the selected specification backend, use its native `/opsx:propose` Agent workflow before `osd approve`. `osd archive` invokes the official `openspec archive <feature> --yes` command and refuses to write a native receipt unless the change was actually moved to `openspec/changes/archive/`. OSD does not imitate OpenSpec commands. When Superpowers is available in the Agent harness, the project rule directs it to perform planning, TDD, verification, and review inside the OSD stage; OSD does not imitate its methodology.

## Inspect And Configure

```bash
osd doctor
osd adapters list
osd status account-lockout
osd config get
osd config get governance.require_review_for
osd config set commands.verify '"pnpm test"'
osd upgrade
```

`doctor` reports config health, Agent rule presence, OpenSpec workspace availability, Superpowers harness detection, verification command discovery, and stage-by-stage adapter resolution.

## Evidence And Archives

Fallback evidence is stored in the active delivery directory:

```text
.osd/changes/<feature>/state.json
.osd/changes/<feature>/verification.json
.osd/changes/<feature>/review.json
.osd/changes/<feature>/delivery.md
```

`osd archive` moves this evidence to `.osd/archive/YYYY-MM-DD-<feature>/`. For OpenSpec-backed changes it first runs `openspec archive <feature> --yes`, then archives OSD's own state record.

## Runtime Governance

Runtime governance is optional for ordinary work and required by the archive gate for `strict` delivery.

```bash
osd context account-lockout --task T-01 --role executor --owned-area src/auth.js --isolated
osd authorize account-lockout --command-id verify --role executor --path src/auth.js
osd event account-lockout --event '{"event_type":"implementation_started","status":"running"}'
osd evaluate account-lockout
osd summarize account-lockout
```

Contexts record declared ownership and the current delivery contract. Authorizations only accept a command named in `.osd/config.json`; default `verify` maps to the configured verification command. Events reject prompts, credentials, tokens, source code, and raw tool I/O. Evaluation checks that every `AC-*` criterion in the specification is represented in the task plan and that verification passed.
