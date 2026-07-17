# Code Review Rule

Review depth is proportional to change risk.

- `lite`: self-check the diff for correctness, unintended scope, and verification gaps. A separate review report is optional.
- `standard`: write a concise `review-report.md` covering findings, regressions, test gaps, and final result.
- `strict`: perform a full risk-first review, including architecture, compatibility, security, data, rollout, and rollback concerns when relevant.

Findings come first and use severity labels. Do not add a long summary when there are no findings.

The review must answer:

1. Does the implementation satisfy the accepted specification?
2. Did it change behavior outside the declared scope?
3. Is verification proportionate to the risk?
4. What residual risk remains?
