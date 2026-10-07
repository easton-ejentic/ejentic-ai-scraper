/**
 * Search-driven discovery.
 *
 * The crawler can only read pages it is given. This module is what turns a
 * human description ("emergency plumbers in Manchester", "Northwind Logistics")
 * into a list of real candidate websites found on the open web.
 *
 * Design rules:
 *  - Providers return ONLY results the search engine actually returned. If a
 *    provider fails or finds nothing, it reports zero results. Nothing here is
 *    synthesised, guessed or filled in from a canned list.
 *  - Provider selection is explicit and inspectable (`providerStatus()`), so an
 *    operator can see which engine is in use and why.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Which engine produced this row. */
  source: string;
}

export interface SearchOptions {
  /** Max results to request from the engine. */
  limit?: number;
  /** Hard timeout for the network call, milliseconds. */
  timeoutMs?: number;
  /** Country/region code passed to engines that support it, e.g. "uk". */
  region?: string;
  /** Injected for tests so no real network call is made. */
  fetchImpl?: typeof fetch;
}

export interface SearchProvider {
  /** Stable identifier, e.g. "duckduckgo" or "brave". */
  readonly id: string;
  /** Human label for the UI. */
  readonly label: string;
  /** True when this provider can run with the current configuration. */
  available(): boolean;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

/** What the user typed in, before we turn it into search-engine queries. */
export interface BusinessDescriptor {
  /** A specific company name, if they know it. */
  name?: string;
  /** What they do - "emergency plumbing", "commercial cleaning". */
  niche?: string;
  /** Broad trade/category - "plumber", "accountant", "solicitor". */
  category?: string;
  /** Where - "Manchester", "Leeds, UK". */
  location?: string;
  /** Optional extra words to narrow results. */
  keywords?: string[];
}

/** A scored, de-duplicated candidate website ready to be crawled. */
export interface DiscoveryCandidate extends SearchResult {
  domain: string;
  /** business-site | directory | review-site | social | reference | news */
  kind: string;
  score: number;
}

/** Outcome of a discovery run, including why it may have found nothing. */
export interface DiscoveryOutcome {
  queries: string[];
  results: SearchResult[];
  /** Ranked candidates - this is what the crawler will be seeded with. */
  candidates: DiscoveryCandidate[];
  urls: string[];
  provider: string | null;
  /** Set when no provider could run or every query failed. */
  error?: string;
  /** Set when results only loosely match the description. */
  warning?: string;
}
