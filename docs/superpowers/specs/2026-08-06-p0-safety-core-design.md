# Design: OSD P0 Safety Core Improvements

**Date:** 2026-08-06  
**Branch:** `feature/osd-improvements`  
**Scope:** P0 improvements from architecture analysis report

## Goal

Fix the three most critical trust gaps in OSD 2.0's delivery contract:
1. No recovery path from blocked/failed stages (rollback)
2. Event sanitization only checks keys, not values (sensitive data leak)
3. Schema strings are labels, not validators (silent corruption)

## Non-Goals

- Adapter externalization to config (P1)
- Aggregated observability / `osd audit` (P1)
- Multi-step verification (P2)
- CI integration templates (P2)
- Plugin system (P2)
- Concurrency locks (P3)

## Architecture

All changes are within `lib/osd-core.mjs`. No new files, no new dependencies. The design follows OSD's existing patterns: single-file core, zero runtime deps, hand-rolled validation, test-injectable I/O.

### Change 1: Rollback Command

**Command:** `osd rollback <feature> --to <stage>`

**Behavior:**
- Load state via existing `loadState()`
- Validate target stage is earlier than current stage (using `WORKFLOW_STAGES` index)
- Validate target stage is a valid stage name
- Call `transition(state, targetStage, "rolled_back")` — reuses existing history mechanism
- Call `saveState(target, state)`
- Output confirmation

**Constraints:**
- Cannot rollback from `complete` stage (archived deliveries are immutable)
- Cannot rollback to the same stage or a later stage
- Works on `blocked` state (unblocks the delivery)

**No artifact modification:** Artifacts from later stages remain on disk. When the user re-runs a stage (e.g. `osd verify`), the existing `writeJson`/`writeText` calls overwrite them. This is consistent with the current behavior where re-running a stage replaces its output.

**Code touch points:**
- `parseArgs`: Add `--to` flag parsing, add `rollback` to commands set
- `usage()`: Add rollback line
- `run()`: Add `rollback` dispatch
- New export: `rollbackDelivery(options, { output })`
- `WORKFLOW_STAGES` already has the ordered list — reuse for index comparison

### Change 2: Value-Level Sensitive Data Detection

**Behavior:**
- Extend `containsSensitiveData(value)` to check string values against known secret patterns
- Add `SENSITIVE_VALUE_PATTERNS` constant array of regex patterns
- Patterns cover: AWS keys (AKIA/ASIA), GitHub tokens (ghp_), OpenAI keys (sk-), JWTs (eyJ...eyJ), private key headers (BEGIN PRIVATE KEY), generic high-specificity patterns

**Patterns (initial set):**
```javascript
const SENSITIVE_VALUE_PATTERNS = [
  /^AKIA[0-9A-Z]{16}$/,                    // AWS Access Key
  /^ASIA[0-9A-Z]{16}$/,                    // AWS STS Token
  /^ghp_[A-Za-z0-9]{36}$/,                 // GitHub PAT
  /^gho_[A-Za-z0-9]{36}$/,                 // GitHub OAuth
  /^sk-[A-Za-z0-9]{20,}$/,                 // OpenAI/Stripe secret key
  /^pk_[A-Za-z0-9]{20,}$/,                 // Stripe publishable
  /^eyJ[A-Za-z0-9+/=_-]+\.eyJ[A-Za-z0-9+/=_-]+\.[A-Za-z0-9+/=_-]+$/, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,    // PEM private key
  /^xox[bpoas]-[A-Za-z0-9-]+$/,            // Slack token
];
```

**Code touch points:**
- Add `SENSITIVE_VALUE_PATTERNS` constant
- Modify `containsSensitiveData(value)`:
  - Keep existing key-based check
  - Add: if `typeof value === "string"`, test against patterns
  - Add: if `typeof value === "string"` and value length > 20, test for patterns

**No new dependencies.** Pure regex, same function signature.

### Change 3: JSON Schema Validation

**Behavior:**
- Add `validateState(state)`, `validateConfig(config)` functions
- Called at: `loadState()` (after parse), `loadProject()` (after parse), `saveState()` (before write)
- On validation failure: throw descriptive error

**validateState checks:**
- `schema` field equals `"osd-change-state/v2"`
- `feature` is a non-empty string matching `[a-z0-9-]+`
- `stage` is one of `WORKFLOW_STAGES` stage names + `complete`
- `status` is a string
- `mode` is in `VALID_MODES`
- `strategy` is in `VALID_STRATEGIES`
- `task_type` is in `VALID_TYPES`
- `history` is an array

**validateConfig checks:**
- `schema` field equals `"osd.config/v2"`
- `agents` is an array (if present)
- `workflow` keys (if present) are valid stage names
- `adaptive_mode.thresholds` has numeric values (if present)

**Code touch points:**
- New function: `validateState(state)` — returns `{ ok: boolean, errors: string[] }`
- New function: `validateConfig(config)` — returns `{ ok: boolean, errors: string[] }`
- Modify `loadState()`: call `validateState` after read, throw on invalid
- Modify `loadProject()`: call `validateConfig` after read (already has `configStatus`, extend it)
- Modify `saveState()`: call `validateState` before write

**No new dependencies.** Hand-written validators using existing `VALID_MODES`, `VALID_STRATEGIES`, `VALID_TYPES`, `WORKFLOW_STAGES` constants.

## Testing Strategy

All three changes follow TDD: write failing test first, implement, verify green.

**Test file:** `test/initializer.test.mjs` (extend existing suite)

**New tests:**
1. `rollbackDelivery reverts state to an earlier stage and records history`
   - Start a delivery, advance to verification, rollback to planning
   - Assert state.stage === "planning", history has rolled_back entry
2. `rollbackDelivery rejects same-stage, later-stage, and complete rollback`
   - Assert throws on rollback to current stage
   - Assert throws on rollback to later stage
   - Assert throws on rollback from complete
3. `containsSensitiveData rejects known secret patterns in values`
   - Assert rejects event with `{ notes: "AKIA1234567890ABCDEF" }`
   - Assert rejects event with `{ config: "gho_" + "x".repeat(36) }`
   - Assert rejects event with `{ data: "eyJhbGci.eyJzdWI.signature" }`
   - Assert accepts event with `{ notes: "regular text" }`
4. `validateState rejects corrupted state and accepts valid state`
   - Assert rejects missing schema
   - Assert rejects invalid stage name
   - Assert rejects invalid mode
   - Assert accepts valid state
5. `validateConfig rejects corrupted config and accepts valid config`
   - Assert rejects missing schema
   - Assert accepts valid config

## File Impact

| File | Change type |
|------|-------------|
| `lib/osd-core.mjs` | Modified: add rollback, extend sensitive data, add validators |
| `test/initializer.test.mjs` | Modified: add 5 new test cases |
| `docs/USAGE.md` | Modified: add rollback command docs |
| `docs/USAGE_zh.md` | Modified: add rollback command docs |
| `assets/osd-contract-v2.json` | Modified: add rollback to guarantees |

## Open Questions

None. All three changes are self-contained within the existing architecture.
