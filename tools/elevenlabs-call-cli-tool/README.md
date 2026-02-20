# elevenlabs-call-cli-tool

CLI tool for placing outbound Twilio calls through ElevenLabs Agents and returning transcript JSON.

## What it does

- Calls ElevenLabs `POST /v1/convai/twilio/outbound-call`
- Falls back to Twilio + ElevenLabs `POST /v1/convai/twilio/register-call` when no `agent_phone_number_id` is configured
- Injects per-call system prompt and dynamic variables
- Uses a built-in Rocie default prompt when no prompt arg is provided
- Appends `~/.rocie/context/user.yaml` to the end of the default prompt
- Auto-loads ElevenLabs keys from `~/.rocie/config.yaml` with normalized key parsing
- Supports `key: value` and `KEY=value` formats, case-insensitive
- Auto-resolves `agent_phone_number_id` if exactly one phone number is assigned to the agent
- Waits for the conversation to finish
- Returns normalized transcript JSON

## Requirements

- Node.js 22+
- ElevenLabs API key
- ElevenLabs agent id
- Either:
  - ElevenLabs agent phone number id (for ElevenLabs outbound-call mode), or
  - Twilio credentials + ngrok token (for register-call mode)

## Install

```bash
npm install
npm run build
```

## Environment

Required:

- `ELEVENLABS_API_KEY`

Either set these env vars or pass CLI args:

- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_AGENT_PHONE_NUMBER_ID`

Optional:

- `ELEVENLABS_BASE_URL` (default: `https://api.elevenlabs.io`)
- `ROCIE_USER_CONTEXT_FILE` (default: `/Users/rusty/.rocie/context/user.yaml`)
- `ROCIE_CONFIG_FILE` is fixed to `/Users/rusty/.rocie/config.yaml` in this tool
- `CALL_SILENCE_END_TIMEOUT_SECS` (default: `8`)
- `CALL_MAX_DURATION_SECS` (default: `180`)

Required only for register-call mode (no `agent_phone_number_id`):

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_NUMBER`
- `NGROK_AUTHTOKEN`

## Usage

```bash
node dist/elevenlabs-call-cli.cjs \
  --to "+15551234567" \
  --agent-id "agent_abc123" \
  --agent-phone-number-id "phnum_abc123" \
  --system-prompt-file /tmp/system-prompt.txt \
  --context-file /tmp/call-context.txt \
  --timeout 300000
```

Minimal:

```bash
node dist/elevenlabs-call-cli.cjs \
  --to "+15551234567" \
  --agent-id "agent_abc123" \
  --agent-phone-number-id "phnum_abc123" \
  --context "Book a table for two tomorrow at 7pm"
```

## Prompt strategy

- `--system-prompt` and `--system-prompt-file` are optional.
- If no prompt arg is provided, the CLI uses a default Rocie prompt and appends user context YAML.
- Pass a full per-call system prompt via `--system-prompt` or `--system-prompt-file` when needed.
- Pass call-specific task details via `--context`/`--context-file`.
- CLI injects dynamic variables:
  - `run_id`
  - `call_context`
  - `job`

Use `{{call_context}}` in your prompt template.

## Output

Success:

```json
{"status":"completed","callSid":"CA...","conversationId":"conv_...","transcript":[{"role":"user","content":"..."}]}
```

Failure:

```json
{"status":"error","message":"..."}
```
