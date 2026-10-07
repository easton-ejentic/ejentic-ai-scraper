/**
 * Classify and rank raw search results.
 *
 * A search for "plumbers in Manchester" mostly returns directories, review sites
 * and aggregators. Those are not leads - crawling them produces thousands of
 * companies we did not ask for and buries the actual businesses. So we label
 * every result and, by default, keep only plausible business websites.
 *
 * The classifier is heuristic and transparent: it is pattern matching on the
 * hostname, not a guess about what a company does.
 */

import type { BusinessDescriptor, DiscoveryCandidate, SearchResult } from "./types";

export type CandidateKind =
  | "business-site"
  | "directory"
  | "review-site"
  | "social"
  | "reference"
  | "news"
  | "unknown";

/** Host substrings that are listings, not businesses. */
const DIRECTORY_HOSTS = [
  "checkatrade",
  "yelp",
  "yellowpages",
  "thomsonlocal",
  "trustatrader",
  "mybuilder",
  "ratedpeople",
  "bark.com",
  "angieslist",
  "houzz",
  "manta.com",
  "dnb.com",
  "crunchbase",
  "zoominfo",
  "apollo.io",
  "kompass",
  "hotfrog",
  "cylex",
  "opendi",
  "yell.com",
  "scoot.co.uk",
  "freeindex",
  "netmums",
  "which.co.uk",
  "trustpilot",
  "tripadvisor",
  "foursquare",
  "bbb.org",
  "chamberofcommerce",
  "companieshouse",
  "endole",
  "bizapedia",
  "owler",
];

const SOCIAL_HOSTS = [
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "pinterest.com",
  "nextdoor.com",
];

const REFERENCE_HOSTS = [
  "wikipedia.org",
  "wikidata.org",
  "britannica.com",
  "quora.com",
  "reddit.com",
  "answers.com",
  // Dictionaries and explainers - these surface when an engine drops part of
  // the query and searches a single generic word instead.
  "merriam-webster.com",
  "dictionary.cambridge.org",
  "dictionary.com",
  "collinsdictionary.com",
  "wiktionary.org",
  "thesaurus.com",
  "vocabulary.com",
  "lexico.com",
  "investopedia.com",
  "imdb.com",
  "urbandictionary.com",
];

const NEWS_HOSTS = [
  "bbc.co.uk",
  "bbc.com",
  "theguardian.com",
  "dailymail.co.uk",
  "mirror.co.uk",
  "independent.co.uk",
  "telegraph.co.uk",
];

/** Common two-part public suffixes needing three labels to reach the domain. */
const MULTI_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "me.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "co.za",
  "com.mx",
  "co.in",
  "com.sg",
  "com.hk",
]);

export function registrableDomain(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const labels = host.split(".");
    const lastTwo = labels.slice(-2).join(".");
    if (MULTI_PART_TLDS.has(lastTwo) && labels.length >= 3) {
      return labels.slice(-3).join(".");
    }
    return lastTwo;
  } catch {
    return "";
  }
}

/**
 * Titles of comparison/listicle pages. Known directory domains are caught by
 * hostname, but new directories appear constantly, and pages like
 * "140 Dentists in Bristol - Compare Prices & Reviews" are listings rather
 * than a practice's own site.
 */
const LISTICLE_TITLE =
  /(?:^\d+[\d,]*\+?\s+\w|\btop\s+\d+|\bbest\s+\d+|\bcompare\s+prices?\b|\blist of\b|\b\d+\s+(?:best|top)\b|\b\d{2,}[\d,]*\+?\s+(?:\w+\s+)?(?:practices?|firms?|companies|clinics?|providers?|agencies|results?|listings?|reviews?|dentists?|plumbers?|electricians?|solicitors?)\b)/i;

export function classifyResult(url: string, title?: string): CandidateKind {
  const host = registrableDomain(url);
  if (!host) return "unknown";
  if (DIRECTORY_HOSTS.some((entry) => host.includes(entry))) return "directory";
  if (SOCIAL_HOSTS.some((entry) => host.includes(entry))) return "social";
  if (REFERENCE_HOSTS.some((entry) => host.includes(entry))) return "reference";
  if (NEWS_HOSTS.some((entry) => host.includes(entry))) return "news";
  if (title && LISTICLE_TITLE.test(title)) return "directory";
  return "business-site";
}

/** Directories and social profiles are listings, not the business itself. */
export function isBusinessLike(url: string): boolean {
  return classifyResult(url) === "business-site";
}

