# local-business-scrape
List local businesses or places in an area and export to CSV.

## when-to-use
- User wants a detailed bulk list of local businesses, places, or services in a specific location (e.g., "international kindergartens in Bangkok").

## dependencies
- skills: serper-web-search
- credentials: credentials_tools.serper_api_key

## steps
1. Parse business type and location from the request. If the area is too broad (country/continent), ask the user to narrow down.
2. Validate location against Serper's supported locations (`https://api.serper.dev/locations`).
3. Query Serper `/places` with business type as `q` and matched `location`. Paginate until target count or exhaustion.
4. Extract: position, title, address, latitude, longitude, rating, ratingCount, category, phoneNumber, website, cid.
5. Write to CSV and confirm file path + record count.

## fallbacks
- If Serper key missing: follow credential setup in serper-web-search SKILL.md.
- step 2: if location doesn't match, tell user and ask for alternative.
- step 3: if results empty, broaden query (drop adjectives) and retry once.
- step 3: if pagination runs out before target, write what's available and inform user.

## notes
- Serper `/places` requires exact location strings from their supported list.
- Sanitize commas/quotes in business names and addresses before writing CSV.
