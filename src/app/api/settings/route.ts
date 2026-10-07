export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRepository, isProductionMode } from "@/lib/production/repository";
import { productionConfig } from "@/lib/production/config";
import { isExternalQueue, queueFallbackReason } from "@/lib/production/queue";
import { requireApiUser } from "@/lib/auth/guard";
import { authStatus } from "@/lib/auth/users";
import { configuredSearchProviders, providerStatus } from "@/lib/discovery";
import { siteConfig } from "@/lib/site-config";

/**
 * Read-only projection of how this deployment is configured.
 *
 * Deliberately never returns secret values - only whether a setting is present,
 * so an operator can confirm the environment without leaking credentials.
 */

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const config = productionConfig();
  const { basePath, mainSiteUrl, embeddingAllowed, productName, companyName, supportEmail } =
    siteConfig();
  const dataPath = join(process.cwd(), ".data", "scraper.json");
  const authState = authStatus();

  const counts = {
    jobs: 0,
    companies: 0,
    workflows: 0,
    opportunities: 0,
    campaigns: 0,
  };

  try {
    const repository = getRepository();
    const [jobs, companies, workflows, opportunities, campaigns] = await Promise.all([
      repository.listStoredJobs(),
      repository.listStoredCompanies(),
      repository.listStoredWorkflows(),
      repository.listStoredOpportunities(),
      repository.listStoredCampaigns(),
    ]);
    counts.jobs = jobs.length;
    counts.companies = companies.length;
    counts.workflows = workflows.length;
    counts.opportunities = opportunities.length;
    counts.campaigns = campaigns.length;
  } catch {
    // A settings page that cannot count rows is still useful - report zeroes.
  }

  return NextResponse.json({
    user: auth.user
      ? { email: auth.user.email, name: auth.user.name, role: auth.user.role }
      : null,
    // `auth.user` is null when auth is disabled entirely - the deployment is open.
    deployment: {
      productName,
      companyName,
      supportEmail,
      basePath: basePath || "/",
      mountMode: basePath ? `Sub-path (${basePath})` : "Standalone (owns the domain)",
      mainSiteUrl,
      embeddingAllowed,
      nodeEnv: process.env.NODE_ENV ?? "development",
    },
    storage: {
      backend: isProductionMode() ? "PostgreSQL (Prisma)" : "Local JSON file",
      detail: isProductionMode()
        ? "DATABASE_URL is configured."
        : existsSync(dataPath)
          ? ".data/scraper.json"
          : ".data/scraper.json (not created yet)",
      configured: isProductionMode(),
    },
    queue: {
      backend: isExternalQueue() ? "Redis / BullMQ" : "Durable local file queue",
      configured: config.redisUrlConfigured,
      fallbackReason: queueFallbackReason(),
      workerConcurrency: config.workerConcurrency,
      pollMs: config.pollMs,
    },
    auth: {
      enabled: authState.enabled,
      backend: authState.backend,
      sessionSecretSet: Boolean(process.env.SESSION_SECRET || process.env.AUTH_SECRET),
      cookieSameSite: (process.env.SESSION_COOKIE_SAME_SITE ?? "lax").toLowerCase(),
      sessionTtlHours: 8,
    },
    search: {
      status: providerStatus(),
      providers: configuredSearchProviders(),
    },
    crawler: {
      maxPagesPerJobDefault: 1500,
      requestTimeoutMs: Number(process.env.SCRAPER_REQUEST_TIMEOUT_MS || 15_000),
      maxBodyBytes: 5 * 1024 * 1024,
      robotsRespected: true,
      retriesDefault: 3,
    },
    counts,
    /**
     * External integrations the product does not ship. Listed explicitly so the
     * UI can say "not implemented" instead of implying a CRM sync exists.
     */
    integrations: [
      { name: "Salesforce", status: "NOT IMPLEMENTED" },
      { name: "HubSpot", status: "NOT IMPLEMENTED" },
      { name: "Email / SMTP delivery", status: "NOT IMPLEMENTED" },
      { name: "Slack notifications", status: "NOT IMPLEMENTED" },
      { name: "Webhooks (outbound)", status: "NOT IMPLEMENTED" },
    ],
  });
}
