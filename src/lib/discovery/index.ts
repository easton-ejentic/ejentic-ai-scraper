/**
 * Discovery orchestration: description in, candidate business websites out.
 */

import { BraveSearchProvider } from "./providers/brave";
import { SerperProvider } from "./providers/serper";
import { TavilyProvider } from "./providers/tavily";
import { SearxngProvider } from "./providers/searxng";
import { DuckDuckGoProvider } from "./providers/duckduckgo";
import { BingProvider } from "./providers/bing";
import { buildQueries, hasSearchableInput } from "./query";
import { rankCandidates } from "./ranking";
import { decodeHtml } from "../scraper/parse-page";
import type {
  BusinessDescriptor,
  DiscoveryOutcome,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "./types";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ordered by reliability. Documented APIs come first because they answer the
 * query you actually asked; the scraped endpoints at the bottom can silently
 * degrade (Bing has been observed dropping query terms and answering a single
 * generic word), which is why they are last-resort only.
 *
 * Enable the paid-keyed ones by setting the matching environment variable:
 *   BRAVE_SEARCH_API_KEY  - https://brave.com/search/api/   (free tier)
 *   SERPER_API_KEY        - https://serper.dev               (free tier)
 *   TAVILY_API_KEY        - https://tavily.com               (free tier)
 *   SEARXNG_URL           - self-hosted, unlimited and free
 */
const providers: SearchProvider[] = [
  new BraveSearchProvider(),
  new SerperProvider(),
  new TavilyProvider(),
  new SearxngProvider(),
  new DuckDuckGoProvider(),
  new BingProvider(),
];

/** Every provider that can run with the current configuration, in order. */
export function getSearchProviders(): SearchProvider[] {
  return providers.filter((provider) => provider.available());
}

/**
 * Preferred provider. Used only for reporting which engine is in use -
 * `discoverBusinessUrls` fails over through the whole list at query time.
 */
export function getSearchProvider(): SearchProvider | null {
  return getSearchProviders()[0] ?? null;
}

export function providerStatus(): {
  provider: string | null;
  label: string;
  configured: boolean;
  note: string;
} {
  const available = getSearchProviders();
  const provider = available[0];
  if (!provider) {
    return {
      provider: null,
      label: "None",
      configured: false,
      note: "No search provider is available.",
    };
  }
  const fallbacks = available.slice(1).map((entry) => entry.id);
  const isScraper = provider.id === "duckduckgo" || provider.id === "bing";

  return {
    provider: provider.id,
    label: provider.label,
    configured: true,
    note: [
      `Using ${provider.label}.`,
      fallbacks.length ? `Automatic failover to ${fallbacks.join(", ")}.` : null,
      isScraper
        ? "Scraped search engines get rate-limited or silently degrade - set BRAVE_SEARCH_API_KEY (free tier) for reliable results."
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Full inventory of search providers with their current availability.
 *
 * Shown on Settings so an operator can see, at a glance, which engine is
 * actually in use and exactly which environment variable would enable a
 * better one. Deliberately read-only and side-effect free - it never calls out.
 */
export function configuredSearchProviders(): {
  id: string;
  label: string;
  available: boolean;
  envVar: string;
}[] {
  const envVarFor: Record<string, string> = {
    brave: "BRAVE_SEARCH_API_KEY",
    serper: "SERPER_API_KEY",
    tavily: "TAVILY_API_KEY",
    searxng: "SEARXNG_URL",
    duckduckgo: "(no key needed)",
    bing: "(no key needed)",
  };

  return providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    available: provider.available(),
    envVar: envVarFor[provider.id] ?? "",
  }));
}

export interface DiscoverOptions extends SearchOptions {
  /** Maximum candidate websites to return. */
  maxUrls?: number;
  /** Keep directory/listing domains instead of filtering them out. */
  includeDirectories?: boolean;
}

/**
 * Search the open web for businesses matching a description and return the
 * candidate websites to crawl.
 *
 * Returns an empty list (with `error` set) when nothing can be searched -
 * it never substitutes invented or sample data.
 */
export async function discoverBusinessUrls(
  descriptor: BusinessDescriptor,
  options: DiscoverOptions = {},
): Promise<DiscoveryOutcome> {
  const queries = buildQueries(descriptor);

  if (!hasSearchableInput(descriptor) || !queries.length) {
    return {
      queries: [],
      results: [],
      candidates: [],
      urls: [],
      provider: null,
      error: "Enter a business name, niche, category or location to search for.",
    };
  }

  const available = getSearchProviders();
  if (!available.length) {
    return {
      queries,
      results: [],
      candidates: [],
      urls: [],
      provider: null,
      error: "No search provider is configured.",
    };
  }

  const collected: SearchResult[] = [];
  const failures: string[] = [];
  const used = new Set<string>();

  for (const [index, query] of queries.entries()) {
    // Be a polite API consumer: pace consecutive queries.
    if (index > 0) await sleep(350);

    // Fail over between engines. Scraped endpoints get blocked unpredictably,
    // so one query may work on Bing while the next only works on DuckDuckGo.
    let answered = false;
    for (const provider of available) {
      try {
        const results = await provider.search(query, options);
        if (!results.length) continue;
        // Search engines hand back HTML-encoded titles and snippets ("Manchester
        // &#x27;s top-rated..."). Decode once here so every consumer - the job
        // wizard preview, the public explorer, stored company names - sees text.
        collected.push(
          ...results.map((result) => ({
            ...result,
            title: decodeHtml(result.title),
            snippet: decodeHtml(result.snippet),
          })),
        );
        used.add(provider.id);
        answered = true;
        break;
      } catch (error) {
        failures.push(
          `${provider.id} / "${query}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!answered && !failures.length) {
      failures.push(`"${query}": no results from any provider`);
    }
  }

  if (!collected.length) {
    return {
      queries,
      results: [],
      candidates: [],
      urls: [],
      provider: [...used][0] ?? null,
      error: failures.length
        ? `Search failed. ${failures[0]}`
        : "The search returned no results for this description.",
    };
  }

  // Every dimension the operator filled in must be reflected in the result.
  // We deliberately do NOT fall back to looser matching: when a scraped engine
  // degrades it answers a simpler query, and loosening would hand back websites
  // that were never asked for. Zero honest results beats confident nonsense.
  const candidates = rankCandidates(collected, descriptor, {
    includeDirectories: options.includeDirectories,
    relevance: "all",
  });

  const maxUrls = Math.max(1, options.maxUrls ?? 25);
  const urls = candidates.slice(0, maxUrls).map((candidate) => candidate.url);

  return {
    queries,
    results: collected,
    candidates,
    urls,
    provider: [...used][0] ?? null,
    ...(urls.length === 0
      ? {
          error: `The search returned ${collected.length} result${collected.length === 1 ? "" : "s"}, but none of them matched everything you entered. Try fewer or broader terms.`,
        }
      : {}),
  };
}

/** Human label for a provider id, for displaying which engine actually ran. */
export function labelForProvider(id: string | null): string {
  if (!id) return "None";
  return providers.find((provider) => provider.id === id)?.label ?? id;
}

export { buildQueries, describeSearch, hasSearchableInput } from "./query";
export { classifyResult, isBusinessLike, registrableDomain, rankCandidates } from "./ranking";
export type {
  BusinessDescriptor,
  DiscoveryCandidate,
  DiscoveryOutcome,
  SearchResult,
} from "./types";
