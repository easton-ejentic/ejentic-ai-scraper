/**
 * Brave Search API provider.
 *
 * Brave offers a monthly free quota and is a documented, stable API - much more
 * reliable than scraping. Enabled automatically when BRAVE_SEARCH_API_KEY is set.
 * Docs: https://api.search.brave.com/
 */

import type { SearchOptions, SearchProvider, SearchResult } from "../types";

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

export class BraveSearchProvider implements SearchProvider {
  readonly id = "brave";
  readonly label = "Brave Search API";

  available(): boolean {
    return Boolean(process.env.BRAVE_SEARCH_API_KEY);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY is not set");

    const limit = Math.max(1, Math.min(options.limit ?? 20, 20));
    const timeoutMs = options.timeoutMs ?? 15_000;
    const doFetch = options.fetchImpl ?? fetch;

    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(limit));
    if (options.region) url.searchParams.set("country", options.region.toUpperCase());

    const response = await doFetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Brave Search returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as BraveResponse;
    const rows = payload.web?.results ?? [];

    return rows
      .filter((row): row is BraveWebResult & { url: string } => /^https?:\/\//i.test(row.url ?? ""))
      .map((row) => ({
        title: row.title ?? "",
        url: row.url,
        snippet: row.description ?? "",
        source: "brave",
      }))
      .slice(0, limit);
  }
}
