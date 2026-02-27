---
name: hubspot
description: Manage HubSpot contacts, companies, deals, and content. Use for "add a contact", "update the deal stage", or "pull company info from HubSpot".
metadata:
  homepage: https://developers.hubspot.com/
---

# HubSpot Skill

Interact with HubSpot CRM and CMS via the REST API.

## Setup

Set your HubSpot Private App access token:
```
HUBSPOT_ACCESS_TOKEN=pat-na2-xxxxx
```

## API Base

All endpoints use: `https://api.hubapi.com`

Authorization header: `Bearer $HUBSPOT_ACCESS_TOKEN`

---

## CRM Objects

### Contacts

**Create contact:**
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"email":"test@example.com","firstname":"Test","lastname":"User","phone":"555-1234","company":"Acme Inc","jobtitle":"Manager"}}' \
  "https://api.hubapi.com/crm/v3/objects/contacts" | jq
```

**List contacts:**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=10" | jq
```

**Search contacts:**
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filterGroups":[{"filters":[{"propertyName":"email","operator":"CONTAINS_TOKEN","value":"example.com"}]}],"limit":10}' \
  "https://api.hubapi.com/crm/v3/objects/contacts/search" | jq
```

**Get contact by ID:**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/contacts/{contactId}?properties=email,firstname,lastname,phone,company" | jq
```

**Get contact by email:**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/contacts/{email}?idProperty=email" | jq
```

### Companies

**List companies:**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/companies?limit=10&properties=name,domain,industry" | jq
```

**Search companies:**
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filterGroups":[{"filters":[{"propertyName":"name","operator":"CONTAINS_TOKEN","value":"acme"}]}],"limit":10}' \
  "https://api.hubapi.com/crm/v3/objects/companies/search" | jq
```

### Deals

**Create deal:**
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"dealname":"New Deal","amount":"10000","closedate":"2026-06-01","description":"Deal notes here"}}' \
  "https://api.hubapi.com/crm/v3/objects/deals" | jq
```

**List deals:**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/deals?limit=10&properties=dealname,amount,dealstage,closedate" | jq
```

**Search deals:**
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filterGroups":[{"filters":[{"propertyName":"dealstage","operator":"EQ","value":"closedwon"}]}],"limit":10}' \
  "https://api.hubapi.com/crm/v3/objects/deals/search" | jq
```

### Owners

**List owners (users):**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/owners" | jq
```

---

## Associations

**Get associated contacts for a company:**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v4/objects/companies/{companyId}/associations/contacts" | jq
```

**Get associated deals for a contact:**
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v4/objects/contacts/{contactId}/associations/deals" | jq
```

**Create association (deal to contact):**
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs":[{"from":{"id":"{dealId}"},"to":{"id":"{contactId}"},"types":[{"associationCategory":"HUBSPOT_DEFINED","associationTypeId":3}]}]}' \
  "https://api.hubapi.com/crm/v4/associations/deals/contacts/batch/create" | jq
```

Common association type IDs:
- 3: Deal to Contact
- 5: Deal to Company
- 1: Contact to Company

---

## Properties (Schema)

```bash
# List contact/company/deal properties
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/properties/contacts" | jq '.results[].name'
```

---

## Search Operators

| Operator | Description |
|----------|-------------|
| `EQ` | Equal to |
| `NEQ` | Not equal to |
| `LT` / `LTE` | Less than / or equal |
| `GT` / `GTE` | Greater than / or equal |
| `CONTAINS_TOKEN` | Contains word |
| `HAS_PROPERTY` | Has a value |
| `NOT_HAS_PROPERTY` | Does not have a value |

## Notes

- Rate limits: 100 requests per 10 seconds for private apps
- Pagination: Use `after` parameter from `paging.next.after`
