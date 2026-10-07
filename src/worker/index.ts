/**
 * Ejentic AI - discovery worker.
 *
 * Architecture position:  API -> Database -> Queue -> Worker -> Database
 *
 * The worker never runs inside an HTTP request. It polls the repository for
 * running jobs, claims queue items, crawls them through the hardened fetcher in
 * `src/lib/scraper/safety.ts`, and persists everything back through the same
 * `IRepository` abstraction the API uses. That means the JSON dev backend and
 * the PostgreSQL production backend behave identically.
 *
 * Safety controls (SSRF, robots.txt, per-host throttling, response caps) all
 * live in the shared safety module, so an HTTP endpoint can never crawl with
 * weaker rules than the worker does.
 */

import os from "node:os";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { productionConfig } from "@/lib/production/config";
import { getRepository, isProductionMode, type IRepository } from "@/lib/production/repository";
import {
  HostThrottler,
  RobotsCache,
  backoffDelay,
  fetchPage,
} from "@/lib/scraper/safety";
import { parsePage } from "@/lib/scraper/parse-page";
import { sameOrigin } from "@/lib/scraper/url";
import { isErrorPageTitle } from "@/lib/research/company";
import type { ScraperJob } from "@/lib/scraper/job-types";
import type { StoredQueueItem } from "@/lib/scraper/persistent-store";

const WORKER_ID = process.env.SCRAPER_WORKER_ID || `worker-${os.hostname()}-${process.pid}`;
const WORKER_NAME = process.env.SCRAPER_WORKER_NAME || `worker:${os.hostname()}`;
const POLL_MS = Math.max(250, Number(process.env.SCRAPER_POLL_MS || 1_000));
const HEARTBEAT_MS = Math.max(5_000, Number(process.env.SCRAPER_HEARTBEAT_MS || 15_000));
const MAX_LINKS_PER_PAGE = 50;
const MAX_TEXT_CHARS = 100_000;
const DEFAULT_MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warning" | "error" | "success";

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    worker: WORKER_ID,
    message,
    ...context,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

let shuttingDown = false;
let jobsProcessed = 0;
let currentJobId: string | null = null;
let currentUrl: string | null = null;

/** In-memory retry cooldowns so a backed-off item is not re-claimed instantly. */
const retryAfter = new Map<string, number>();

const robots = new RobotsCache();
const throttlers = new Map<string, HostThrottler>();

function throttlerFor(jobId: string, requestsPerSecond: number): HostThrottler {
  const existing = throttlers.get(jobId);
  if (existing) return existing;
  const created = new HostThrottler(requestsPerSecond);
  throttlers.set(jobId, created);
  return created;
}

async function heartbeat(repository: IRepository): Promise<void> {
  if (!repository.upsertWorkerHeartbeat) return;
  try {
    await repository.upsertWorkerHeartbeat({
      id: WORKER_ID,
      name: WORKER_NAME,
      status: shuttingDown ? "stopped" : "running",
      concurrency: 1,
      host: os.hostname(),
      jobsProcessed,
    });
  } catch (error) {
    // Liveness tracking is best-effort; never let it kill the worker.
    log("warning", "Heartbeat failed", { error: String(error) });
  }
}

// ---------------------------------------------------------------------------
// Item processing
// ---------------------------------------------------------------------------

/**
 * Crawl one queue item and persist the result.
 *
 * Any company claim written to the database comes from `recordCompanyPage`,
 * which only stores evidence that was literally extracted from the fetched
 * page. Nothing here invents facts.
 */
