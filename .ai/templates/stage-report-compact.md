# Delivery Record: {Feature Name}

- Task type: new_feature | bug_fix | existing_change | refactor | maintenance
- Mode: lite | standard
- Development strategy: tdd | test_first | verification_only
- Result: pass | blocked | partial
- Specification: `openspec/changes/{feature}/spec.md`
- Changed files: paths only
- Verification: command + exit code + short result
- Red evidence: failing test/reproduction, or N/A
- Green evidence: passing command/result, or N/A
- Refactor evidence: result after cleanup, or N/A
- Strategy reason: required only for verification_only
- Review: result or N/A for lite
- Residual risk: none or short note
- Handoff: N/A or `knowledge/archive/{feature}/handoff-brief.md`

Keep this record short. Do not create one row per stage and do not paste logs or full file contents.
