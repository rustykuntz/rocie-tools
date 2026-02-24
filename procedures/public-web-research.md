# public-web-research
Search and research anything on the web.

## when-to-use
- User asks to research, compare, or find information available on the public web.
- User asks a question that needs up-to-date web data beyond my knowledge.

## dependencies
- skills: serper-web-search, agent-browser
- credentials: credentials_tools.serper_api_key

## steps
1. Check Serper key via `get_config credentials_tools.serper_api_key`. If missing, follow credential setup in serper-web-search SKILL.md.
2. Generate 2–5 focused search queries covering different angles.
3. Run queries via Serper — pick the right endpoint (`/search`, `/news`, `/shopping`, `/images`) and tune `tbs`, `gl`, `hl`.
4. Review results. If titles, snippets, and metadata already answer the question — respond directly.
5. Only open browser for pages that need full content, interaction, or verification.

## notes
- Serper is fast (<1s) and cheap (1 credit/query). Always prefer it over browser-based Google scraping.
- `/shopping` returns structured price comparisons — often enough without opening any page.
