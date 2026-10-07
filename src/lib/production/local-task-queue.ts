import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CrawlTask, QueueStats, TaskHandler, TaskQueue } from "./task-queue";
import { DEFAULT_RETRY_POLICY, backoffDelay, type QueueRetryPolicy } from "./task-queue";

type StoredStatus = "pending" | "leased" | "failed";

interface StoredTask {
  task: CrawlTask;
  status: StoredStatus;
  attempts: number;
  runAt: number;
  leaseExpiresAt?: number;
  lastError?: string;
}

interface QueueState {
  version: 1;
  tasks: Record<string, StoredTask>;
  pausedJobs: string[];
  completed: number;
  failed: number;
}

const DEFAULT_LEASE_MS = 120_000;

/**
 * Durable, file-backed crawl queue used when Redis is not configured.
 *
 * Provides the operations the worker depends on: leased claiming (so a crashed
 * worker does not lose tasks), retry with exponential backoff, stalled-task
 * recovery, pause/resume, and cancellation.
 */
export class LocalTaskQueue implements TaskQueue {
  readonly kind = "local" as const;

  private readonly filePath: string;
  private readonly leaseMs: number;
  private readonly retry: QueueRetryPolicy;
  private readonly pollMs: number;

  private timer: NodeJS.Timeout | null = null;
  private handler: TaskHandler | null = null;
  private running = new Set<Promise<void>>();
  private stopped = false;
  private concurrency: number;

  constructor(options: {
    filePath: string;
    concurrency: number;
    pollMs: number;
    leaseMs?: number;
    retry?: QueueRetryPolicy;
  }) {
    this.filePath = options.filePath;
    this.concurrency = Math.max(1, options.concurrency);
    this.pollMs = Math.max(100, options.pollMs);
    this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    this.retry = options.retry ?? DEFAULT_RETRY_POLICY;
  }

  // ---------------------------------------------------------------- state IO

  private readState(): QueueState {
    if (!existsSync(this.filePath)) {
      return { version: 1, tasks: {}, pausedJobs: [], completed: 0, failed: 0 };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as QueueState;
      return {
        version: 1,
        tasks: parsed.tasks ?? {},
        pausedJobs: parsed.pausedJobs ?? [],
        completed: parsed.completed ?? 0,
        failed: parsed.failed ?? 0,
      };
    } catch {
      return { version: 1, tasks: {}, pausedJobs: [], completed: 0, failed: 0 };
    }
  }

  /** Write via temp file + rename so a crash mid-write cannot corrupt state. */
  private writeState(state: QueueState): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    writeFileSync(temp, JSON.stringify(state, null, 2), "utf8");
    renameSync(temp, this.filePath);
  }

  private mutate<T>(fn: (state: QueueState) => T): T {
    const state = this.readState();
    const result = fn(state);
    this.writeState(state);
    return result;
  }

  // -------------------------------------------------------------- task queue

  async enqueueMany(tasks: CrawlTask[]): Promise<number> {
    if (!tasks.length) return 0;
    return this.mutate((state) => {
      let added = 0;
      for (const task of tasks) {
        if (state.tasks[task.id]) continue;
        state.tasks[task.id] = { task, status: "pending", attempts: 0, runAt: Date.now() };
        added += 1;
      }
      return added;
    });
  }

  async start(handler: TaskHandler): Promise<void> {
    if (this.timer) return;
    this.handler = handler;
    this.stopped = false;
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    void this.tick();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await Promise.allSettled([...this.running]);
  }

  async pause(jobId?: string): Promise<void> {
    this.mutate((state) => {
      if (jobId) {
        if (!state.pausedJobs.includes(jobId)) state.pausedJobs.push(jobId);
      } else {
        // Global pause is modelled by pausing every known job.
        for (const task of Object.values(state.tasks)) {
          if (!state.pausedJobs.includes(task.task.jobId)) state.pausedJobs.push(task.task.jobId);
        }
      }
    });
  }

  async resume(jobId?: string): Promise<void> {
    this.mutate((state) => {
      state.pausedJobs = jobId ? state.pausedJobs.filter((id) => id !== jobId) : [];
    });
  }

  async cancelJob(jobId: string): Promise<number> {
    return this.mutate((state) => {
      let removed = 0;
      for (const [id, stored] of Object.entries(state.tasks)) {
        if (stored.task.jobId === jobId && stored.status !== "leased") {
          delete state.tasks[id];
          removed += 1;
        }
      }
      return removed;
    });
  }

  async stats(): Promise<QueueStats> {
    const state = this.readState();
    let waiting = 0;
    let active = 0;
    let failed = 0;
    let delayed = 0;
    const now = Date.now();

    for (const stored of Object.values(state.tasks)) {
      if (stored.status === "leased") active += 1;
      else if (stored.status === "failed") failed += 1;
      else if (stored.runAt > now) delayed += 1;
      else waiting += 1;
    }

    return {
      waiting,
      active,
      completed: state.completed,
      failed,
      delayed,
      paused: state.pausedJobs.length > 0,
    };
  }

  async health(): Promise<boolean> {
    try {
      this.readState();
      return true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------ engine

  /** Requeue tasks whose lease expired (worker died mid-task). */
  private recoverStalled(): void {
    const now = Date.now();
    this.mutate((state) => {
      for (const stored of Object.values(state.tasks)) {
        if (stored.status === "leased" && (stored.leaseExpiresAt ?? 0) < now) {
          stored.status = "pending";
          stored.leaseExpiresAt = undefined;
          stored.runAt = now;
        }
      }
    });
  }

  private claim(state: QueueState, now: number): StoredTask | null {
    for (const stored of Object.values(state.tasks)) {
      if (stored.status !== "pending") continue;
      if (stored.runAt > now) continue;
      if (state.pausedJobs.includes(stored.task.jobId)) continue;
      stored.status = "leased";
      stored.attempts += 1;
      stored.leaseExpiresAt = now + this.leaseMs;
      return stored;
    }
    return null;
  }

  private ack(id: string): void {
    this.mutate((state) => {
      delete state.tasks[id];
      state.completed += 1;
    });
  }

  private fail(id: string, message: string): void {
    this.mutate((state) => {
      const stored = state.tasks[id];
      if (!stored) return;
      if (stored.attempts < this.retry.attempts) {
        stored.status = "pending";
        stored.runAt = Date.now() + backoffDelay(stored.attempts, this.retry);
        stored.leaseExpiresAt = undefined;
        stored.lastError = message;
      } else {
        stored.status = "failed";
        stored.leaseExpiresAt = undefined;
        stored.lastError = message;
        state.failed += 1;
      }
    });
  }

  private async tick(): Promise<void> {
    if (this.stopped || !this.handler) return;
    this.recoverStalled();

    while (this.running.size < this.concurrency) {
      const claimed = this.mutate((state) => this.claim(state, Date.now()));
      if (!claimed) break;

      const promise = (async () => {
        try {
          await this.handler!(claimed.task);
          this.ack(claimed.task.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown task failure";
          this.fail(claimed.task.id, message);
        }
      })();

      this.running.add(promise);
      void promise.finally(() => this.running.delete(promise));
    }
  }
}

export function localQueuePath(cwd = process.cwd()): string {
  return join(cwd, ".data", "task-queue.json");
}
