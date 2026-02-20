# voice-call-cli-tool

CLI tool for placing an outbound Twilio call powered by OpenAI Realtime, then returning the full transcript as JSON.

## What it does

- Starts a local webhook server + ngrok tunnel
- Places the outbound call
- Streams media through OpenAI Realtime
- Waits until call completion
- Prints transcript JSON to stdout and exits

## Requirements

- Node.js 22+
- Twilio account + phone number
- OpenAI API key
- ngrok authtoken
- Explicit OpenAI realtime model id (pinned)

## Install

```bash
npm install
npm run build
```

## Environment

Set these in `.env` (or export in shell):

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_NUMBER`
- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL`
- `NGROK_AUTHTOKEN`

Optional:

- `OPENAI_WEBSOCKET_URL` (default: `wss://api.openai.com/v1/realtime`)
- `OPENAI_SESSION_SCHEMA` (`ga` default, set `legacy` only if needed)
- `OPENAI_TURN_DETECTION` (default: `semantic_vad`)
- `OPENAI_VAD_THRESHOLD` (server_vad only, default: `0.7`)
- `OPENAI_VAD_PREFIX_PADDING_MS` (server_vad only, default: `300`)
- `OPENAI_VAD_SILENCE_DURATION_MS` (server_vad only, default: `450`)
- `OPENAI_VOICE` (default: `marin`)
- `OPENAI_VOICE_ID` (custom voice id such as `voice_123abc`; GA schema only)
- `OPENAI_TRANSCRIPTION_LANGUAGE` (optional; e.g. `en`, `th`, `es`; when unset, model auto-detects)
- `OPENAI_TEMPERATURE` (default: `0.45`)
- `END_CALL_DELAY_MS` (default: `1500`)
- `PORT` (default: `3004`)

## Usage

```bash
node dist/voice-call-cli.cjs \
  --to "+15551234567" \
  --context-file /tmp/call-context.txt \
  --voice marin \
  --timeout 300000
```

You can also pass context directly:

```bash
node dist/voice-call-cli.cjs \
  --to "+15551234567" \
  --context "Call and confirm appointment details" \
  --voice marin \
  --timeout 300000
```

Or via stdin:

```bash
cat /tmp/call-context.txt | node dist/voice-call-cli.cjs --to "+15551234567" --voice marin
```

Using a custom voice id (requires GA schema):

```bash
OPENAI_SESSION_SCHEMA=ga \
node dist/voice-call-cli.cjs \
  --to "+15551234567" \
  --context-file /tmp/call-context.txt \
  --voice-id "voice_123abc"
```

## Output

Success:

```json
{"status":"completed","callSid":"CA...","transcript":[{"role":"user","content":"..."}]}
```

Failure:

```json
{"status":"error","message":"..."}
```
