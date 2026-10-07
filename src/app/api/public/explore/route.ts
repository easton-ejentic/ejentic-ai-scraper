export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { discoverBusinessUrls } from "@/lib/discovery";
import { checkLimit, clientIpFrom, recordUse } from "@/lib/auth/rate-limit";

/**
 * Public, unauthenticated search preview.
 *
 * This is the one part of the product visitors can use without signing in. It
 * runs a real live web search and returns real websites - it does not crawl,
 * does not write anything to the database, and never returns sample data.
 *
 * Because it is open, it is throttled per IP and capped to a handful of
 * results. The full pipeline (crawl, evidence, workflows, scoring) stays behind
 * the login because it costs real crawl budget.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_RESULTS = 6;
const MAX_QUERY_LENGTH = 120;

export async function GET(request: Request) {
  const ip = clientIpFrom(request.headers);
  const limit = checkLimit("public-explore", ip, MAX_REQUESTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many searches from this connection. Try again in ${Math.ceil(
          limit.retryAfterSeconds / 60,
        )} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const raw = (url.searchParams.get("q") ?? "").trim();

  if (raw.length < 3) {
    return NextResponse.json(
      { error: "Describe what you are looking for in at least 3 characters." },
      { status: 400 },
    );
  }
  if (raw.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Keep the description under ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 },
    );
  }

  recordUse("public-explore", ip, WINDOW_MS);

  try {
    // The public tool takes one free-text line and treats it as the whole
    // descriptor; the internal job wizard splits this into name/niche/location.
    const outcome = await discoverBusinessUrls(
      { niche: raw, keywords: [] },
      { maxUrls: MAX_RESULTS, limit: 10, timeoutMs: 12_000 },
    );

    if (outcome.error) {
      return NextResponse.json(
        { query: raw, provider: outcome.provider, error: outcome.error, results: [] },
        { status: 502 },
      );
    }

    return NextResponse.json({
      query: raw,
      provider: outcome.provider,
      queries: outcome.queries.slice(0, 3),
      warning: outcome.warning ?? null,
      results: outcome.candidates.slice(0, MAX_RESULTS).map((candidate) => ({
        title: candidate.title,
        url: candidate.url,
        snippet: candidate.snippet,
        domain: candidate.domain,
        kind: candidate.kind,
      })),
    });
  } catch (error) {
    console.error("Public explore failed:", error);
    return NextResponse.json(
      { error: "The search service is unreachable right now. Try again shortly." },
      { status: 502 },
    );
  }
}
