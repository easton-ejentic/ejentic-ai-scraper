import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { persistenceMode, productionConfig } from "@/lib/production/config";
import { isProductionMode } from "@/lib/production/repository";
import { getQueueStats, isExternalQueue, queueFallbackReason } from "@/lib/production/queue";
import { authStatus } from "@/lib/auth/users";
import { providerStatus } from "@/lib/discovery";

export const dynamic = "force-dynamic";

/**
 * Liveness + configuration probe.
 *
 * Reports the real state of each backing service rather than a flat "ok", so a
 * half-configured deployment is obvious. Always returns 200 - it describes
 * health, it does not gate traffic.
 */
export async function GET() {
  const config = productionConfig();
  const dataPath = join(process.cwd(), ".data", "scraper.json");

  const checks: Record<string, { status: "ok" | "degraded" | "unavailable" | "unconfigured"; detail?: string }> = {
    database: (() => {
      const mode = persistenceMode();
      if (mode === "postgresql") return { status: "ok" as const, detail: "postgresql via prisma" };
      if (mode === "json") {
        return {
          status: "degraded" as const,
          detail: existsSync(dataPath)
            ? "DATABASE_URL not set - using local JSON file (.data/scraper.json)"
            : "DATABASE_URL not set - local JSON file not created yet",
        };
      }
      return {
        status: "unavailable" as const,
        detail:
          "DATABASE_URL is required in production - data writes will fail until it is set",
      };
    })(),
    queue: isExternalQueue()
      ? { status: "ok", detail: "redis / bullmq" }
      : { status: "degraded", detail: queueFallbackReason() ?? "durable local file queue" },
    auth: authStatus().enabled
      ? { status: "ok", detail: `enabled via ${authStatus().backend}` }
      : { status: "unconfigured", detail: "no user accounts configured - dashboard is open" },
    search: (() => {
      const status = providerStatus();
      if (!status.configured) {
        return { status: "unconfigured" as const, detail: "no search provider available" };
      }
      const scraped = status.provider === "duckduckgo" || status.provider === "bing";
      return {
        status: scraped ? ("degraded" as const) : ("ok" as const),
        detail: status.note,
      };
    })(),
  };

  let queueStats: Awaited<ReturnType<typeof getQueueStats>> | null = null;
  try {
    queueStats = await getQueueStats();
  } catch (error) {
    queueStats = null;
    checks.queue = { status: "unavailable", detail: String(error) };
  }

  const degraded = Object.values(checks).some((check) => check.status === "degraded");
  const unavailable = Object.values(checks).some((check) => check.status === "unavailable");

  return NextResponse.json({
    status: unavailable ? "error" : degraded ? "degraded" : "ok",
    service: "ejentic-ai-scraper",
    version: "0.1.0",
    mode: isProductionMode() ? "production" : "development",
    checks,
    queue: queueStats,
    config: {
      workerConcurrency: config.workerConcurrency,
      pollMs: config.pollMs,
      redisConfigured: config.redisUrlConfigured,
      databaseConfigured: config.databaseUrlConfigured,
    },
    timestamp: new Date().toISOString(),
  });
}
