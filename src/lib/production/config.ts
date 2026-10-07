export function productionConfig() {
  return {
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    redisUrlConfigured: Boolean(process.env.REDIS_URL),
    workerConcurrency: Math.max(1, Number(process.env.SCRAPER_WORKER_CONCURRENCY || 5)),
    pollMs: Math.max(250, Number(process.env.SCRAPER_POLL_MS || 1000)),
  };
}
