export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { JobDraft } from "@/lib/scraper/job-types";
import type {
  ApiError,
  CreateJobResponse,
  ListJobsResponse,
} from "@/lib/scraper/api-types";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";
import { resolveJobTarget } from "@/lib/scraper/resolve-target";
import { hasSearchableInput } from "@/lib/discovery";

export async function GET(_request: Request) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

  try {
    const repository = getRepository();
    const jobs = await repository.listStoredJobs();
    const body: ListJobsResponse = { jobs };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Error listing jobs:", error);
    const err: ApiError = { error: "Failed to list jobs" };
    return NextResponse.json(err, { status: 500 });
  }
}

export async function POST(request: Request) {
  const __auth = await requireApiUser(request);
  if (__auth.response) return __auth.response;

  let draft: JobDraft;

  try {
    draft = (await request.json()) as JobDraft;
  } catch {
    const err: ApiError = { error: "Invalid JSON body" };
    return NextResponse.json(err, { status: 400 });
  }

  if (!draft.name?.trim()) {
    const err: ApiError = { error: "Job name is required" };
    return NextResponse.json(err, { status: 400 });
  }

  if (!draft.urlLimit || draft.urlLimit < 1) {
    const err: ApiError = { error: "urlLimit must be >= 1" };
    return NextResponse.json(err, { status: 400 });
  }

  const hasSource =
    draft.sources?.websites ||
    draft.sources?.search ||
    draft.sources?.directories ||
    draft.sources?.social;

  if (!hasSource) {
    const err: ApiError = { error: "At least one source is required" };
    return NextResponse.json(err, { status: 400 });
  }

  if (!draft.configuration?.workers || draft.configuration.workers < 1 || draft.configuration.workers > 50) {
    const err: ApiError = { error: "workers must be between 1 and 50" };
    return NextResponse.json(err, { status: 400 });
  }

  if (!draft.configuration.requestsPerSecond || draft.configuration.requestsPerSecond < 1 || draft.configuration.requestsPerSecond > 100) {
    const err: ApiError = { error: "requestsPerSecond must be between 1 and 100" };
    return NextResponse.json(err, { status: 400 });
  }

  if (draft.configuration.retries < 0 || draft.configuration.retries > 10) {
    const err: ApiError = { error: "retries must be between 0 and 10" };
    return NextResponse.json(err, { status: 400 });
  }

  if (draft.targetType === "campaign" && !draft.campaignId) {
    const err: ApiError = { error: "campaignId is required for campaign targets" };
    return NextResponse.json(err, { status: 400 });
  }

  if (draft.targetType === "domain" && !draft.target?.trim()) {
    const err: ApiError = { error: "target is required for domain targets" };
    return NextResponse.json(err, { status: 400 });
  }

  if (
    draft.targetType === "search" &&
    !hasSearchableInput(draft.descriptor) &&
    !draft.discoveredUrls?.length
  ) {
    const err: ApiError = {
      error: "Enter a business name, niche, category or location to search for.",
    };
    return NextResponse.json(err, { status: 400 });
  }

  try {
    // Resolve the draft into real seed URLs. For "search" and "campaign" this
    // performs live web discovery, so it happens before the job is written.
    const resolved = await resolveJobTarget(draft);

    if (!resolved.queueUrls.length) {
      const err: ApiError = {
        error:
          resolved.error ??
          "No starting URLs could be found for this target.",
      };
      return NextResponse.json(err, { status: 422 });
    }

    const repository = getRepository();
    const job = await repository.createStoredJob(draft, resolved.queueUrls);

    const body: CreateJobResponse = {
      id: job.id,
      status: job.status,
      job,
      discovery: {
        queries: resolved.queries,
        provider: resolved.provider,
        resultCount: resolved.resultCount,
        urlCount: resolved.queueUrls.length,
      },
    };

    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    console.error("Error creating job:", error);
    const err: ApiError = {
      error: "Failed to create job",
      ...(error instanceof Error ? { details: error.message } : {}),
    };
    return NextResponse.json(err, { status: 500 });
  }
}
