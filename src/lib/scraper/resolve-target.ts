/**
 * Turn a job draft into the concrete URLs the crawler should start from.
 *
 * This is the single place that decides "what do we actually fetch". It exists
 * because the same decision was previously duplicated in two storage backends
 * and they disagreed - domain jobs ended up with an empty queue in one path and
 * a working queue in the other.
 *
 * Rules:
 *  - "search" runs a live web search from the description and uses whatever
 *    real results come back. If the search finds nothing, the job is created
 *    with zero URLs and the reason is reported. Nothing is invented.
 *  - "domain" seeds a single root URL.
 *  - "url-list" seeds each supplied URL.
 *  - "campaign" resolves the preset to a search descriptor and runs a search.
 */

import { buildQueries, discoverBusinessUrls } from "@/lib/discovery";
import type { BusinessDescriptor } from "@/lib/discovery/types";
import type { JobDraft } from "./job-types";

export interface ResolvedTarget {
  queueUrls: string[];
  targetLabel: string;
  /** Queries actually sent to the search engine (search/campaign only). */
  queries: string[];
  /** Which engine answered, or null when no search was run. */
  provider: string | null;
  /** Raw results before filtering, for transparency in the UI. */
  resultCount: number;
  /** Why the queue is empty, when it is. */
  error?: string;
}

/**
 * Preset campaigns. These are search descriptions, not canned company lists -
 * running one performs a real search, so results are always live.
 *
 * They deliberately omit a location: results are filtered to match every term
 * given, and a business website almost never contains "United States", so a
 * country would filter out every genuine result. Add a city in the search tab
 * if you want to narrow geographically.
 */
export const CAMPAIGN_PRESETS: Record<
  string,
  { label: string; descriptor: BusinessDescriptor }
> = {
  insurance: {
    label: "Insurance Agencies",
    descriptor: { niche: "insurance agency", category: "insurance" },
  },
  accounting: {
    label: "Accounting Firms",
    descriptor: { niche: "accounting firm", category: "accountant" },
  },
};

/** Split a textarea of URLs into cleaned, deduplicated entries. */
export function splitUrlList(target: string | undefined): string[] {
  const seen = new Set<string>();
  return (target ?? "")
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const IS_HTTP_SCHEME = /^https?:\/\//i;

/**
 * Normalise "example.com" or "https://example.com" into a crawlable root URL.
 *
 * A value carrying any non-http scheme (ftp:, file:, javascript:) is rejected
 * outright. Naively prefixing "https://" would turn "ftp://example.com" into a
 * URL whose host is "ftp" - a silently wrong, and unsafe, seed URL.
 */
export function domainToUrl(target: string | undefined): string | null {
  const value = target?.trim();
  if (!value) return null;
  if (HAS_SCHEME.test(value) && !IS_HTTP_SCHEME.test(value)) return null;

  const candidate = IS_HTTP_SCHEME.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return null;
  }
}

function descriptorFromDraft(draft: JobDraft): BusinessDescriptor | undefined {
  if (draft.targetType === "search") return draft.descriptor;
  if (draft.targetType === "campaign" && draft.campaignId) {
    return CAMPAIGN_PRESETS[draft.campaignId]?.descriptor;
  }
  return undefined;
}

/**
 * Human-readable label for the job. For searches it describes what was looked
 * for, not a URL, because there may be dozens of them.
 */
export function targetLabelFor(draft: JobDraft, queueUrls: string[]): string {
  if (draft.targetType === "campaign") {
    return (
      CAMPAIGN_PRESETS[draft.campaignId ?? ""]?.label ??
      draft.campaignId ??
      "Campaign"
    );
  }
  if (draft.targetType === "domain") return draft.target?.trim() ?? "Domain";
  if (draft.targetType === "url-list") return `URL list (${queueUrls.length} entries)`;
  if (draft.targetType === "search") {
    const bits = [
      draft.descriptor?.name,
      draft.descriptor?.niche || draft.descriptor?.category,
      draft.descriptor?.location,
    ]
      .map((value) => value?.trim())
      .filter(Boolean);
    const label = bits.join(" · ");
    return label ? `Search: ${label}` : "Search";
  }
  return "Unknown";
}

/**
 * Resolve a draft into seed URLs.
 *
 * `maxUrls` is capped by the job's own URL limit so a job can never be seeded
 * with more work than it is allowed to do.
 */
export async function resolveJobTarget(draft: JobDraft): Promise<ResolvedTarget> {
  const maxUrls = Math.max(1, Math.min(draft.urlLimit || 25, 250));

  if (draft.targetType === "domain") {
    const root = domainToUrl(draft.target);
    const queueUrls = root ? [root] : [];
    return {
      queueUrls,
      targetLabel: targetLabelFor(draft, queueUrls),
      queries: [],
      provider: null,
      resultCount: 0,
      ...(root ? {} : { error: "That domain is not a valid web address." }),
    };
  }

  if (draft.targetType === "url-list") {
    const queueUrls = splitUrlList(draft.target);
    return {
      queueUrls,
      targetLabel: targetLabelFor(draft, queueUrls),
      queries: [],
      provider: null,
      resultCount: 0,
      ...(queueUrls.length ? {} : { error: "No URLs were supplied." }),
    };
  }

  // Campaign presets and free-text search both go through live discovery.
  const descriptor = descriptorFromDraft(draft);

  // If the operator already reviewed the search preview and picked websites,
  // honour that selection instead of searching again.
  if (draft.targetType === "search" && draft.discoveredUrls?.length) {
    const picked = splitUrlList(draft.discoveredUrls.join("\n"));
    return {
      queueUrls: picked.slice(0, maxUrls),
      targetLabel: targetLabelFor(draft, picked),
      queries: buildQueries(descriptor ?? {}),
      provider: null,
      resultCount: picked.length,
    };
  }

  const outcome = await discoverBusinessUrls(descriptor ?? {}, { maxUrls });

  return {
    queueUrls: outcome.urls,
    targetLabel: targetLabelFor(draft, outcome.urls),
    queries: outcome.queries,
    provider: outcome.provider,
    resultCount: outcome.results.length,
    ...(outcome.error ? { error: outcome.error } : {}),
  };
}
