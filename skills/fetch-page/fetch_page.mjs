#!/usr/bin/env node

process.removeAllListeners('warning');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string', short: 'u' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || !values.url) {
  console.log(`Usage: fetch_page.mjs --url <url>

Fetches a URL with browser-like headers.
Returns the page content on success, or just the error code on failure.

Options:
  --url,  -u  URL to fetch
  --help, -h  Show this help`);
  process.exit(values.help ? 0 : 1);
}

let resp;
try {
  resp = await fetch(values.url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
      'Sec-CH-UA': '"Google Chrome";v="144", "Chromium";v="144", "Not_A Brand";v="24"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });
} catch (err) {
  console.error(`ERROR ${err.cause?.code || err.message}\nfetch-page cannot retrieve this page content, use agent-browser skill`);
  process.exit(1);
}

if (!resp.ok) {
  console.error(`ERROR ${resp.status}\nfetch-page cannot retrieve this page content, use agent-browser skill`);
  process.exit(1);
}

const html = await resp.text();

const text = html
  .replace(/<(script|style|nav|header|footer|aside|noscript)[\s\S]*?<\/\1>/gi, '')
  .replace(/<(br|hr)\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#0?39;/gi, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/\|/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .split('\n')
  .filter(line => line.trim().length === 0 || line.trim().length >= 10 || line.trim().includes(' '))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

if (text.length < 200) {
  console.error(`${text ? text + '\n' : ''}fetch-page cannot retrieve this page content, use agent-browser skill`);
  process.exit(1);
}

console.log(text);
