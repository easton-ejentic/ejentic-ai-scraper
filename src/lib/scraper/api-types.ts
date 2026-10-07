/**
 * API contracts for the scraper control interface.
 * MOCK-backed for now — shapes are the source of truth for future real backend.
 */

import type { JobDraft, JobStatus, ScraperJob } from "./job-types";

/** POST /api/scraper/jobs — request body */
export type CreateJobRequest = JobDraft;

/** POST /api/scraper/jobs — response */
export interface CreateJobResponse {
  id: string;
  status: JobStatus;
  job: ScraperJob;
  /** Present when the job was seeded by live web discovery. */
  discovery?: {
    queries: string[];
    provider: string | null;
    resultCount: number;
    urlCount: number;
  };
}

/** POST /api/scraper/discover — request body */
export interface DiscoverRequest {
  name?: string;
  niche?: string;
  category?: string;
  location?: string;
  keywords?: string[];
  maxUrls?: number;
}

/** POST /api/scraper/discover — response */
export interface DiscoverResponse {
  queries: string[];
  provider: string | null;
  providerLabel: string;
  /** Operator-facing note about reliability and how to improve it. */
  providerNote: string;
  results: {
    title: string;
    url: string;
    snippet: string;
    domain: string;
    kind: string;
    score: number;
  }[];
  urls: string[];
  error?: string;
  /** Set when results only loosely match the description. */
  warning?: string;
}

/** GET /api/scraper/jobs — response */
export interface ListJobsResponse {
  jobs: ScraperJob[];
}

/** GET /api/scraper/jobs/:id — response */
export interface GetJobResponse {
  job: ScraperJob;
}

/** PATCH /api/scraper/jobs/:id — request body */
export interface UpdateJobRequest {
  action: "pause" | "resume" | "cancel";
}

/** PATCH /api/scraper/jobs/:id — response */
export interface UpdateJobResponse {
  job: ScraperJob;
}

/** Standard error body */
export interface ApiError {
  error: string;
  details?: string;
}
