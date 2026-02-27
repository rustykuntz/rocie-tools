---
name: vapi-voice-call
description: Place outbound phone calls with transcripts via Vapi.
metadata:
  homepage: https://vapi.ai
  credential: credentials_tools.vapi_api_key
---

## Credential

Key: `credentials_tools.vapi_api_key` — check availability via `get_config credentials_tools.vapi_api_key`.

# vapi-voice-call

Place outbound phone calls via the Vapi API. Creates the call, polls until completion, and returns structured JSON with transcript.

## Installation

```bash
# Clone only the vapi-call-cli-tool from rocie-tools
git clone --filter=blob:none --sparse https://github.com/rustykuntz/rocie-tools.git ~/.rocie/tools/vapi-call-cli-tool
cd ~/.rocie/tools/vapi-call-cli-tool
git sparse-checkout set tools/vapi-call-cli-tool

# Install and build
cd tools/vapi-call-cli-tool
npm install
npm run build
```

The built binary is at `~/.rocie/tools/vapi-call-cli-tool/tools/vapi-call-cli-tool/dist/vapi-call-cli.cjs`.

To verify installation:
```bash
node ~/.rocie/tools/vapi-call-cli-tool/tools/vapi-call-cli-tool/dist/vapi-call-cli.cjs --help
```

## Required credentials

- `VAPI_API_KEY` — required. Store in OS keychain: `/secret credentials_tools.vapi_api_key`

## Optional credentials

Twilio (for BYO outbound number — only needed when `--phone-number-id` is not provided and all three are set):
- `TWILIO_ACCOUNT_SID` — `/secret credentials_tools.twilio_account_sid`
- `TWILIO_AUTH_TOKEN` — `/secret credentials_tools.twilio_auth_token`
- `TWILIO_NUMBER` — `/secret credentials_tools.twilio_number`

All credentials are stored in the OS keychain via `/secret`. No tool exposes secret values — the runtime injects them when needed.

## Usage

```bash
VAPI_CLI="$HOME/.rocie/tools/vapi-call-cli-tool/tools/vapi-call-cli-tool/dist/vapi-call-cli.cjs"

# Basic call
node "$VAPI_CLI" \
  --to "+15551234567" \
  --context "Call to confirm booking details and politely close."

# With custom system prompt and force-end after 2 minutes
node "$VAPI_CLI" \
  --to "+15551234567" \
  --context "Ask about order status for order #12345" \
  --system-prompt "You are a customer service agent. Be brief and professional." \
  --hard-end-after 120000

# Context from file
node "$VAPI_CLI" \
  --to "+15551234567" \
  --context-file /tmp/call-brief.txt

# Context from stdin
cat /tmp/call-brief.txt | node "$VAPI_CLI" --to "+15551234567"
```

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `--to` | yes | Phone number in E.164 format (`+` followed by 8-15 digits) |
| `--context` | yes (or `--context-file` or stdin) | Call objective/context as inline string |
| `--context-file` | alt | Path to file containing call context |
| `--system-prompt` | no | Custom system prompt (inline) |
| `--system-prompt-file` | no | Path to file containing custom system prompt |
| `--assistant-id` | no | Existing Vapi assistant ID (auto-creates one if omitted) |
| `--phone-number-id` | no | Vapi phone number ID for outbound |
| `--timeout` | no | Max wait for completion in ms (default: 300000 / 5min) |
| `--hard-end-after` | no | Force-end call after N ms (e.g. `120000` for 2min cap) |

## Output format

Success:
```json
{
  "status": "completed",
  "callId": "call_abc123",
  "transcript": [
    {"role": "assistant", "content": "Hi, this is Rocie..."},
    {"role": "user", "content": "Hello, yes I'm here."}
  ]
}
```

Error:
```json
{
  "status": "error",
  "callId": "call_abc123",
  "message": "Call ended with status failed: No answer"
}
```

## Behavior notes

- If no `--assistant-id`, the CLI auto-creates a temporary Vapi assistant with Rocie's default persona.
- User context from `~/.rocie/context/user.yaml` is automatically appended to the system prompt.
- Polls `GET /calls/{id}` every 2 seconds until terminal state (`ended`, `completed`, `failed`, `canceled`, `no-answer`, `busy`).
- `--hard-end-after` sends `POST /calls/{id}/end` to force-terminate long calls.
- Transcript roles are normalized: `bot`/`ai`/`agent` -> `assistant`, `customer`/`human` -> `user`.

## Voice & model defaults

These can be overridden via env vars or `~/.rocie/config.yaml`:

| Setting | Env var | Default |
|---------|---------|---------|
| Voice provider | `VAPI_VOICE_PROVIDER` | `vapi` |
| Voice ID | `VAPI_VOICE_ID` | `Tara` |
| Model provider | `VAPI_MODEL_PROVIDER` | `openai` |
| Model | `VAPI_MODEL` | `gpt-4.1` |
| First message mode | `VAPI_FIRST_MESSAGE_MODE` | `assistant-speaks-first-with-model-generated-message` |
| Background sound | `VAPI_BACKGROUND_SOUND` | `office` |
