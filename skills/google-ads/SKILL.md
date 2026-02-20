---
name: google-ads
description: Query, audit, and optimize Google Ads campaigns via API (google-ads Python SDK) or browser automation. Use when asked to check ad performance, pause campaigns/keywords, find wasted spend, audit conversion tracking, or optimize Google Ads accounts.
metadata: {"rocie":{"requires":{"bins":["python3"]}}}
---

# Google Ads Skill

Manage Google Ads accounts via API or shell commands.

## Setup Check

```bash
# Verify google-ads SDK
python3 -c "from google.ads.googleads.client import GoogleAdsClient; print('OK')"

# Check config
cat ~/.google-ads.yaml
```

## Common GAQL Queries

### Campaign Performance
```python
query = """
    SELECT campaign.name, campaign.status,
           metrics.cost_micros, metrics.conversions,
           metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC
"""
```

### Zero-Conversion Keywords (Wasted Spend)
```python
query = """
    SELECT ad_group_criterion.keyword.text,
           campaign.name, metrics.cost_micros
    FROM keyword_view
    WHERE metrics.conversions = 0
      AND metrics.cost_micros > 500000000
      AND segments.date DURING LAST_90_DAYS
    ORDER BY metrics.cost_micros DESC
"""
```

### Pause Keywords
```python
operations = []
for keyword_id in keywords_to_pause:
    operation = client.get_type("AdGroupCriterionOperation")
    operation.update.resource_name = f"customers/{customer_id}/adGroupCriteria/{ad_group_id}~{keyword_id}"
    operation.update.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
    operations.append(operation)

service.mutate_ad_group_criteria(customer_id=customer_id, operations=operations)
```

## Audit Checklist

| Check | What to Look For |
|-------|------------------|
| Zero-conv keywords | Cost > $500, Conv = 0 -> Wasted spend |
| Empty ad groups | No creative running |
| Policy violations | Yellow warning icons |
| Optimization Score | Below 70% = action needed |
| Conversion tracking | Inactive/no recent data |

## Output Format

```markdown
## Campaign Performance (Last 30 Days)
| Campaign | Cost | Conv | CPA | Status |
|----------|------|------|-----|--------|
| Branded  | $5K  | 50   | $100| Good   |
| SDK Web  | $10K | 2    | $5K | Pause  |

## Recommended Actions
1. **PAUSE**: SDK Web campaign ($5K CPA)
2. **INCREASE**: Branded budget (strong performer)
```

## Notes

- `cost_micros` = micros (divide by 1,000,000 for dollars)
- Customer ID: 10-digit, no dashes
- Developer token must be approved (not test mode)
