---
name: google-calendar
description: List, create, update, and delete Google Calendar events.
---

# Google Calendar Skill

## Overview
This skill provides a thin wrapper around the Google Calendar REST API. It lets you:
- **list** upcoming events (optionally filtered by time range or query)
- **add** a new event with title, start/end time, description, location, and attendees
- **update** an existing event by its ID
- **delete** an event by its ID

The skill is implemented in Python (`./google_calendar.py`). It requires `GOOGLE_ACCESS_TOKEN` at runtime. For token refresh flow, also set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`. Optional: `GOOGLE_CALENDAR_ID` (single) or `GOOGLE_CALENDAR_IDS` (comma-separated).

## Commands
```
python3 ./google_calendar.py list [--from <ISO> --to <ISO> --max <N>]
python3 ./google_calendar.py add --title <title> --start <ISO> --end <ISO> [--desc <description> --location <loc> --attendees <email1,email2>]
python3 ./google_calendar.py update --event-id <id> [--title <title> ... other fields]
python3 ./google_calendar.py delete --event-id <id>
```
All commands return a JSON payload printed to stdout. Errors are printed to stderr and cause a non‑zero exit code.

## Setup
1. **Create a Google Cloud project** and enable the *Google Calendar API*.
2. **Create OAuth credentials** (type *Desktop app*). Note the `client_id` and `client_secret`.
3. Obtain a `refresh_token` using Google OAuth consent flow (external), then store it.
4. Store credentials securely:
   ```bash
   set_config key=credentials_tools.google_client_id value=<value>
   set_config key=credentials_tools.google_client_secret value=<value>
   set_config key=credentials_tools.google_refresh_token value=<value>
   set_config key=credentials_tools.google_calendar_id value=primary   # optional
   ```
5. Generate an access token when needed:
   ```bash
   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... python3 ./refresh_token.py
   source ~/.config/google-calendar/secrets.env
   ```
6. Install dependencies (if needed):
   ```bash
   pip install --user google-auth google-auth-oauthlib google-api-python-client
   ```

## How it works (brief)
The script loads the credentials from the environment, refreshes the access token using the refresh token, builds a `service = build('calendar', 'v3', credentials=creds)`, and then calls the appropriate API method.

## References
- Google Calendar API reference: https://developers.google.com/calendar/api/v3/reference
- OAuth 2.0 for installed apps: https://developers.google.com/identity/protocols/oauth2/native-app

---

**Note:** This skill does not require a GUI; it works entirely via HTTP calls, so it is suitable for headless servers.
