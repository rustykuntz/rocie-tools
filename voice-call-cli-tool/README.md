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
- `NGROK_AUTHTOKEN`

Optional:

- `OPENAI_WEBSOCKET_URL` (default: `wss://api.openai.com/v1/realtime?model=gpt-realtime`)
- `OPENAI_SESSION_SCHEMA` (`legacy` default, `ga` optional)
- `OPENAI_REALTIME_MODEL` (default: `gpt-realtime`)
- `OPENAI_TURN_DETECTION` (default: `semantic_vad`)
- `END_CALL_DELAY_MS` (default: `1500`)
- `PORT` (default: `3004`)

## Usage

```bash
node dist/voice-call-cli.cjs \
  --to "+15551234567" \
  --context-file /tmp/call-context.txt \
  --timeout 300000
```

You can also pass context directly:

```bash
node dist/voice-call-cli.cjs \
  --to "+15551234567" \
  --context "Call and confirm appointment details" \
  --timeout 300000
```

Or via stdin:

```bash
cat /tmp/call-context.txt | node dist/voice-call-cli.cjs --to "+15551234567"
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
