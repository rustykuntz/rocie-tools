---
name: alpaca-market-data
description: Fetch real-time and historical market data (US stocks/ETFs, US options, crypto) from Alpaca via REST + WebSocket: quotes, trades, bars/OHLCV, snapshots, option chains/contracts, orderbooks.
homepage: https://docs.alpaca.markets/docs/alpaca-api-platform
dependencies: curl, jq, wscat
---

# Alpaca Market Data (Stocks, Options, Crypto)

Use Alpaca’s Market Data APIs to retrieve **historical** and **real-time** data for:
- **US stocks/ETFs** (REST + WS)
- **US options** (REST + WS; chains, contracts, quotes)
- **Crypto** (REST + WS; includes orderbooks)

## Plans & limitations (Trading API market-data subscriptions)

**Basic (Free)**
- Equities real-time: **IEX only**
- Equities WebSocket: **30 symbols**
- Historical REST rate limit: **200 calls/min**
- Historical data: **since 2016**, but **latest 15 minutes limited**
- Options real-time: **Indicative Pricing Feed**
- Options WebSocket: **200 quotes**

**Algo Trader Plus ($99/mo)**
- Equities real-time: **All US stock exchanges**
- Equities WebSocket: **Unlimited symbols**
- Historical REST rate limit: **10,000 calls/min** (docs; pricing may say “unlimited”)
- Historical data: **since 2016**, **no “latest 15 minutes” restriction**
- Options real-time: **OPRA feed (real-time)**
- Options WebSocket: **1000 quotes**

Reference: https://docs.alpaca.markets/docs/about-market-data-api

## Browser automation: create Alpaca account + generate API keys

Use this when `APCA_API_KEY_ID` / `APCA_API_SECRET_KEY` are missing and Rocie is allowed to create/log in to Alpaca via the browser.

### 1) Sign up / log in

* **Sign up (new account):** [https://app.alpaca.markets/signup](https://app.alpaca.markets/signup) 
* **Log in (existing account):** [https://app.alpaca.markets/](https://app.alpaca.markets/) 

### 2) Choose Paper vs Live before generating keys

Alpaca maintains **separate API keys** for paper trading vs live trading. If the user wants paper trading, switch to Paper first; if live, switch to Live first, then generate keys for that environment. ([Alpaca API Docs][3])

### 3) Generate keys in the dashboard (exact UI path)

1. Open the Alpaca dashboard (after login).
2. In the **right sidebar**, find **API Keys**.
3. Click **Generate New Keys**.
4. Copy both values:

   * **Key ID** → `APCA_API_KEY_ID`
   * **Secret Key** → `APCA_API_SECRET_KEY`
5. **Important:** if you navigate away and later need the secret again, you must **regenerate** keys (the secret isn’t always retrievable after first display). 

### 4) Export keys for Rocie’s CLI agents

Store keys in the environment (prefer process env / secrets manager rather than plaintext files):

* `APCA_API_KEY_ID=...`
* `APCA_API_SECRET_KEY=...`

### 5) If user asks “paper trading”

Confirm Rocie generated keys while the dashboard was in **Paper Trading**, and remind that paper keys differ from live keys. 


## Base URLs
REST base: `https://data.alpaca.markets`

WebSocket base: `wss://stream.data.alpaca.markets/{version}/{feed}`
- Test stream: `wss://stream.data.alpaca.markets/v2/test` (symbol `FAKEPACA`)
Reference: https://docs.alpaca.markets/docs/streaming-market-data

## Most-used endpoints (copy/paste targets)

### Stocks (REST, v2)
- Bars (multi-symbol): `GET /v2/stocks/bars`
- Latest quotes (multi): `GET /v2/stocks/quotes/latest`
- Latest trades (multi): `GET /v2/stocks/trades/latest`
- Snapshots (multi): `GET /v2/stocks/snapshots`

### Options (REST, v1beta1 + Trading API)
Market data (options snapshots/chain):
- Option chain (by underlying): `GET /v1beta1/options/snapshots/{underlying_symbol}`
- Options snapshots (by contracts): `GET /v1beta1/options/snapshots`
- Latest options quotes: `GET /v1beta1/options/quotes/latest`

Contracts reference (search/list contracts; host depends on live vs paper):
- `GET https://paper-api.alpaca.markets/v2/options/contracts`
Reference: https://docs.alpaca.markets/reference/get-options-contracts

### Crypto (REST, v1beta3)
- Latest orderbooks: `GET /v1beta3/crypto/{loc}/latest/orderbooks`
Reference: https://docs.alpaca.markets/reference/cryptolatestorderbooks-1

## Workflow (CLI agent)

### 1) REST auth headers
Most endpoints require these headers:
- `APCA-API-KEY-ID: $APCA_API_KEY_ID`
- `APCA-API-SECRET-KEY: $APCA_API_SECRET_KEY`

### 2) REST examples

**Stock latest quote (single symbol):**
```bash
curl -s "https://data.alpaca.markets/v2/stocks/AAPL/quotes/latest"   -H "APCA-API-KEY-ID: $APCA_API_KEY_ID"   -H "APCA-API-SECRET-KEY: $APCA_API_SECRET_KEY" | jq .
```

**Stock historical bars (multi-symbol):**
```bash
curl -s "https://data.alpaca.markets/v2/stocks/bars?symbols=AAPL,MSFT&timeframe=1Day&limit=10"   -H "APCA-API-KEY-ID: $APCA_API_KEY_ID"   -H "APCA-API-SECRET-KEY: $APCA_API_SECRET_KEY" | jq .
```

**Options chain (by underlying):**
```bash
curl -s "https://data.alpaca.markets/v1beta1/options/snapshots/SPY"   -H "APCA-API-KEY-ID: $APCA_API_KEY_ID"   -H "APCA-API-SECRET-KEY: $APCA_API_SECRET_KEY" | jq .
```

**Crypto latest orderbooks** (location per docs; common: `us`):
```bash
curl -s "https://data.alpaca.markets/v1beta3/crypto/us/latest/orderbooks?symbols=BTC/USD,ETH/USD"   -H "APCA-API-KEY-ID: $APCA_API_KEY_ID"   -H "APCA-API-SECRET-KEY: $APCA_API_SECRET_KEY" | jq .
```

### 3) WebSocket quick test
```bash
wscat -c "wss://stream.data.alpaca.markets/v2/test"
# send:
# {"action":"subscribe","trades":["FAKEPACA"]}
```

### 4) WebSocket rule of thumb
- Use WS for “live” requests (quotes/trades/bars) and to avoid REST rate limits.
- If WS auth fails with “feed not available”, it’s usually a plan mismatch.

## Output conventions
- Always include: asset class, symbols, time range/timeframe, and whether data is REST vs WS.
- If results are large: save raw JSON in the workspace and summarize.
