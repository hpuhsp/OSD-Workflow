# Superpowers Verification Adapter

## Goal

Choose the smallest verification set that credibly proves the accepted specification.

Delegate test design, TDD, debugging, and verification mechanics to the applicable Superpowers method. This adapter defines only OSD evidence placement.

## Strategy

- `tdd`: record Red, Green, and Refactor evidence produced through Superpowers.
- `test_first`: record failing-before and passing-after evidence produced through Superpowers.
- `verification_only`: record the strategy reason and focused verification produced through Superpowers.

## Outputs

- For lite and standard work, write actual results to `knowledge/archive/{feature}/stage-report.md`.
- For strict work, always write actual results to `knowledge/archive/{feature}/test-report.md`.
- For standard and strict work, also write structured evidence to `openspec/changes/{feature}/verification.json` and link covered `AC-*` criteria.
- Create a separate `test-report.md` for lite or standard only when risk, complexity, or handoff value justifies it.
- Create a separate `test-plan.md` only for strict work or when test design is materially complex.
- Do not create a separate TDD report; use the delivery record for concise Red/Green/Refactor evidence.
