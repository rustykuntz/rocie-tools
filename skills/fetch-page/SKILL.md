---
name: fetch-page
description: Fetch a web page and return clean text content. Fast, lightweight HTTP fetch with no browser engine. Use this FIRST before agent-browser — it's faster and cheaper. Falls back with a clear message when the page requires JavaScript rendering.
metadata:
  dependencies:
    node:
      description: Node.js runtime (v18+ for native fetch)
      check: "node --version"
      install: "brew install node"
---

# Fetch Page

Lightweight page reader that fetches a URL via HTTP and returns **clean text only** (no HTML tags, no scripts, no nav/footer junk). Uses real Chrome 144 macOS headers to look like a genuine browser request.

**Use this skill first** when you need to read a web page. It's fast and has zero dependencies. If it fails, it will tell you to use `agent-browser` instead.

## Command

```bash
node fetch_page.mjs --url <url>
```

## What it returns

### On success (exit code 0) → stdout

Clean text content of the page. HTML is stripped, navigation/footer/sidebar junk is removed, only readable content remains.

### On failure (exit code 1) → stderr

One of these error messages followed by: `fetch-page cannot retrieve this page content, use agent-browser skill`

- **Network errors**: `ERROR ENOTFOUND`, `ERROR ETIMEDOUT`, `ERROR UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, etc.
- **HTTP errors**: `ERROR 403`, `ERROR 404`, `ERROR 500`, etc.
- **JS-rendered pages**: When the page returns valid HTML but the content is rendered client-side (React, Vue, SPA apps), the extracted text will be too short and the tool exits with the fallback message.

## When to use this vs agent-browser

| Scenario | Use |
|---|---|
| Documentation, blogs, articles, wikis, static sites | **fetch-page** |
| Pages behind login, JS-rendered SPAs, dynamic content | **agent-browser** |
| You don't know yet | **Try fetch-page first**, fall back to agent-browser if it fails |

## Examples

```bash
# Read a documentation page
node fetch_page.mjs --url https://docs.python.org/3/tutorial/classes.html

# Read a blog post
node fetch_page.mjs --url https://example.com/blog/my-post
```
