export type TargetType = "campaign" | "url-list" | "domain" | "search";

export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Matches the statuses a real worker reports in its heartbeat. `stopped` means
 * it shut down cleanly; anything not heartbeating recently should be treated as
 * stale by the caller.
 */
export type WorkerStatus = "running" | "idle" | "stopped";

export interface JobDraft {
  name: string;
  targetType: TargetType;
  campaignId?: string;
  target?: string;
  /**
   * Free-text description used when `targetType` is "search". The discovery
   * module turns this into live web searches - no URLs are supplied by hand.
   */
  descriptor?: {
    name?: string;
    niche?: string;
    category?: string;
    location?: string;
    keywords?: string[];
  };
  /**
   * Websites the operator picked from the search preview. When present the job
   * crawls exactly these and does not re-run the search.
   */
  discoveredUrls?: string[];
  urlLimit: number;
  sources: {
    websites: boolean;
    search: boolean;
    directories: boolean;
    social: boolean;
  };
  configuration: {
    workers: number;
    requestsPerSecond: number;
    retries: number;
    javascriptRendering: boolean;
  };
}

export const defaultJobDraft: JobDraft = {
  name: "",
  targetType: "search",
  descriptor: { name: "", niche: "", category: "", location: "", keywords: [] },
  urlLimit: 1500,
  sources: {
    websites: true,
    search: true,
    directories: true,
    social: false,
  },
  configuration: {
    workers: 10,
    requestsPerSecond: 5,
    retries: 3,
    javascriptRendering: true,
  },
};

export interface ScraperJob {
  id: string;
  name: string;
  status: JobStatus;
  /** Campaign this job belongs to, when the operator filed it under one. */
  campaignId?: string | null;
  totalUrls: number;
  processedUrls: number;
  successfulUrls: number;
  queuedUrls: number;
  workersActive: number;
  workersTotal: number;
  errorRate: number;
  createdAt: string;
  startedAt?: string;
  targetType: TargetType;
  targetLabel: string;
  sources: string[];
  configuration: {
    workers: number;
    requestsPerSecond: number;
    retries: number;
    javascriptRendering: boolean;
  };
}

export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  currentUrl?: string | null;
  /** How many pages this worker has processed in its current run. */
  jobsProcessed: number;
  /** How many URLs it works through at once. */
  concurrency: number;
}

export interface ActivityEvent {
  id: string;
  time: string;
  message: string;
  type: "success" | "warning" | "info" | "error";
}
