/**
 * Browser-side API client for scraper endpoints.
 */

import type { JobDraft, ScraperJob } from "./job-types";
import type {
  CreateJobResponse,
  DiscoverRequest,
  DiscoverResponse,
  GetJobResponse,
  ListJobsResponse,
  UpdateJobResponse,
} from "./api-types";

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data?.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function createJob(draft: JobDraft): Promise<CreateJobResponse> {
  const res = await fetch("/api/scraper/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  return parseJson<CreateJobResponse>(res);
}

/**
 * Run a live web search for businesses matching a description and preview the
 * websites found. Does not create anything.
 */
export async function discoverBusinesses(
  request: DiscoverRequest
): Promise<DiscoverResponse> {
  const res = await fetch("/api/scraper/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return parseJson<DiscoverResponse>(res);
}

export async function listJobs(): Promise<ScraperJob[]> {
  const res = await fetch("/api/scraper/jobs");
  const data = await parseJson<ListJobsResponse>(res);
  return data.jobs;
}

export async function getJob(jobId: string): Promise<ScraperJob> {
  const res = await fetch(`/api/scraper/jobs/${jobId}`);
  const data = await parseJson<GetJobResponse>(res);
  return data.job;
}

export async function updateJob(
  jobId: string,
  action: "pause" | "resume" | "cancel"
): Promise<ScraperJob> {
  const res = await fetch(`/api/scraper/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await parseJson<UpdateJobResponse>(res);
  return data.job;
}
