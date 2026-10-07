/**
 * Crawl queue facade.
 *
 * Selects the Redis/BullMQ implementation when REDIS_URL is configured and
 * reachable, otherwise falls back to the durable local queue. Callers only ever
 * see the TaskQueue interface, so the UI and worker are unaware of the backing
 * store.
 */

import { productionConfig } from "./config";
import type { CrawlTask, QueueStats, TaskQueue } from "./task-queue";

let instance: TaskQueue | null = null;
let fallbackReason: string | null = null;

export async function getTaskQueue(): Promise<TaskQueue> {
  if (instance) return instance;

  const config = productionConfig();

  if (config.redisUrlConfigured) {
    try {
      const { BullMqTaskQueue } = await import("./bullmq-task-queue");
      const queue = new BullMqTaskQueue({
        redisUrl: process.env.REDIS_URL as string,
        concurrency: config.workerConcurrency,
      });
      const healthy = await queue.health();
      if (!healthy) throw new Error("Redis health check failed");
      instance = queue;
      return instance;
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : "Unknown Redis error";
      console.warn(`[queue] Redis unavailable (${fallbackReason}); using local queue`);
    }
  } else {
    fallbackReason = "REDIS_URL not configured";
  }

  const { LocalTaskQueue, localQueuePath } = await import("./local-task-queue");
  instance = new LocalTaskQueue({
    filePath: localQueuePath(),
    concurrency: config.workerConcurrency,
    pollMs: config.pollMs,
  });
  return instance;
}

/** Stable task id so re-queueing the same URL is idempotent. */
export function crawlTaskId(jobId: string, normalizedUrl: string): string {
  return Buffer.from(`${jobId}:${normalizedUrl}`).toString("base64url");
}

export function buildCrawlTask(input: {
  jobId: string;
  queueItemId: string;
  url: string;
  normalizedUrl: string;
  depth?: number;
}): CrawlTask {
  return {
    id: crawlTaskId(input.jobId, input.normalizedUrl),
    jobId: input.jobId,
    queueItemId: input.queueItemId,
    url: input.url,
    normalizedUrl: input.normalizedUrl,
    depth: input.depth ?? 0,
  };
}

export async function getQueueStats(): Promise<QueueStats> {
  const queue = await getTaskQueue();
  try {
    return await queue.stats();
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: false };
  }
}

export async function closeQueue(): Promise<void> {
  if (!instance) return;
  await instance.stop();
  instance = null;
}

export function isExternalQueue(): boolean {
  return instance?.kind === "bullmq";
}

export function isMemoryQueue(): boolean {
  return instance?.kind === "local";
}

/** Why the local fallback is in use, or null when Redis is active. */
export function queueFallbackReason(): string | null {
  return fallbackReason;
}

export type { CrawlTask, QueueStats, TaskQueue } from "./task-queue";
