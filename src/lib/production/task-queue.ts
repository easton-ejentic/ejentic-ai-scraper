/**
 * Crawl task queue abstraction.
 *
 * Production uses Redis + BullMQ. When REDIS_URL is not configured we fall back
 * to a durable, file-backed queue with equivalent semantics (retries, backoff,
 * stalled-task recovery, pause/resume, cancellation). Callers never branch on
 * which implementation is active.
 */

export const CRAWL_QUEUE_NAME = "scraper:crawl";

/** One crawl task == one URL to fetch. */
export interface CrawlTask {
  /** Stable identity, derived from jobId + normalized URL. */
  id: string;
  jobId: string;
  queueItemId: string;
  url: string;
  normalizedUrl: string;
  depth: number;
}

export type TaskHandler = (task: CrawlTask) => Promise<void>;

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface TaskQueue {
  readonly kind: "bullmq" | "local";
  /** Add tasks. Duplicate task ids are ignored. */
  enqueueMany(tasks: CrawlTask[]): Promise<number>;
  /** Begin consuming tasks. Resolves once the consumer is running. */
  start(handler: TaskHandler): Promise<void>;
  /** Stop consuming and release resources. */
  stop(): Promise<void>;
  pause(jobId?: string): Promise<void>;
  resume(jobId?: string): Promise<void>;
  /** Drop pending tasks for a job. Returns the number removed. */
  cancelJob(jobId: string): Promise<number>;
  stats(): Promise<QueueStats>;
  /** Whether the backing store is reachable. */
  health(): Promise<boolean>;
}

export interface QueueRetryPolicy {
  attempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}

export const DEFAULT_RETRY_POLICY: QueueRetryPolicy = {
  attempts: 3,
  backoffMs: 2_000,
  maxBackoffMs: 30_000,
};

/** Exponential backoff with a ceiling, matching worker retry semantics. */
export function backoffDelay(attempt: number, policy: QueueRetryPolicy = DEFAULT_RETRY_POLICY): number {
  const raw = policy.backoffMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(policy.maxBackoffMs, raw);
}
