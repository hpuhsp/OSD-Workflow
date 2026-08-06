# Atomic Tasks: OSD Workflow Governance Hardening

- T-01: Upgrade the machine contract and add state/approval/task/evidence templates. Linked acceptance criteria: AC-01, AC-02, AC-08, AC-09, AC-10. Owner: workflow maintainer. Dependencies: none. Status: done. Verification: manifest and template fixture tests.
- T-02: Extend the artifact verifier with state, approval, acceptance-criteria, task, evidence, and archive validation. Linked acceptance criteria: AC-01 through AC-10. Owner: workflow maintainer. Dependencies: T-01. Status: done. Verification: positive and negative verifier fixtures.
- T-03: Update developer/test-agent context contracts and handoff templates. Linked acceptance criteria: AC-08. Owner: workflow maintainer. Dependencies: T-01. Status: done. Verification: structural verifier and entry fixture tests.
- T-04: Update English and Chinese documentation with the new gates and migration behavior. Linked acceptance criteria: AC-12. Owner: workflow maintainer. Dependencies: T-01, T-02. Status: done. Verification: documentation review and structural verifier.
- T-05: Add regression coverage and run the complete test/verification suite. Linked acceptance criteria: AC-03, AC-04, AC-05, AC-06, AC-07, AC-10, AC-11. Owner: workflow maintainer. Dependencies: T-02, T-03, T-04. Status: done. Verification: `node --test` and structural verification.
