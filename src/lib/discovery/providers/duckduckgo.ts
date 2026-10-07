/**
 * DuckDuckGo HTML provider - works with no API key.
 *
 * Uses the public `html.duckduckgo.com/html/?q=` endpoint and parses the
 * result markup. This is page scraping, so it is more fragile than a paid API:
 * if DuckDuckGo changes its markup or serves a challenge page, this simply
 * returns zero results rather than inventing any.
 *
 * Prefer setting BRAVE_SEARCH_API_KEY for anything you depend on.
 */

import type { SearchOptions, SearchProvider, SearchResult } from "../types";

const ENDPOINT = "https://html.duckduckgo.com/html/";

// A browser-like agent is required; the endpoint rejects obvious bots.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const LINK_PATTERN = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const SNIPPET_PATTERN = /<a[^>]+class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * DuckDuckGo wraps every outbound link as
 * //duckduckgo.com/l/?uddg=<url-encoded target>&rut=...
 * so the real destination has to be pulled out of the `uddg` parameter.
 */
export function extractTargetUrl(href: string): string | null {
  try {
    const normalised = decodeEntities(href);
    const absolute = normalised.startsWith("//") ? `https:${normalised}` : normalised;
    const url = new URL(absolute, "https://duckduckgo.com");
    const target = url.searchParams.get("uddg");
    if (target) {
      const decoded = decodeURIComponent(target);
      return /^https?:\/\//i.test(decoded) ? decoded : null;
    }
    // Some responses link straight to the destination.
    if (/^https?:\/\//i.test(url.toString()) && !url.hostname.endsWith("duckduckgo.com")) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a DuckDuckGo HTML response into results.
 * Exported separately so it can be unit tested against a saved fixture.
 */
export function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const snippets: string[] = [];
  SNIPPET_PATTERN.lastIndex = 0;
  let snippetMatch: RegExpExecArray | null;
  while ((snippetMatch = SNIPPET_PATTERN.exec(html)) !== null) {
    snippets.push(stripTags(snippetMatch[1]));
  }

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = LINK_PATTERN.exec(html)) !== null) {
    const target = extractTargetUrl(match[1]);
    if (!target || seen.has(target)) continue;
    seen.add(target);

    results.push({
      title: stripTags(match[2]),
      url: target,
      snippet: snippets[index] ?? "",
      source: "duckduckgo",
    });
    index += 1;
  }

  return results;
}

export class DuckDuckGoProvider implements SearchProvider {
  readonly id = "duckduckgo";
  readonly label = "DuckDuckGo (no API key required)";

  available(): boolean {
    return true;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
    const timeoutMs = options.timeoutMs ?? 15_000;
    const doFetch = options.fetchImpl ?? fetch;

    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    if (options.region) url.searchParams.set("kl", options.region);

    const response = await doFetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
    }

    const html = await response.text();

    // DuckDuckGo answers repeated automated requests with an HTTP 202 holding a
    // challenge page rather than results. Reporting that clearly beats silently
    // returning zero and looking like "no businesses exist".
    if (response.status === 202 || isChallengePage(html)) {
      throw new Error("DuckDuckGo is rate-limiting this server (bot challenge)");
    }

    return parseDuckDuckGoHtml(html).slice(0, limit);
  }
}

/** Detects the anti-bot interstitial DuckDuckGo serves instead of results. */
export function isChallengePage(html: string): boolean {
  return /anomaly[-_ ]?modal|challenge[-_ ]?form|captcha|bots are not permitted|If this error persists, please let us know/i.test(
    html,
  );
}
