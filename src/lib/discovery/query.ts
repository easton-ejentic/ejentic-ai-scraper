/**
 * Turn a human description into search-engine queries.
 *
 * The same description can be phrased several ways and return very different
 * results, so we generate a small number of deliberate variants instead of one
 * guess. Quoting a known company name matters a lot - it stops the engine
 * returning pages that merely mention those words.
 */

import type { BusinessDescriptor } from "./types";

const MAX_QUERIES = 3;

function parts(descriptor: BusinessDescriptor): string[] {
  return [descriptor.niche, descriptor.category, descriptor.location]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

export function buildQueries(descriptor: BusinessDescriptor): string[] {
  const name = descriptor.name?.trim();
  const niche = descriptor.niche?.trim();
  const category = descriptor.category?.trim();
  const location = descriptor.location?.trim();
  const keywords = (descriptor.keywords ?? []).map((k) => k.trim()).filter(Boolean);

  const queries: string[] = [];

  // 1. Everything they gave us, in a natural order.
  const combined = [name ? `"${name}"` : null, niche, category, location, ...keywords]
    .filter(Boolean)
    .join(" ");
  if (combined) queries.push(combined);

  // 2. Trade + place, phrased the way people actually search.
  const trade = niche || category;
  if (trade && location) {
    queries.push(`${trade} in ${location}`);
  }

  // 3. When we only have a name, bias toward the company's own site.
  if (name && !trade && !location) {
    queries.push(`"${name}" official website`);
  }

  // De-duplicate while preserving order.
  const seen = new Set<string>();
  return queries
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((query) => {
      const key = query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUERIES);
}

/** True when there is anything at all to search for. */
export function hasSearchableInput(descriptor: BusinessDescriptor | undefined): boolean {
  if (!descriptor) return false;
  return Boolean(
    descriptor.name?.trim() ||
      descriptor.niche?.trim() ||
      descriptor.category?.trim() ||
      descriptor.location?.trim() ||
      (descriptor.keywords ?? []).some((k) => k.trim()),
  );
}

/** Human-readable summary of what will be searched, for the UI. */
export function describeSearch(descriptor: BusinessDescriptor | undefined): string {
  if (!descriptor || !hasSearchableInput(descriptor)) return "Nothing to search yet";
  const bits = [descriptor.name, descriptor.niche || descriptor.category, descriptor.location]
    .map((value) => value?.trim())
    .filter(Boolean);
  return bits.join(" · ");
}
