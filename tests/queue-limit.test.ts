import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The worker hands the store up to 50 links at a time. `addQueueItems` used to
 * re-read the job inside its loop while only incrementing `queuedUrls` after the
 * loop, so one page could push a job far past its `totalUrls` budget (a live job
 * with `totalUrls: 30` crawled 62 pages). These tests pin the cap down.
 */
const originalCwd = process.cwd();
let tempDir: string;
type Store = typeof import("../src/lib/scraper/persistent-store");
let store: Store;

function urls(prefix: string, count: number) {
  return Array.from({ length: count }, (_unused, index) => `https://${prefix}.example.com/page-${index}`);
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "ejentic-queue-"));
  process.chdir(tempDir);
  store = await import("../src/lib/scraper/persistent-store");
}, 60_000);

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

describe("addQueueItems respects the job URL budget", () => {
  it("never adds more URLs than totalUrls allows, even in one large batch", () => {
    const job = store.createStoredJob(
      {
        name: "cap test",
        targetType: "url-list",
        urlLimit: 10,
        sources: { websites: true, search: false, directories: false, social: false },
        configuration: { workers: 1, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
      },
      ["https://seed.example.com"],
    );

    // One seed URL is already queued, so only 9 more may fit.
    const added = store.addQueueItems(job.id, urls("big", 50), 10);

    expect(added).toBe(9);
    const stored = store.getStoredJob(job.id);
    expect(stored?.queuedUrls).toBe(10);
  });

  it("stops adding once the budget is exhausted", () => {
    const job = store.createStoredJob(
      {
        name: "cap test exhausted",
        targetType: "url-list",
        urlLimit: 5,
        sources: { websites: true, search: false, directories: false, social: false },
        configuration: { workers: 1, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
      },
      urls("seed", 5),
    );

    expect(store.addQueueItems(job.id, urls("extra", 20), 5)).toBe(0);
    expect(store.getStoredJob(job.id)?.queuedUrls).toBe(5);
  });

  it("accounts for URLs already processed, not just queued ones", () => {
    const job = store.createStoredJob(
      {
        name: "cap test processed",
        targetType: "url-list",
        urlLimit: 6,
        sources: { websites: true, search: false, directories: false, social: false },
        configuration: { workers: 1, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
      },
      urls("seed", 6),
    );

    // Crawl four of the six seeded pages: processedUrls 4, queuedUrls 2.
    const queued = store.listStoredQueue().filter((item) => item.jobId === job.id);
    for (const item of queued.slice(0, 4)) {
      store.completeQueueItem(item.id, { success: true, message: "ok" });
    }

    const afterCrawl = store.getStoredJob(job.id);
    expect(afterCrawl?.processedUrls).toBe(4);
    expect(afterCrawl?.queuedUrls).toBe(2);

    expect(store.addQueueItems(job.id, urls("more", 30), 6)).toBe(0);
  });

  it("counts URLs added earlier in the same call against the budget", () => {
    const job = store.createStoredJob(
      {
        name: "cap test partial",
        targetType: "url-list",
        urlLimit: 4,
        sources: { websites: true, search: false, directories: false, social: false },
        configuration: { workers: 1, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
      },
      ["https://seed.example.com"],
    );

    const added = store.addQueueItems(job.id, urls("partial", 40), 4);

    expect(added).toBe(3);
    expect(store.getStoredJob(job.id)?.queuedUrls).toBe(4);
  });

  it("adds the full batch when no budget is supplied", () => {
    const job = store.createStoredJob(
      {
        name: "cap test unlimited",
        targetType: "url-list",
        urlLimit: 10,
        sources: { websites: true, search: false, directories: false, social: false },
        configuration: { workers: 1, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
      },
      ["https://seed.example.com"],
    );

    expect(store.addQueueItems(job.id, urls("free", 12))).toBe(12);
  });

  it("does not re-add the same URL twice", () => {
    const job = store.createStoredJob(
      {
        name: "cap test duplicates",
        targetType: "url-list",
        urlLimit: 20,
        sources: { websites: true, search: false, directories: false, social: false },
        configuration: { workers: 1, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
      },
      ["https://dupe.example.com"],
    );

    expect(store.addQueueItems(job.id, ["https://dupe.example.com", "https://other.example.com"], 20)).toBe(1);
  });
});
