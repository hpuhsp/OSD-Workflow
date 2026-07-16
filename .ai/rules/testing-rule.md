# Testing Rule

## Purpose

Use tests to verify the OpenSpec acceptance criteria and protect affected behavior.

## Context Priority

Test generation should use context in this order:

1. OpenSpec spec
2. Current code changes
3. CodeGraph impact analysis
4. RepoWiki architecture context
5. Source code

## Test Selection

Choose test depth according to risk:

- Low-risk localized changes: focused unit tests or existing regression tests.
- Shared modules or contracts: unit tests plus integration or contract tests.
- User-facing workflows: scenario tests covering acceptance criteria.
- Bug fixes: regression test that fails before the fix when practical.

## Required Coverage

Each acceptance criterion should map to at least one verification method:

- Automated test
- Manual verification step
- Static check
- Review evidence

## Test Report

Write test evidence to `knowledge/archive/{feature}/test-report.md` and include:

- Test scope
- Commands or verification steps
- Pass/fail result
- Coverage notes, when available
- Known gaps and residual risks

## Done Criteria

- Tests cover the changed behavior.
- Impacted critical paths are verified.
- Unverified items are explicitly documented.
- Test evidence exists in `knowledge/archive/{feature}/test-report.md`; an internal todo list or chat summary is not enough.
