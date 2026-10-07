/**
 * Tavily - a search API built for agents.
 *
 * Enabled automatically when TAVILY_API_KEY is set. Its results include a
 * relevance score, which we carry through as the snippet source.
 */

import type { SearchOptions, SearchProvider, SearchResult } from "../types";

const ENDPOINT = "https://api.tavily.com/search";

interface TavilyResponse {
  results?: { title?: string; url?: string; content?: string }[];
}

export class TavilyProvider implements SearchProvider {
  readonly id = "tavily";
  readonly label = "Tavily";

  available(): boolean {
    return Boolean(process.env.TAVILY_API_KEY);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

    const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
    const timeoutMs = options.timeoutMs ?? 20_000;
    const doFetch = options.fetchImpl ?? fetch;

    const response = await doFetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: limit,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Tavily returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as TavilyResponse;

    return (payload.results ?? [])
      .filter((row): row is { title?: string; url: string; content?: string } =>
        /^https?:\/\//i.test(row.url ?? ""),
      )
      .map((row) => ({
        title: row.title ?? "",
        url: row.url,
        snippet: row.content ?? "",
        source: "tavily",
      }))
      .slice(0, limit);
  }
}
