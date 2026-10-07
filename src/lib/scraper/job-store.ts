/**
 * Repository compatibility layer.
 *
 * Existing UI code imports this module. The implementation is now persistent
 * instead of process-memory state, while preserving the existing public API.
 */
import type { JobDraft, ScraperJob } from "./job-types";
import {
  createStoredJob,
  getStoredJob,
  listStoredJobs,
  updateStoredJobStatus,
} from "./persistent-store";

export function listJobs(): ScraperJob[] {
  return listStoredJobs();
}

export function getJob(id: string): ScraperJob | undefined {
  return getStoredJob(id);
}

export function createJob(draft: JobDraft): ScraperJob {
  const queueUrls =
    draft.targetType === "url-list"
      ? (draft.target ?? "")
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean)
      : draft.targetType === "domain"
        ? [draft.target ?? ""]
        : [];

  return createStoredJob(draft, queueUrls);
}

export function updateJobStatus(
  id: string,
  action: "pause" | "resume" | "cancel",
): ScraperJob | undefined {
  return updateStoredJobStatus(id, action);
}