async function processItem(
  repository: IRepository,
  job: ScraperJob,
  item: StoredQueueItem,
): Promise<void> {
  currentJobId = job.id;
  currentUrl = item.url;

  const maxAttempts = Math.max(1, Number(job.configuration?.retries ?? DEFAULT_MAX_ATTEMPTS) + 1);
  const throttler = throttlerFor(job.id, job.configuration?.requestsPerSecond ?? 1);
  const started = Date.now();

  const fail = async (message: string, transient: boolean) => {
    if (transient && item.attempts < maxAttempts) {
      const delay = backoffDelay(item.attempts);
      retryAfter.set(item.id, Date.now() + delay);
      await repository.requeueQueueItem(item.id, { message, delayMs: delay });
      log("warning", "Queue item requeued", { jobId: job.id, url: item.url, attempt: item.attempts, delayMs: delay, error: message });
      return;
    }
    await repository.completeQueueItem(item.id, { success: false, message });
    log("error", "Queue item failed", { jobId: job.id, url: item.url, attempts: item.attempts, error: message });
  };

  try {
    const page = await fetchPage(item.url, {
      requestsPerSecond: job.configuration?.requestsPerSecond ?? 1,
      robots,
      throttler,
    });

    const parsed = parsePage(page.html, page.url);
    const text = parsed.text.slice(0, MAX_TEXT_CHARS);

    // Never turn an error page (403, 404, bot wall, ...) into a company: it has
    // no evidence to extract and would pollute the results with junk names.
    const usable = page.status >= 200 && page.status < 400 && !isErrorPageTitle(parsed.title);
    const company = usable
      ? await repository.recordCompanyPage({
          jobId: job.id,
          url: page.url,
          title: parsed.title,
          description: parsed.description,
          text,
        })
      : null;

    if (company) {
      log("info", "Company discovered", { jobId: job.id, company: company.name, domain: company.domain });
    } else if (!usable) {
      log("warning", "Page skipped, not a usable company page", {
        jobId: job.id,
        url: page.url,
        status: page.status,
        title: parsed.title,
      });
    }

    // Only expand crawl frontier for discovery-style jobs, and only within the
    // seed origin, so we never wander across the public internet unbounded.
    let added = 0;
    if (job.targetType !== "url-list") {
      // Never hand the store more links than the job is allowed to hold, so a
      // single page cannot blow past `totalUrls`.
      const budget = job.totalUrls > 0
        ? Math.max(0, job.totalUrls - (job.processedUrls + job.queuedUrls))
        : Number.POSITIVE_INFINITY;
      const discovered = parsed.links
        .filter((url) => sameOrigin(url, item.url))
        .slice(0, Math.min(MAX_LINKS_PER_PAGE, budget));
      if (discovered.length) {
        added = await repository.addQueueItems(job.id, discovered, job.totalUrls || undefined);
      }
    }

    await repository.completeQueueItem(item.id, {
      success: page.status >= 200 && page.status < 400,
      message: `${page.status} ${item.url} · ${added} links discovered · ${Date.now() - started}ms`,
    });

    jobsProcessed += 1;
    log("success", "Queue item completed", { jobId: job.id, url: item.url, status: page.status, added, ms: Date.now() - started });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown crawling error";
    const transient =
      /timeout|timed out|Too many redirects|ECONNRESET|ECONNREFUSED|fetch failed|429|5\d\d /i.test(message) &&
      !/robots|private|loopback|metadata|Unsupported content|Malformed|Unsupported protocol/i.test(message);
    await fail(message, transient);
  } finally {
    currentUrl = null;
    currentJobId = null;
  }
}

