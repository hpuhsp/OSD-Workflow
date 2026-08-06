# Code Review Rule

Review depth is proportional to change risk.

Use the applicable Superpowers review method. OSD defines only the required depth and evidence placement; it does not recreate the review procedure.

- `lite`: self-check the diff for correctness, unintended scope, and verification gaps. A separate review report is optional.
- `standard`: record concise findings, regressions, test gaps, and final result in `stage-report.md`; use a separate `review-report.md` only when it adds risk-control or handoff value.
- `strict`: perform a full risk-first review, including architecture, compatibility, security, data, rollout, and rollback concerns when relevant.

Findings come first and use severity labels. Do not add a long summary when there are no findings.

The review must answer:

1. Does the implementation satisfy the accepted specification?
2. Did it change behavior outside the declared scope?
3. Is verification proportionate to the risk?
4. What residual risk remains?
