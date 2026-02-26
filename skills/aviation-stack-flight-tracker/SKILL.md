---
name: aviation-stack-flight-tracker
description: Track live flight status, delays, gates, and position. Use for "track AA100", "is my flight on time?", or "where is BA123 right now?".

metadata:
   version: 1.0.0
   credential: credentials_tools.aviationstack_api_key
---

# Flight Tracker

Track any flight worldwide using AviationStack API and display in a clean, Flighty-style format.

## Quick Start

Track a flight using `credential_exec` (injects API key from OS keychain):

```
credential_exec({
  command: "./track_flight.py AA100",
  credentials: { "AVIATIONSTACK_API_KEY": "credentials_tools.aviationstack_api_key" },
  workdir: "<skill directory>"
})
```

## First-Time Setup

1. **Get a free API key** at https://aviationstack.com/signup/free (100 requests/month)
2. **Store in OS keychain:** `/secret credentials_tools.aviationstack_api_key`
3. **Install dependencies:**
   ```bash
   pip3 install requests
   ```

For detailed setup instructions, see [api-setup.md](./api-setup.md).

## Output Format

The skill displays flight information in a clean, readable format with:

- ✈️ Airline and flight number
- 🛩️ Aircraft type and registration
- 🛫 Departure airport, terminal, gate, times
- 🛬 Arrival airport, terminal, gate, times
- 📊 Flight status with visual indicators
- ⏱️ Delay calculations (if applicable)
- 🌐 Live position, altitude, speed (when airborne)

Status indicators:
- 🟢 Active/Airborne/En-route
- ✅ Landed/Arrived
- 🟡 Scheduled
- 🟠 Delayed
- 🔴 Cancelled

## Advanced Usage

**Get raw JSON data:**
```bash
./track_flight.py AA100 --json
```

**Check help:**
```bash
./track_flight.py --help
```

## Workflow

When a user asks to track a flight:

1. Extract the flight number from the request
2. Run the tracking script with the flight number
3. Present the formatted output to the user
4. If data is needed for further processing, use `--json` flag

## Flight Number Formats

Accept IATA flight codes:
- AA100 (American Airlines)
- UA2402 (United)
- BA123 (British Airways)
- DL456 (Delta)

The script automatically converts to uppercase and handles the lookup.

## Error Handling

The script handles common errors:
- Missing API key → Shows setup instructions
- Flight not found → Suggests verification
- API errors → Displays error message
- Rate limit exceeded → Indicates limit reached

## API Limits

Free tier: 100 requests/month. Track usage to stay within limits. For heavy usage, consider upgrading or alternative APIs (see ./api-setup.md).

## Notes

- Uses AviationStack free tier (no HTTPS on free plan)
- Real-time data updated frequently
- Historical flight data available
- Worldwide coverage (250+ countries, 13,000+ airlines)
