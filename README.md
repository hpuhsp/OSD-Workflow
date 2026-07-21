# OSD Workflow

OSD Workflow is a lightweight team standard for adaptive, specification-driven AI development.

It connects two required runtime capabilities:

- **Superpowers** at the Agent/Harness level for routing, execution discipline, verification, and review.
- **OpenSpec** as the specification source for every task.

The project template supplies the shared contract under `.ai/`, OpenSpec assets under `openspec/changes/`, and concise delivery evidence under `knowledge/archive/`.

## Design Goal

Standardize the SDD outcome without forcing every task through the same amount of ceremony.

Every task must:

1. Define expected behavior and acceptance criteria in OpenSpec before coding.
2. Implement within the accepted specification through Superpowers-guided execution.
3. Produce focused verification evidence.

## Adaptive Modes

| Mode | Use for | Required flow |
|---|---|---|
| `lite` | Simple, localized, low-risk work | Superpowers routing → compact OpenSpec spec → implementation → verification |
| `standard` | Normal medium-scope work; default | routing → OpenSpec proposal/spec → plan → implementation → verification → review |
| `strict` | Complex, ambiguous, high-risk, cross-module, or release-critical work | routing → full OpenSpec → spec review → plan → implementation → full verification → review → archive |

OpenSpec and Superpowers participate in all three modes. Only process depth and artifact volume change.

## Development Strategy

Mode and development strategy are separate decisions:

| Strategy | Use for | Evidence |
|---|---|---|
| `tdd` | Core business logic, algorithms, state machines, permissions, billing, public APIs | Red, Green, Refactor |
| `test_first` | Bug fixes, existing behavior changes, refactors | Failing-before and passing-after evidence |
| `verification_only` | Docs, config, pure styling, exploration, impractical test boundary | Reason plus focused verification |

TDD is conditional, not a fourth workflow mode. Evidence stays in the existing delivery record; no separate TDD report is required.

## Task-Aware Routing

| Task type | Specification focus | Start mode | Default strategy |
|---|---|---|---|
| New feature | Value, scope, non-goals, acceptance, compatibility | `standard` | `tdd` for executable behavior |
| Bug fix | Reproduction, observed/expected behavior, root cause, regression | `lite` | `test_first` |
| Existing behavior change | Current behavior, desired delta, compatibility, consumers | `standard` | `test_first` |
| Refactor | Behavior invariants, impact, rollback, regression | `standard` | `test_first` characterization |
| Maintenance/docs/config | Exact change, operational impact, focused verification | `lite` | `verification_only` |

Escalate when scope, uncertainty, or risk grows. A user may explicitly choose a lighter or stricter mode if residual risk is recorded.

## Minimal Artifacts

`lite` requires only:

- `openspec/changes/{feature}/spec.md`
- `knowledge/archive/{feature}/test-report.md`
- `knowledge/archive/{feature}/stage-report.md`

`standard` adds a proposal, implementation summary, and review summary. `strict` adds the full OpenSpec design and complete archive.

The machine-readable output contract is `.ai/workflow-manifest.json`. Do not duplicate the same information across files. Create `handoff-brief.md` only when another agent will continue the task.

## Install OSD Workflow

Choose one installation method. The installer copies the OSD Workflow contract, rules, templates, OpenSpec workspace skeleton, and verifier into the target project.

Using Node.js / npx:

```bash
npx --yes github:hpuhsp/OSD-Workflow init --target . --with-docs
```

Using PowerShell from a cloned OSD Workflow repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target D:\WorkPlace\demo -WithDocs
```

Existing files are skipped unless `--force` or `-Force` is supplied. Use `--dry-run` or `-DryRun` to preview changes.

### Complete Runtime Setup

After OSD Workflow is installed in the project:

1. Install the OpenSpec CLI globally:

   ```bash
   npm install -g @fission-ai/openspec@latest
   ```

2. Initialize the project OpenSpec workspace:

   ```bash
   openspec init
   ```

3. Ensure Superpowers is available in the AI agent or harness used by each developer.

## One-Click Update

Update an existing installation with the currently installed CLI:

```bash
osd-workflow update .
```

Fetch the latest repository version and update in one command:

```bash
npx --yes github:hpuhsp/OSD-Workflow update .
```

Update usage guides too:

```bash
osd-workflow update . --with-docs
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target . -Update -WithDocs
```

`update` overwrites only files managed by the template. It does not delete project-owned OpenSpec changes or knowledge archives. Use `--dry-run` to preview and review the Git diff after updating.

## Daily Use

Start a task:

```text
Use Superpowers and OpenSpec to handle {task} with OSD Workflow.
Classify task type, complexity, risk, and impact first.
Select lite, standard, or strict, then select tdd, test_first, or verification_only.
Execute only the required flow and record the strategy evidence.
```

Verify a delivery:

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode}
```

Verify only the installed contract:

```bash
node scripts/verify-workflow-artifacts.mjs --structural-only
```

See [docs/USAGE.md](docs/USAGE.md) for task-specific prompts and routing examples.

## Project Files

- `.ai/workflows/feature-development.yaml`: human-readable routing contract
- `.ai/workflow-manifest.json`: machine-readable artifact contract
- `.ai/rules/workflow-execution-rule.md`: adaptive SDD rules
- `.ai/templates/`: compact delivery and handoff templates
- `scripts/verify-workflow-artifacts.mjs`: lightweight delivery verifier
- `bin/osd-workflow-init.mjs`: Node.js initializer
- `scripts/install.ps1`: PowerShell initializer

## License

MIT
