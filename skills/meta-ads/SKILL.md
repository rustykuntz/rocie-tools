---
name: meta-ads
description: Full read/write integration with Meta (Facebook) Ads API for managing campaigns, ad sets, ads, and accessing performance insights/metrics.
metadata: {"rocie":{"requires":{"env":["META_ACCESS_TOKEN","META_AD_ACCOUNT_ID"]}}}
---

# Meta Ads API

## Setup

- `META_ACCESS_TOKEN` - Meta access token (User or System User Token)
- `META_AD_ACCOUNT_ID` - Ad account ID (numeric, without `act_` prefix)

Base URL: `https://graph.facebook.com/v25.0/`

**Important:** Ad account IDs must be prefixed with `act_` in API calls.

---

## Campaigns

```bash
# List
curl "https://graph.facebook.com/v25.0/act_$META_AD_ACCOUNT_ID/campaigns?fields=id,name,status,objective,daily_budget" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN"

# Create
curl -X POST "https://graph.facebook.com/v25.0/act_$META_AD_ACCOUNT_ID/campaigns" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Campaign","objective":"OUTCOME_TRAFFIC","status":"PAUSED","special_ad_categories":[]}'

# Pause
curl -X POST "https://graph.facebook.com/v25.0/{CAMPAIGN_ID}" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"PAUSED"}'
```

## Ad Sets

```bash
# Create with targeting
curl -X POST "https://graph.facebook.com/v25.0/act_$META_AD_ACCOUNT_ID/adsets" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Ad Set","campaign_id":"{CAMPAIGN_ID}","daily_budget":5000,"billing_event":"IMPRESSIONS","optimization_goal":"LINK_CLICKS","targeting":{"geo_locations":{"countries":["US"]},"age_min":18,"age_max":65},"status":"PAUSED"}'
```

**Note:** Budget values are in cents (5000 = $50.00).

## Insights (Performance Metrics)

```bash
# Account-level (last 30 days)
curl "https://graph.facebook.com/v25.0/act_$META_AD_ACCOUNT_ID/insights?fields=spend,impressions,clicks,reach,cpc,cpm,ctr&date_preset=last_30d" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN"

# Campaign-level with breakdowns
curl "https://graph.facebook.com/v25.0/{CAMPAIGN_ID}/insights?fields=spend,impressions,clicks,actions&breakdowns=age,gender&date_preset=last_7d" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN"

# Custom date range
curl "https://graph.facebook.com/v25.0/act_$META_AD_ACCOUNT_ID/insights?fields=spend,impressions,clicks&time_range={\"since\":\"2026-01-01\",\"until\":\"2026-01-31\"}" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN"
```

## Campaign Objectives

| Objective | Description |
|-----------|-------------|
| `OUTCOME_AWARENESS` | Brand awareness and reach |
| `OUTCOME_ENGAGEMENT` | Post engagement, page likes |
| `OUTCOME_TRAFFIC` | Drive traffic to website/app |
| `OUTCOME_LEADS` | Lead generation |
| `OUTCOME_APP_PROMOTION` | App installs |
| `OUTCOME_SALES` | Conversions and catalog sales |

## Key Metrics

| Metric | Description |
|--------|-------------|
| `spend` | Total amount spent |
| `impressions` | Times ads were shown |
| `clicks` | Clicks on ads |
| `reach` | Unique people who saw ads |
| `cpc` / `cpm` / `ctr` | Cost per click / per 1K impressions / click-through rate |
| `actions` | Conversions broken down by type |

## Attribution Windows

`1d_click`, `7d_click` (default), `28d_click`, `1d_view`

## Date Presets

`today`, `yesterday`, `last_7d`, `last_14d`, `last_30d`, `last_90d`, `this_month`, `last_month`

## Breakdowns

`age`, `gender`, `placement`, `device_platform`, `publisher_platform`, `country`

## Rate Limits

`Call Limit = 60 + (400 x Active Ads) - (0.001 x API Errors)`

Minimum 60 calls/hour. Check `X-Business-Use-Case-Usage` header.

## Token Management

System User tokens (recommended, no expiration) via Business Manager. User tokens can be extended to 60-90 days via:

```bash
curl "https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}"
```
