import { Queue, Worker, type ConnectionOptions, type JobsOptions } from "bullmq";
import type { CrawlTask, QueueStats, TaskHandler, TaskQueue } from "./task-queue";
import { CRAWL_QUEUE_NAME, DEFAULT_RETRY_POLICY, type QueueRetryPolicy } from "./task-queue";

/** Minimal shape of the Redis client we use for pause flags. */
interface KeyValueClient {
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

export interface BullMqQueueOptions {
  redisUrl: string;
  concurrency: number;
  retry?: QueueRetryPolicy;
}

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const isTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(isTls ? { tls: {} } : {}),
    // Required by BullMQ: ioredis must not cap retries per request.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  } as ConnectionOptions;
}

/**
 * Redis-backed crawl queue (production). Durable jobs, exponential backoff,
 * concurrency, stalled-job recovery (BullMQ re-queues stalled jobs), and
 * pause/resume/cancel.
 */
export class BullMqTaskQueue implements TaskQueue {
  readonly kind = "bullmq" as const;

  private readonly options: BullMqQueueOptions;
  private readonly retry: QueueRetryPolicy;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private handler: TaskHandler | null = null;

  constructor(options: BullMqQueueOptions) {
    this.options = options;
    this.retry = options.retry ?? DEFAULT_RETRY_POLICY;
  }

  private connection(): ConnectionOptions {
    return parseRedisUrl(this.options.redisUrl);
  }

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(CRAWL_QUEUE_NAME, { connection: this.connection() });
    }
    return this.queue;
  }

  private jobOptions(): JobsOptions {
    return {
      attempts: this.retry.attempts,
      backoff: { type: "exponential", delay: this.retry.backoffMs },
      removeOnComplete: { age: 86_400, count: 5_000 },
      removeOnFail: { age: 7 * 86_400 },
    };
  }

  private async client(): Promise<KeyValueClient> {
    return (await this.getQueue().client) as unknown as KeyValueClient;
  }

  private pauseKey(jobId: string): string {
    return `${CRAWL_QUEUE_NAME}:paused:${jobId}`;
  }

  private async isPaused(jobId: string): Promise<boolean> {
    try {
      const value = await (await this.client()).get(this.pauseKey(jobId));
      return value === "1";
    } catch {
      return false;
    }
  }

  async enqueueMany(tasks: CrawlTask[]): Promise<number> {
    if (!tasks.length) return 0;
    await this.getQueue().addBulk(
      tasks.map((task) => ({
        name: "crawl",
        data: task,
        opts: { ...this.jobOptions(), jobId: task.id },
      })),
    );
    return tasks.length;
  }

  async start(handler: TaskHandler): Promise<void> {
    if (this.worker) return;
    this.handler = handler;

    this.worker = new Worker(
      CRAWL_QUEUE_NAME,
      async (job) => {
        const task = job.data as CrawlTask;

        // Job-scoped pause: defer the task rather than consuming it.
        if (await this.isPaused(task.jobId)) {
          await this.getQueue().add("crawl", task, {
            ...this.jobOptions(),
            jobId: task.id,
            delay: 5_000,
          });
          return;
        }

        await handler(task);
      },
      {
        connection: this.connection(),
        concurrency: Math.max(1, this.options.concurrency),
        // Matches the local queue's lease semantics for crash recovery.
        stalledInterval: 30_000,
        maxStalledCount: 2,
      },
    );

    this.worker.on("failed", (job, error) => {
      console.warn(`[queue] task ${job?.id} failed: ${error?.message}`);
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  async pause(jobId?: string): Promise<void> {
    const queue = this.getQueue();
    if (!jobId) {
      await queue.pause();
      return;
    }
    await (await this.client()).set(this.pauseKey(jobId), "1");
  }

  async resume(jobId?: string): Promise<void> {
    const queue = this.getQueue();
    if (!jobId) {
      await queue.resume();
      return;
    }
    await (await this.client()).del(this.pauseKey(jobId));
  }

  async cancelJob(jobId: string): Promise<number> {
    const queue = this.getQueue();
    const states = ["waiting", "delayed", "prioritized"] as const;
    let removed = 0;

    for (const state of states) {
      const jobs = await queue.getJobs([state], 0, 1_000);
      for (const job of jobs) {
        const data = job.data as CrawlTask | undefined;
        if (data?.jobId === jobId) {
          await job.remove();
          removed += 1;
        }
      }
    }

    await (await this.client()).del(this.pauseKey(jobId));
    return removed;
  }

  async stats(): Promise<QueueStats> {
    const queue = this.getQueue();
    const counts = await queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: (counts.paused ?? 0) > 0,
    };
  }

  async health(): Promise<boolean> {
    try {
      await (await this.client()).get("__ejentic_health__");
      return true;
    } catch {
      return false;
    }
  }
}
