export type PersistenceMode = "postgresql" | "json" | "unsupported";

export function productionConfig() {
  return {
    isProduction: process.env.NODE_ENV === "production",
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    redisUrlConfigured: Boolean(process.env.REDIS_URL),
    workerConcurrency: Math.max(1, Number(process.env.SCRAPER_WORKER_CONCURRENCY || 5)),
    pollMs: Math.max(250, Number(process.env.SCRAPER_POLL_MS || 1000)),
  };
}

/**
 * Which backend durably stores application data.
 *
 * PostgreSQL whenever `DATABASE_URL` is set; the single-writer JSON file only
 * as a local development convenience. In production there is no fallback: the
 * JSON store has no transactions and is written by two processes at once, so
 * silently using it there would lose data. Callers get `unsupported` and are
 * expected to fail loudly instead (see `getRepository`).
 */
export function persistenceMode(): PersistenceMode {
  const config = productionConfig();
  if (config.databaseUrlConfigured) return "postgresql";
  return config.isProduction ? "unsupported" : "json";
}
