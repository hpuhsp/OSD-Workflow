# OpenSpec Project Workspace

This directory is reserved for project-level OpenSpec workspace assets.

The recommended local setup is:

- Install OpenSpec CLI globally, for example `npm install -g @fission-ai/openspec@latest`.
- Run `openspec init` in each target project.
- Store active changes under `openspec/changes/{feature}/`.
- Keep proposal, spec, and design files versioned with the project.
- Treat OpenSpec as the source of truth for requirement intent, design decisions, and acceptance criteria.

Agent/Harness-level Superpowers may orchestrate the workflow, but OpenSpec knowledge belongs to the project workspace.
