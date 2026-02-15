# Rocie Tools

This is the shared tools monorepo for Rocie.

## Why this repo exists

Rocie decides per user task which tool to use. Most users only need a subset of tools.
This repo keeps all tools in one place while allowing per-tool, on-demand install.

## How Rocie uses tools

Rocie is ledger-first and event-driven. Tool execution follows this policy:

- `shell`: quick synchronous commands
- `shell_bg`: long-running operational commands (preferred for external CLIs)
- `spawn_task`: heavy engineering/development delegation

For this repo, Rocie should install and run only the specific tool needed for the current user task.

## Repository layout

- one git repo for all tools
- one folder per tool
- each tool is self-contained (`package.json`, dependencies, docs)

## Install pattern (per tool)

```bash
git clone <repo-url> ~/.rocie/tools/rocie-tools
cd ~/.rocie/tools/rocie-tools/<tool-folder>
npm install
npm run build
```

## Add a new tool

1. Create a new folder at repo root (`<tool-name>/`).
2. Keep dependencies local to that folder.
3. Add a short README in the tool folder (usage + env vars).
4. Update this root README tool list.
5. Add/update the matching Rocie skill so dependency checks/install point to this repo path.

## Notes

- Avoid cross-tool dependency coupling.
- Keep tools runnable independently.
- Do not commit `.env`, `node_modules`, or `dist` outputs.
