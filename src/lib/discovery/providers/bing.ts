/**
 * Bing HTML provider - no API key required.
 *
 * Scrapes `www.bing.com/search?q=`. Bing tolerates far more automated traffic
 * than DuckDuckGo's HTML endpoint, so this is the reliable zero-configuration
 * fallback. Like every scrape-based provider it is fragile: if Bing changes its
 * markup or serves a challenge, this returns zero results rather than guessing.
 *
 * Prefer setting BRAVE_SEARCH_API_KEY for anything you depend on.
 */

import type { SearchOptions, SearchProvider, SearchResult } from "../types";

const ENDPOINT = "https://www.bing.com/search";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Split the results list into per-result chunks. */
const BLOCK_PATTERN = /<li class="b_algo"[\s\S]*?(?=<li class="b_algo"|<\/ol>)/gi;
const LINK_PATTERN = /<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
const SNIPPET_PATTERN = /<p class="b_(?:lineclamp\d|paractl|snip)"[^>]*>([\s\S]*?)<\/p>/i;
const CAPTION_PATTERN = /<div class="b_caption"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i;

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bing wraps outbound links as /ck/a?...&u=a1<base64url-of-destination>.
 * The "a1" prefix is a marker and must be stripped before decoding.
 */
export function extractTargetUrl(href: string): string | null {
  try {
    const url = new URL(href.replace(/&amp;/gi, "&"), "https://www.bing.com");
    const encoded = url.searchParams.get("u");
    if (encoded) {
      const payload = encoded.replace(/^a1/, "");
      const decoded = Buffer.from(payload, "base64url").toString("utf8");
      return /^https?:\/\//i.test(decoded) ? decoded : null;
    }
    // Some results link straight to the destination.
    if (/^https?:\/\//i.test(url.href) && !url.hostname.endsWith("bing.com")) {
      return url.href;
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse a Bing results page. Exported so it can be tested against a fixture. */
export function parseBingHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  BLOCK_PATTERN.lastIndex = 0;
  let block: RegExpExecArray | null;

  while ((block = BLOCK_PATTERN.exec(html)) !== null) {
    const chunk = block[0];
    const link = LINK_PATTERN.exec(chunk);
    if (!link) continue;

    const target = extractTargetUrl(link[1]);
    if (!target || seen.has(target)) continue;
    seen.add(target);

    const snippetMatch = SNIPPET_PATTERN.exec(chunk) ?? CAPTION_PATTERN.exec(chunk);

    results.push({
      title: stripTags(link[2]),
      url: target,
      snippet: snippetMatch ? stripTags(snippetMatch[1]) : "",
      source: "bing",
    });
  }

  return results;
}

export class BingProvider implements SearchProvider {
  readonly id = "bing";
  readonly label = "Bing (no API key required)";

  available(): boolean {
    return true;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
    const timeoutMs = options.timeoutMs ?? 15_000;
    const doFetch = options.fetchImpl ?? fetch;

    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(limit));
    if (options.region) url.searchParams.set("cc", options.region.toUpperCase());

    const response = await doFetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Bing returned HTTP ${response.status}`);
    }

    const html = await response.text();

    if (isChallengePage(html)) {
      throw new Error("Bing served a bot challenge instead of results");
    }

    return parseBingHtml(html).slice(0, limit);
  }
}

/** Detects the interstitial Bing shows instead of results. */
export function isChallengePage(html: string): boolean {
  return (
    /<title>\s*(Verify|captcha|Are you human)/i.test(html) ||
    /unusual traffic from your/i.test(html)
  );
}
