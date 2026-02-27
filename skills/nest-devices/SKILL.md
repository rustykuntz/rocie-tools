---
name: nest-devices
description: Control Nest thermostat, cameras, and doorbell. Use for "set temperature to 24", "show front door camera", or "who's at the door?".
metadata:
  homepage: https://developers.google.com/nest/device-access
  credential: credentials_tools.nest_project_id
---

## Credential

Key: `credentials_tools.nest_project_id` — check availability via `get_config credentials_tools.nest_project_id`.

Also requires `credentials_tools.nest_client_id`, `credentials_tools.nest_client_secret`, and `credentials_tools.nest_refresh_token`.

# Nest Device Access

Control Nest devices via Google's Smart Device Management API.

## Setup

### 1. Google Cloud & Device Access

1. Create a Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com)
2. Pay the $5 fee and create a Device Access project at [console.nest.google.com/device-access](https://console.nest.google.com/device-access)
3. Create OAuth 2.0 credentials (Web application type)
4. Add `https://www.google.com` as an authorized redirect URI
5. Link your Nest account to the Device Access project

### 2. Get Refresh Token

Run the OAuth flow to get a refresh token:

```bash
# 1. Open this URL in browser (replace CLIENT_ID and PROJECT_ID):
https://nestservices.google.com/partnerconnections/PROJECT_ID/auth?redirect_uri=https://www.google.com&access_type=offline&prompt=consent&client_id=CLIENT_ID&response_type=code&scope=https://www.googleapis.com/auth/sdm.service

# 2. Authorize and copy the 'code' parameter from the redirect URL

# 3. Exchange code for tokens:
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "code=AUTH_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=https://www.google.com"
```

### 3. Store Credentials

Store in 1Password or OS keychain:

**1Password** (recommended):
Create an item with fields: `project_id`, `client_id`, `client_secret`, `refresh_token`

**OS keychain:**
```
/secret credentials_tools.nest_project_id
/secret credentials_tools.nest_client_id
/secret credentials_tools.nest_client_secret
/secret credentials_tools.nest_refresh_token
```

## Usage

All commands run via `credential_exec`:

```
credential_exec({
  command: "python3 ./nest.py list",
  credentials: {
    "NEST_PROJECT_ID": "credentials_tools.nest_project_id",
    "NEST_CLIENT_ID": "credentials_tools.nest_client_id",
    "NEST_CLIENT_SECRET": "credentials_tools.nest_client_secret",
    "NEST_REFRESH_TOKEN": "credentials_tools.nest_refresh_token"
  }
})
```

### List devices
```bash
python3 ./nest.py list
```

### Thermostat

```bash
# Get status
python3 ./nest.py get <device_id>

# Set temperature (Celsius)
python3 ./nest.py set-temp <device_id> 21 --unit c --type heat

# Set temperature (Fahrenheit)
python3 ./nest.py set-temp <device_id> 70 --unit f --type heat

# Change mode (HEAT, COOL, HEATCOOL, OFF)
python3 ./nest.py set-mode <device_id> HEAT

# Eco mode
python3 ./nest.py set-eco <device_id> MANUAL_ECO
```

### Cameras

```bash
# Generate live stream URL (RTSP, valid ~5 min)
python3 ./nest.py stream <device_id>
```

## Python API

```python
from nest import NestClient

client = NestClient()

# List devices
devices = client.list_devices()

# Thermostat control
client.set_heat_temperature(device_id, 21.0)  # Celsius
client.set_thermostat_mode(device_id, 'HEAT')
client.set_eco_mode(device_id, 'MANUAL_ECO')

# Camera stream
result = client.generate_stream(device_id)
rtsp_url = result['results']['streamUrls']['rtspUrl']
```

## Configuration

The script checks for credentials in this order:

1. **1Password**: Set `NEST_OP_VAULT` and `NEST_OP_ITEM` (or use defaults: vault "Alfred", item "Nest Device Access API")
2. **Environment variables**: `NEST_PROJECT_ID`, `NEST_CLIENT_ID`, `NEST_CLIENT_SECRET`, `NEST_REFRESH_TOKEN`

## Temperature Reference

| Setting | Celsius | Fahrenheit |
|---------|---------|------------|
| Eco (away) | 15-17°C | 59-63°F |
| Comfortable | 19-21°C | 66-70°F |
| Warm | 22-23°C | 72-73°F |
| Night | 17-18°C | 63-65°F |

---

## Real-Time Events (Doorbell, Motion, etc.)

For instant alerts when someone rings the doorbell or motion is detected, you need to set up Google Cloud Pub/Sub with a webhook.

### Prerequisites

- Google Cloud CLI (`gcloud`) installed and authenticated
- Cloudflare account (free tier works) for the tunnel
- Clawdbot hooks enabled in config

### 1. Enable Hooks

Add to your agent config:

```json
{
  "hooks": {
    "enabled": true,
    "token": "your-secret-token-here"
  }
}
```

Generate a token: `openssl rand -hex 24`

### 2. Create Pub/Sub Topic

```bash
gcloud config set project YOUR_GCP_PROJECT_ID

# Create topic
gcloud pubsub topics create nest-events

# Grant SDM permission to publish (both the service account and publisher group)
gcloud pubsub topics add-iam-policy-binding nest-events \
  --member="serviceAccount:sdm-prod@sdm-prod.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

gcloud pubsub topics add-iam-policy-binding nest-events \
  --member="group:sdm-publisher@googlegroups.com" \
  --role="roles/pubsub.publisher"
```

### 3. Link Topic to Device Access

Go to [console.nest.google.com/device-access](https://console.nest.google.com/device-access) → Your Project → Edit → Set Pub/Sub topic to:

```
projects/YOUR_GCP_PROJECT_ID/topics/nest-events
```

### 4. Set Up Cloudflare Tunnel

```bash
# Install cloudflared
curl -L -o ~/.local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x ~/.local/bin/cloudflared

# Authenticate (opens browser)
~/.local/bin/cloudflared tunnel login

# Create named tunnel
~/.local/bin/cloudflared tunnel create nest-webhook

# Note the Tunnel ID (UUID) from output
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: nest-webhook
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: nest.yourdomain.com
    service: http://localhost:8420
  - service: http_status:404
```

Create DNS route:

```bash
~/.local/bin/cloudflared tunnel route dns nest-webhook nest.yourdomain.com
```

### 5. Create Systemd Services

**Webhook server** (`/etc/systemd/system/nest-webhook.service`):

```ini
[Unit]
Description=Nest Pub/Sub Webhook Server
After=network.target

[Service]
Type=simple
User=YOUR_USER
Environment=ROCIE_GATEWAY_URL=http://localhost:18789
Environment=ROCIE_HOOKS_TOKEN=your-hooks-token-here
ExecStart=/usr/bin/python3 /path/to/skills/nest-devices/nest-webhook.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Cloudflare tunnel** (`/etc/systemd/system/cloudflared-nest.service`):

```ini
[Unit]
Description=Cloudflare Tunnel for Nest Webhook
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
ExecStart=/home/YOUR_USER/.local/bin/cloudflared tunnel run nest-webhook
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nest-webhook cloudflared-nest
```

### 6. Create Pub/Sub Push Subscription

```bash
gcloud pubsub subscriptions create nest-events-sub \
  --topic=nest-events \
  --push-endpoint="https://nest.yourdomain.com/nest/events" \
  --ack-deadline=30
```

### 7. Test

```bash
# Test webhook endpoint
curl https://nest.yourdomain.com/health

# Simulate doorbell event
curl -X POST http://localhost:8420/nest/events \
  -H "Content-Type: application/json" \
  -d '{"message":{"data":"eyJyZXNvdXJjZVVwZGF0ZSI6eyJuYW1lIjoiZW50ZXJwcmlzZXMvdGVzdC9kZXZpY2VzL0RPT1JCRUxMLTAxIiwiZXZlbnRzIjp7InNkbS5kZXZpY2VzLmV2ZW50cy5Eb29yYmVsbENoaW1lLkNoaW1lIjp7ImV2ZW50SWQiOiJ0ZXN0In19fX0="}}'
```

### Supported Events

| Event | Behaviour |
|-------|-----------|
| `DoorbellChime.Chime` | 🔔 **Alerts** — sends photo to Telegram |
| `CameraPerson.Person` | 🚶 **Alerts** — sends photo to Telegram |
| `CameraMotion.Motion` | 📹 Logged only (no alert) |
| `CameraSound.Sound` | 🔊 Logged only (no alert) |
| `CameraClipPreview.ClipPreview` | 🎬 Logged only (no alert) |

> **Staleness filter:** Events older than 5 minutes are logged but never alerted. This prevents notification floods if queued Pub/Sub messages are delivered late.

### Image Capture

When a doorbell or person event triggers an alert:

1. **Primary:** SDM `GenerateImage` API — fast, event-specific snapshot
2. **Fallback:** RTSP live stream frame capture via `ffmpeg` (requires `ffmpeg` installed)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ROCIE_GATEWAY_URL` | No | Gateway URL (default: `http://localhost:18789`) |
| `ROCIE_HOOKS_TOKEN` | Yes | Gateway hooks token for awareness notifications |
| `OP_SVC_ACCT_TOKEN` | Yes | 1Password service account token for Nest API credentials |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token for sending alerts |
| `TELEGRAM_CHAT_ID` | Yes | Telegram chat ID to receive alerts |
| `PORT` | No | Webhook server port (default: `8420`) |

### Important Setup Notes

- **Verify the full Pub/Sub topic path** in Device Access Console matches your GCP project exactly: `projects/YOUR_GCP_PROJECT_ID/topics/nest-events`
- **Use a push subscription**, not pull — the webhook expects HTTP POST delivery
- **Test end-to-end** after setup: ring the doorbell and confirm a photo arrives. Don't rely on simulated POST requests alone.

---

## Limitations

- Camera event images expire after ~5 minutes (RTSP fallback captures current frame instead)
- Real-time events require Pub/Sub setup (see above)
- Quick tunnels (without Cloudflare account) have no uptime guarantee
- Some older Nest devices may not support all features
- Motion and sound events are intentionally not alerted to avoid notification fatigue
