/**
 * Serper (serper.dev) - Google results over a documented API.
 *
 * Free tier is generous enough for lead discovery. Enabled automatically when
 * SERPER_API_KEY is set.
 */

import type { SearchOptions, SearchProvider, SearchResult } from "../types";

const ENDPOINT = "https://google.serper.dev/search";

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganic[];
}

export class SerperProvider implements SearchProvider {
  readonly id = "serper";
  readonly label = "Serper (Google)";

  available(): boolean {
    return Boolean(process.env.SERPER_API_KEY);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error("SERPER_API_KEY is not set");

    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const timeoutMs = options.timeoutMs ?? 15_000;
    const doFetch = options.fetchImpl ?? fetch;

    const response = await doFetch(ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: limit, gl: options.region ?? "us" }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Serper returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as SerperResponse;

    return (payload.organic ?? [])
      .filter((row): row is SerperOrganic & { link: string } =>
        /^https?:\/\//i.test(row.link ?? ""),
      )
      .map((row) => ({
        title: row.title ?? "",
        url: row.link,
        snippet: row.snippet ?? "",
        source: "serper",
      }))
      .slice(0, limit);
  }
}
