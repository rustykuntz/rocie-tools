# price-comparison
Compare prices for a specific product across sellers using Serper search snippets, localized to the user's country, language and currency.

## when-to-use
- User asks to compare prices, find the cheapest option, or check how much something costs.
- User asks "how much is X" or "where can I buy X cheapest".

## dependencies
- skills: serper-web-search
- credentials: credentials_tools.serper_api_key

## steps
1. Check Serper key via `get_config credentials_tools.serper_api_key`. If missing, follow credential setup in serper-web-search SKILL.md.
2. Identify from the request: product name (with specs like storage/color/variant), target country, and local currency symbol.
   - If country is ambiguous, ask the user.
   - Map country to its `gl` code, currency symbol, and local-language price keyword. Reference table:

   | Country | `gl` | Currency | Local price keyword | Example query |
   |---------|------|----------|---------------------|---------------|
   | Thailand | `th` | `฿` | `ราคา` | `"iphone 17 256gb price ฿"` |
   | Israel | `il` | `₪` | `מחיר` | `"iphone 17 256gb price ₪"` |
   | Japan | `jp` | `¥` | `価格` | `"iphone 17 256gb price ¥"` |
   | South Korea | `kr` | `₩` | `가격` | `"galaxy s26 price ₩"` |
   | India | `in` | `₹` | `कीमत` | `"iphone 17 256gb price ₹"` |
   | UK | `uk` | `£` | — | `"iphone 17 256gb price £"` |
   | EU (Germany) | `de` | `€` | `Preis` | `"iphone 17 256gb price €"` |
   | US | `us` | `$` | — | `"iphone 17 256gb price $"` |

   For countries not in the table, derive the `gl` code (ISO 3166-1 alpha-2), the local currency symbol, and the word for "price" in the local language. English-primary countries (US, UK, AU) don't need a local-language query.

3. Run 2–3 Serper `/search` queries with `tbs=qdr:m` (last month) and the correct `gl`. Always run both an English query and a local-language query (unless the country is English-primary):
   - Query 1: `"<product> <specs> price <currency_symbol>"` — English with currency symbol, `gl` ensures local results surface.
   - Query 2: `"<product> <specs> <local_price_keyword> <currency_symbol>"` — local-language query (e.g. `"iphone 17 256gb מחיר ₪"` for Israel, `"iphone 17 256gb ราคา ฿"` for Thailand).
   - Query 3 (optional): `"<product> <specs> buy <currency_symbol>"` — catches e-commerce listings not using the word "price".
4. Extract pricing data from snippets only — do not open browser. Parse: seller/source name, price, condition (new/used/refurbished), and any notable terms (installment, warranty).
5. Build a comparison table sorted by price ascending. Include columns: Source, Price, Condition, Notes.
6. Summarize: lowest price, official retail price if found, and price range.

## fallbacks
- step 3: if results are sparse, drop `tbs=qdr:m` and retry without recency filter.
- step 3: if no local-currency results, try `/shopping` endpoint which returns structured price data.
- step 4: if snippets don't contain clear prices, note which sources to check manually and provide links.

## notes
- Snippets usually contain enough pricing data — browser is rarely needed for price comparison.
- Always include the currency symbol in the query; it forces Google to surface price-containing pages.
- Social marketplace results (Facebook, Instagram, Threads) often show used/secondhand prices — always flag the condition.
- Installment prices (e.g. "ผ่อน 2,400/เดือน") are not the full price — extract the cash/full price when both are shown.
