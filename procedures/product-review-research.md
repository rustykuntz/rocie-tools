# product-review-research
Gather trusted public reviews and opinions about a product, service, or topic from social media destinations.

## when-to-use
- User asks what people think, whether something is worth it, whats better A or B?, or wants "best of" comparisons.

## dependencies
- skills: serper-web-search, agent-browser
- credentials: credentials_tools.serper_api_key

## steps
1. Check Serper key via `get_config credentials_tools.serper_api_key`. If missing, follow credential setup in serper-web-search SKILL.md.
2. Create 3–5 queries targeting review sources (`site:reddit.com`, `site:youtube.com`, `reviews`, `vs`, `worth it`). Use `tbs=qdr:y` for last year.
3. Run queries and collect snippets.
4. If snippets answer the question, respond directly with sources.
5. If not enough signal, open best pages with agent-browser.

## notes
- Default to last-year recency (`tbs=qdr:y`) — older reviews often miss updates, firmware changes, or new models.
- Reddit, YouTube comments, and forum threads are highest-signal for real opinions.
