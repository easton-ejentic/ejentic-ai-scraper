export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  discoverBusinessUrls,
  hasSearchableInput,
  labelForProvider,
  providerStatus,
} from "@/lib/discovery";
import type {
  ApiError,
  DiscoverRequest,
  DiscoverResponse,
} from "@/lib/scraper/api-types";
import { requireApiUser } from "@/lib/auth/guard";

/**
 * Preview what a search-driven job would crawl, without creating a job.
 *
 * Used by the job wizard so the operator can see the real websites the search
 * returned (and drop the ones they don't want) before anything is queued.
 */
export async function POST(request: Request) {
  const __auth = await requireApiUser(request);
  if (__auth.response) return __auth.response;

  let body: DiscoverRequest;

  try {
    body = (await request.json()) as DiscoverRequest;
  } catch {
    const err: ApiError = { error: "Invalid JSON body" };
    return NextResponse.json(err, { status: 400 });
  }

  const descriptor = {
    name: body.name?.trim() || undefined,
    niche: body.niche?.trim() || undefined,
    category: body.category?.trim() || undefined,
    location: body.location?.trim() || undefined,
    keywords: (body.keywords ?? []).map((k) => k.trim()).filter(Boolean),
  };

  if (!hasSearchableInput(descriptor)) {
    const err: ApiError = {
      error: "Enter a business name, niche, category or location to search for.",
    };
    return NextResponse.json(err, { status: 400 });
  }

  const status = providerStatus();
  if (!status.configured) {
    const err: ApiError = {
      error: "No search provider is configured. Set BRAVE_SEARCH_API_KEY to enable search.",
    };
    return NextResponse.json(err, { status: 503 });
  }

  try {
    const outcome = await discoverBusinessUrls(descriptor, {
      maxUrls: Math.max(1, Math.min(body.maxUrls ?? 25, 100)),
    });

    const response: DiscoverResponse = {
      queries: outcome.queries,
      provider: outcome.provider,
      providerLabel: labelForProvider(outcome.provider),
      providerNote: status.note,
      results: outcome.candidates.map((candidate) => ({
        title: candidate.title,
        url: candidate.url,
        snippet: candidate.snippet,
        domain: candidate.domain,
        kind: candidate.kind,
        score: candidate.score,
      })),
      urls: outcome.urls,
      ...(outcome.error ? { error: outcome.error } : {}),
      ...(outcome.warning ? { warning: outcome.warning } : {}),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error running discovery:", error);
    const err: ApiError = {
      error: "Search failed",
      ...(error instanceof Error ? { details: error.message } : {}),
    };
    return NextResponse.json(err, { status: 502 });
  }
}