/** True when a failure is worth retrying rather than failing permanently. */
export function isTransientError(message: string): boolean {
  if (/robots|private|loopback|metadata|Unsupported content|Malformed|Unsupported protocol/i.test(message)) {
    return false;
  }
  return /timeout|timed out|too many redirects|econnreset|econnrefused|fetch failed|429|503|502|504/i.test(message);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function runJob(repository: IRepository, job: ScraperJob): Promise<boolean> {
  const concurrency = Math.max(1, Math.min(job.workersTotal || 1, 10));

  const claimed: StoredQueueItem[] = [];
  for (let index = 0; index < concurrency; index += 1) {
    if (shuttingDown) break;
    const item = await repository.claimNextQueueItem(job.id);
    if (!item) break;
    claimed.push(item);
  }
  if (!claimed.length) return false;

  await Promise.all(
    claimed.map(async (item) => {
      const cooldown = retryAfter.get(item.id);
      if (cooldown && cooldown > Date.now()) {
        await sleep(cooldown - Date.now());
        retryAfter.delete(item.id);
      }
      await processItem(repository, job, item);
    }),
  );

  await repository.completeJobIfIdle(job.id);
  return true;
}

async function tick(repository: IRepository): Promise<boolean> {
  const jobs = await repository.listStoredJobs();
  const running = jobs.filter((job) => job.status === "running");
  if (!running.length) return false;

  let didWork = false;
  for (const job of running.slice(0, 10)) {
    if (shuttingDown) break;
    try {
      if (await runJob(repository, job)) didWork = true;
    } catch (error) {
      log("error", "Job iteration failed", { jobId: job.id, error: String(error) });
    }
  }
  return didWork;
}

/**
 * The development JSON store has no transactions, so two worker processes
 * reading and rewriting the same file silently lose each other's writes (and
 * can even leave a torn file). PostgreSQL/Redis deployments are safe, so the
 * guard only applies to the JSON backend.
 */
function acquireSingleInstanceLock(): () => void {
  if (isProductionMode()) return () => undefined;

  const lockPath = join(process.cwd(), ".data", "worker.lock");
  mkdirSync(dirname(lockPath), { recursive: true });

  const readOwner = (): number | null => {
    if (!existsSync(lockPath)) return null;
    const raw = readFileSync(lockPath, "utf8").trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) ? pid : null;
  };

  const ownerAlive = (pid: number): boolean => {
    if (pid === process.pid) return true;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  const owner = readOwner();
  if (owner !== null && owner !== process.pid && ownerAlive(owner)) {
    console.error(
      `Another discovery worker is already running (pid ${owner}). ` +
        "The local JSON store cannot be shared between workers - stop it first, " +
        "or configure DATABASE_URL + REDIS_URL to run several workers.",
    );
    process.exit(1);
  }

  writeFileSync(lockPath, String(process.pid));
  const release = () => {
    try {
      if (readOwner() === process.pid) rmSync(lockPath, { force: true });
    } catch {
      // Best effort.
    }
  };
  process.on("exit", release);
  process.on("SIGINT", release);
  process.on("SIGTERM", release);
  return release;
}

async function main(): Promise<void> {
  const releaseLock = acquireSingleInstanceLock();
  const repository = getRepository();
  const config = productionConfig();

  log("info", "Discovery worker started", {
    mode: isProductionMode() ? "postgresql" : "json",
    database: config.databaseUrlConfigured,
    redis: config.redisUrlConfigured,
    queue: config.redisUrlConfigured ? "bullmq" : "local-durable",
    pollMs: POLL_MS,
  });

  let lastHeartbeat = 0;

  while (!shuttingDown) {
    let didWork = false;
    try {
      didWork = await tick(repository);
    } catch (error) {
      log("error", "Worker tick failed", { error: String(error) });
    }

    if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
      lastHeartbeat = Date.now();
      await heartbeat(repository);
    }

    await sleep(didWork ? 50 : POLL_MS);
  }

  await heartbeat(repository);
  await repository.retireWorker?.(WORKER_ID).catch(() => undefined);
  releaseLock();
  log("info", "Discovery worker stopped", { jobsProcessed });
}

function installShutdownHandlers(): void {
  const stop = (signal: string) => {
    if (shuttingDown) return;
    log("info", "Shutdown signal received", { signal, inFlightUrl: currentUrl, inFlightJob: currentJobId });
    shuttingDown = true;
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}

installShutdownHandlers();

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log("error", "Fatal worker error", { error: String(error) });
    process.exit(1);
  });

export { main as runWorker };
