# Rocie Tools

Shared skills, procedures, and CLI tools for Rocie. Installed on-demand per task — most users only need a subset.

## Layout

```
skills/                  # Skill docs (SKILL.md per skill)
procedures/              # Learned routines (markdown per procedure)
tools/                   # Standalone CLI tools (self-contained, npm install per tool)
scripts/                 # Index builders
skills-index.json        # Auto-generated skill catalog
procedures-index.json    # Auto-generated procedure catalog
```

## Skills

43 skills covering search, calendars, messaging, deployment, smart home, finance, documents, and more. Each skill is a `SKILL.md` with structured frontmatter (name, description, dependencies) and usage docs.

Rocie discovers skills via embedding search against `skills-index.json` — not by dumping the full catalog into the prompt.

## Procedures

Learned routines for recurring tasks — the specific order, sources, fallbacks, and judgment that work best. Rocie matches procedures to user intent via embedding search against `procedures-index.json`.

## CLI Tools

- `voice-call-cli-tool` — Twilio + OpenAI Realtime outbound calls
- `elevenlabs-call-cli-tool` — Twilio + ElevenLabs Agents outbound calls
- `vapi-call-cli-tool` — Vapi outbound calls with per-call prompt overrides

Install per tool: `cd tools/<name> && npm install`

## Indexes

Both `skills-index.json` and `procedures-index.json` are auto-rebuilt by a GitHub Action on pushes to `main` that touch `skills/**`, `procedures/**`, or `scripts/build-*`.

Rebuild locally:
```bash
node scripts/build-skills-index.mjs .
node scripts/build-procedures-index.mjs .
```

## Add a skill

1. Create `skills/<name>/SKILL.md` with frontmatter (`name`, `description`, dependencies).
2. Push to `main` — index rebuilds automatically.

## Add a procedure

1. Create `procedures/<name>.md` following `procedures/procedure_template.md`.
2. Push to `main` — index rebuilds automatically.

## Rules

- Keep skills and tools self-contained — no cross-dependency coupling.
- Don't commit `.env`, `node_modules`, or `dist`.
