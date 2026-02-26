# alpaca-market-data-cli-tool

Minimal external CLI for Alpaca Market Data, designed as a Rocie tool example.

## Why this exists

- Keeps vendor-specific API code out of `rocie_v2/src/tools.js`
- Reads credentials from env vars only (no config file / keychain reads inside the tool)
- Prints JSON so Rocie can parse/summarize easily

This is the pattern to copy for future secret-using external tools:

1. Rocie runtime fetches secrets from keychain
2. Rocie injects env vars for this process only
3. External CLI performs the API call
4. CLI returns JSON

## Install

```bash
cd tools/alpaca-market-data-cli-tool
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

## Credentials (env vars)

Required:

- `APCA_API_KEY_ID`
- `APCA_API_SECRET_KEY`

Optional:

- `APCA_RAW_DATA=true` (use SDK raw mode when supported)

## Commands

### Latest stock quote

```bash
alpaca-market-data latest-quote --symbol AAPL
```

### Historical stock bars

```bash
alpaca-market-data bars --symbols AAPL,MSFT --timeframe 1Day --limit 10
alpaca-market-data bars --symbols AAPL --timeframe 5Min --start 2026-02-24T14:30:00Z --end 2026-02-24T21:00:00Z
```

## Output

Success: JSON object/array from Alpaca SDK response.

Failure: JSON error object on stderr and exit code `1`.

## Notes

- Uses `alpaca-py` (Python SDK)
- Scope is intentionally small (`latest-quote`, `bars`) to be a clean example
- Extend with new subcommands instead of embedding `curl` examples in skills