function tokenise(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/**
 * Crude stem: "plumbing" and "plumbers" should match each other. Taking a
 * fixed prefix is enough for trade names and avoids shipping a stemmer.
 */
function stem(token: string): string {
  return token.slice(0, Math.min(5, token.length));
}

/**
 * Relevance gate.
 *
 * Scraped engines sometimes degrade and answer a simpler query than the one
 * asked - Bing answered "emergency plumbing Manchester" with dictionary
 * definitions of "emergency", and "accountant Leeds" with French job ads. That
 * is worse than no results, because it quietly crawls the wrong websites.
 *
 * We compare against three independent dimensions - the business name, what it
 * does, and where it is - and can require either every supplied dimension to
 * match ("all") or just one ("any").
 */
export type RelevanceMode = "all" | "any" | "none";

function matchesDimension(
  haystack: string,
  value: string | undefined,
  useStem: boolean,
): boolean {
  const tokens = tokenise(value ?? "");
  // A dimension the operator left blank cannot be used to reject a result.
  if (!tokens.length) return true;
  return tokens.some((token) =>
    haystack.includes(useStem ? stem(token) : token),
  );
}

export function isRelevant(
  result: SearchResult,
  descriptor: BusinessDescriptor,
  mode: RelevanceMode = "any",
): boolean {
  if (mode === "none") return true;

  const haystack = `${result.url} ${result.title} ${result.snippet}`.toLowerCase();
  const trade = `${descriptor.niche ?? ""} ${descriptor.category ?? ""}`;

  const checks = [
    // A company name is specific, so we match it in full - a five-character
    // stem turned "Northwind Traders" into a match for "ebiotrade.com".
    matchesDimension(haystack, descriptor.name, false),
    matchesDimension(haystack, trade, true),
    matchesDimension(haystack, descriptor.location, true),
  ];

  return mode === "all" ? checks.every(Boolean) : checks.some(Boolean);
}

/**
 * Score a candidate higher when the domain or title echoes what the user asked
 * for. Deliberately shallow - it is a tie-breaker between results we already
 * consider relevant, not a relevance model.
 */
export function scoreResult(result: SearchResult, descriptor: BusinessDescriptor): number {
  const domain = registrableDomain(result.url);
  const title = result.title.toLowerCase();
  let score = 0;

  for (const token of tokenise(descriptor.name ?? "")) {
    if (domain.includes(token)) score += 6;
    if (title.includes(token)) score += 3;
  }
  for (const token of tokenise(descriptor.category ?? "")) {
    if (domain.includes(token)) score += 4;
    if (title.includes(token)) score += 2;
  }
  for (const token of tokenise(descriptor.niche ?? "")) {
    if (domain.includes(token)) score += 2;
    if (title.includes(token)) score += 1;
  }
  for (const token of tokenise(descriptor.location ?? "")) {
    if (domain.includes(token)) score += 3;
    if (title.includes(token)) score += 1;
  }

  // A bare domain is more likely the business homepage than a deep page.
  try {
    const path = new URL(result.url).pathname.replace(/\/+$/, "");
    if (path === "" ) score += 3;
    else if (path.split("/").filter(Boolean).length <= 1) score += 1;
  } catch {
    // ignore
  }

  return score;
}

export interface RankedCandidate extends DiscoveryCandidate {
  kind: CandidateKind;
}

/**
 * Deduplicate by domain, drop non-business listings, and order by score.
 * Returns one candidate per website so we never crawl the same site twice.
 */
export function rankCandidates(
  results: SearchResult[],
  descriptor: BusinessDescriptor,
  options: {
    includeDirectories?: boolean;
    relevance?: RelevanceMode;
  } = {},
): RankedCandidate[] {
  // "all" is the default: every dimension the operator filled in must appear in
  // the result. Looser modes exist for callers that explicitly want recall.
  const relevance = options.relevance ?? "all";
  const byDomain = new Map<string, RankedCandidate>();

  for (const result of results) {
    const domain = registrableDomain(result.url);
    if (!domain) continue;

    const kind = classifyResult(result.url, result.title);
    const usable = options.includeDirectories ? kind !== "social" : kind === "business-site";
    if (!usable) continue;

    if (!isRelevant(result, descriptor, relevance)) continue;

    const score = scoreResult(result, descriptor);
    const existing = byDomain.get(domain);

    // Keep the highest-scoring page for each domain.
    if (!existing || score > existing.score) {
      byDomain.set(domain, { ...result, domain, kind, score });
    }
  }

  return [...byDomain.values()].sort((a, b) => b.score - a.score);
}
