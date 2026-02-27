---
name: goplaces
description: Look up places, reviews, and details via Google Places. Use for "find coffee shops near me", "reviews for X restaurant", or "what's the address of Y?".
metadata:
  homepage: https://github.com/steipete/goplaces
  credential: credentials_tools.google_places_api_key
  dependencies:
    goplaces:
      description: goplaces CLI
      check: "goplaces --help"
      install: "brew install steipete/tap/goplaces"
---

## Credential

Key: `credentials_tools.google_places_api_key` — check availability via `get_config credentials_tools.google_places_api_key`.

# goplaces

Modern Google Places API (New) CLI. Human output by default, `--json` for scripts.

Install

- Homebrew: `brew install steipete/tap/goplaces`

Config

- Store API key in OS keychain: `/secret credentials_tools.google_places_api_key`
- Optional: `GOOGLE_PLACES_BASE_URL` for testing/proxying.

All commands must run via `credential_exec`:
```
credential_exec({
  command: "<goplaces command>",
  credentials: { "GOOGLE_PLACES_API_KEY": "credentials_tools.google_places_api_key" }
})
```

Common commands

- Search: `goplaces search "coffee" --open-now --min-rating 4 --limit 5`
- Bias: `goplaces search "pizza" --lat 40.8 --lng -73.9 --radius-m 3000`
- Pagination: `goplaces search "pizza" --page-token "NEXT_PAGE_TOKEN"`
- Resolve: `goplaces resolve "Soho, London" --limit 5`
- Details: `goplaces details <place_id> --reviews`
- JSON: `goplaces search "sushi" --json`

Notes

- `--no-color` or `NO_COLOR` disables ANSI color.
- Price levels: 0..4 (free → very expensive).
- Type filter sends only the first `--type` value (API accepts one).
