# vapi-call-cli-tool

CLI tool for placing outbound calls via Vapi and returning transcript JSON.

## What it does

- Calls Vapi `POST /calls`
- Injects per-call system prompt through `assistantOverrides`
- Auto-creates an assistant on the fly when `assistant_id` is not provided
- Uses built-in Rocie default prompt when prompt args are omitted
- Appends `~/.rocie/context/user.yaml` to the default prompt
- Polls Vapi `GET /calls/{id}` until terminal state
- Optionally forces end via `POST /calls/{id}/end` if call runs too long

## Install

```bash
npm install
npm run build
```

## Environment

Required:

- `VAPI_API_KEY`

Either set these env vars or pass args:

- `VAPI_ASSISTANT_ID`

Optional:

- `VAPI_BASE_URL` (default: `https://api.vapi.ai`)
- `VAPI_VOICE_PROVIDER` (default: `vapi`)
- `VAPI_VOICE_ID` (default: `Tara`)
- `VAPI_MODEL_PROVIDER` (default: `openai`)
- `VAPI_MODEL` (default: `gpt-4.1`)
- `VAPI_FIRST_MESSAGE_MODE` (default: `assistant-speaks-first-with-model-generated-message`)
- `VAPI_FIRST_MESSAGE` (default: empty)
- `VAPI_END_CALL_FUNCTION_ENABLED` (default: `true`)
- `VAPI_BACKGROUND_SOUND` (default: `office`)
- `ROCIE_USER_CONTEXT_FILE` (default: `~/.rocie/context/user.yaml`)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_NUMBER` (used automatically for BYO Twilio outbound calls when `phoneNumberId` is not provided)

The CLI also auto-loads `~/.rocie/config.yaml` with normalized keys (`key: value` or `KEY=value`, case-insensitive).

## Usage

```bash
node dist/vapi-call-cli.cjs \
  --to "+15551234567" \
  --context "Call to confirm booking details and politely close." \
  --timeout 300000
```

Optional:

- `--system-prompt` or `--system-prompt-file`
- `--phone-number-id` (if your Vapi setup requires it)
- `--hard-end-after 120000` to force end active call after 120s

## Output

Success:

```json
{"status":"completed","callId":"call_...","transcript":[{"role":"user","content":"..."}]}
```

Failure:

```json
{"status":"error","callId":"call_...","message":"..."}
```
