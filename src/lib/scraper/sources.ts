import { providerStatus } from "@/lib/discovery";

export type SourceType = "websites" | "search" | "directories" | "social";
export type SourceStatus = "active" | "degraded" | "disabled";

export interface SourceDefinition {
  id: string;
  name: string;
  type: SourceType;
  status: SourceStatus;
  jobsUsing: number;
  /** Human-readable "when was this last actually exercised", never invented. */
  lastUsed: string;
  description: string;
}

/** Labels exactly as they are stored on a job (`ScraperJob.sources`). */
const LABELS: Record<SourceType, string> = {
  websites: "Company websites",
  search: "Search engines",
  directories: "Business directories",
  social: "Social profiles",
};

const ACTIVE_LABEL = "Active";
const NOT_IMPLEMENTED = "Not implemented";

function relativeOrDash(iso: string | undefined, now: number): string {
  if (!iso) return "Never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "Never";
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Builds the source inventory from live state instead of a hard-coded list.
 *
 * Two things are real here and two are deliberately not, and the UI says so:
 *  - websites: the crawler is implemented, so usage comes from stored jobs.
 *  - search: enabled only when a search provider is actually configured;
 *    `providerStatus()` also tells us when we fell back to a scraped engine
 *    that can silently degrade, which we surface as `degraded`.
 *  - directories / social: the job form offers the toggle, but no discovery
 *    provider exists for either. They are reported as disabled rather than
 *    faking a healthy green badge.
 */
export function deriveSources(
  jobs: { sources: string[]; createdAt: string; startedAt?: string }[],
  now = Date.now(),
): SourceDefinition[] {
  const search = providerStatus();

  const usageFor = (type: SourceType) =>
    jobs.filter((job) => job.sources.includes(LABELS[type]));

  const lastUsedFor = (type: SourceType) => {
    const timestamps = usageFor(type)
      .map((job) => job.startedAt ?? job.createdAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    return relativeOrDash(timestamps[timestamps.length - 1], now);
  };

  const build = (
    type: SourceType,
    status: SourceStatus,
    description: string,
  ): SourceDefinition => ({
    id: `src-${type}`,
    name: LABELS[type],
    type,
    status,
    jobsUsing: usageFor(type).length,
    lastUsed: lastUsedFor(type),
    description,
  });

  const searchDegraded =
    search.configured &&
    (search.provider === "duckduckgo" || search.provider === "bing");

  return [
    build(
      "websites",
      "active",
      "Direct crawl of company-owned domains and paths.",
    ),
    build(
      "search",
      !search.configured
        ? "disabled"
        : searchDegraded
          ? "degraded"
          : "active",
      search.configured
        ? search.note
        : "No search provider configured. Set BRAVE_SEARCH_API_KEY, SERPER_API_KEY, TAVILY_API_KEY or SEARXNG_URL to enable.",
    ),
    build(
      "directories",
      "disabled",
      `${NOT_IMPLEMENTED}: no directory discovery provider is wired up yet.`,
    ),
    build(
      "social",
      "disabled",
      `${NOT_IMPLEMENTED}: no social discovery provider is wired up yet.`,
    ),
  ];
}

export { ACTIVE_LABEL };
