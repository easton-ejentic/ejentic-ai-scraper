/**
 * SearXNG - a self-hosted metasearch engine.
 *
 * Best long-term option when you want unlimited free searching: point
 * SEARXNG_URL at your own instance (https://docs.searxng.org). Public
 * instances exist but most disable the JSON API or rate-limit aggressively,
 * so self-hosting is what actually works.
 *
 * Enable with:
 *   SEARXNG_URL=https://searx.example.com
 *   SEARXNG_API_KEY=...   (only if your instance requires one)
 */

import type { SearchOptions, SearchProvider, SearchResult } from "../types";

interface SearxngResponse {
  results?: { title?: string; url?: string; content?: string }[];
}

export class SearxngProvider implements SearchProvider {
  readonly id = "searxng";
  readonly label = "SearXNG";

  available(): boolean {
    return Boolean(process.env.SEARXNG_URL);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const base = process.env.SEARXNG_URL;
    if (!base) throw new Error("SEARXNG_URL is not set");

    const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
    const timeoutMs = options.timeoutMs ?? 20_000;
    const doFetch = options.fetchImpl ?? fetch;

    const url = new URL("/search", base.replace(/\/+$/, ""));
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", options.region ?? "en");

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.SEARXNG_API_KEY) {
      headers.Authorization = `Bearer ${process.env.SEARXNG_API_KEY}`;
    }

    const response = await doFetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as SearxngResponse;

    return (payload.results ?? [])
      .filter((row): row is { title?: string; url: string; content?: string } =>
        /^https?:\/\//i.test(row.url ?? ""),
      )
      .map((row) => ({
        title: row.title ?? "",
        url: row.url,
        snippet: row.content ?? "",
        source: "searxng",
      }))
      .slice(0, limit);
  }
}
