export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRepository, isProductionMode } from "@/lib/production/repository";
import { productionConfig } from "@/lib/production/config";
import { requireApiUser } from "@/lib/auth/guard";
import { configuredSearchProviders } from "@/lib/discovery";

/**
 * Single round trip that backs the dashboard.
 *
 * The dashboard is a read-only projection over the same repository the crawler
 * writes to - it never crawls, so it is safe to call as often as the page needs.
 */

const OPPORTUNITY_STATUSES = ["new", "reviewing", "qualified", "outreach", "won", "lost"] as const;
type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

function statusCounts(opportunities: { status: string }[]): Record<OpportunityStatus, number> {
  const counts = Object.fromEntries(
    OPPORTUNITY_STATUSES.map((status) => [status, 0]),
  ) as Record<OpportunityStatus, number>;
  for (const opportunity of opportunities) {
    if (opportunity.status in counts) counts[opportunity.status as OpportunityStatus] += 1;
  }
  return counts;
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  try {
    const repository = getRepository();

    const [jobs, companies, workflows, opportunities, logs, campaigns] = await Promise.all([
      repository.listStoredJobs(),
      repository.listStoredCompanies(),
      repository.listStoredWorkflows(),
      repository.listStoredOpportunities(),
      repository.listStoredLogs(),
      repository.listStoredCampaigns(),
    ]);

    const running = jobs.filter((job) => job.status === "running").length;
    const completed = jobs.filter((job) => job.status === "completed").length;
    const pagesCrawled = jobs.reduce((total, job) => total + (job.processedUrls ?? 0), 0);
    const successfulPages = jobs.reduce((total, job) => total + (job.successfulUrls ?? 0), 0);

    const scored = opportunities.filter((item) => typeof item.score === "number");
    const averageScore = scored.length
      ? scored.reduce((total, item) => total + item.score, 0) / scored.length
      : 0;

    const qualified = opportunities.filter((item) =>
      ["qualified", "outreach", "won"].includes(item.status),
    ).length;

    const topOpportunities = opportunities
      .slice()
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        companyName: item.companyName,
        workflowName: item.workflowName,
        title: item.title,
        score: item.score,
        confidence: item.confidence,
        status: item.status,
      }));

    const recentJobs = jobs
      .slice()
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 6)
      .map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        targetLabel: job.targetLabel,
        processedUrls: job.processedUrls ?? 0,
        totalUrls: job.totalUrls ?? 0,
        createdAt: job.createdAt,
        campaignId: job.campaignId ?? null,
      }));

    const recentActivity = logs
      .slice()
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 8)
      .map((log) => ({
        id: log.id,
        level: log.level,
        message: log.message,
        jobId: log.jobId,
        createdAt: log.createdAt,
      }));

    const config = productionConfig();

    return NextResponse.json({
      stats: {
        campaigns: campaigns.length,
        jobs: jobs.length,
        jobsRunning: running,
        jobsCompleted: completed,
        companies: companies.length,
        pagesCrawled,
        successfulPages,
        workflows: workflows.length,
        opportunities: opportunities.length,
        qualified,
        averageScore: Number(averageScore.toFixed(1)),
        evaluatedWorkflows: workflows.filter((workflow) => workflow.evaluation).length,
      },
      pipeline: {
        jobs: jobs.length,
        companies: companies.length,
        workflows: workflows.length,
        opportunities: opportunities.length,
        qualified,
      },
      opportunityStatus: statusCounts(opportunities),
      topOpportunities,
      recentJobs,
      recentActivity,
      system: {
        storage: isProductionMode() ? "PostgreSQL" : "Local JSON (.data/scraper.json)",
        queue: config.redisUrlConfigured ? "BullMQ (Redis)" : "Durable local queue",
        workerConcurrency: config.workerConcurrency,
        searchProviders: configuredSearchProviders(),
      },
    });
  } catch (error) {
    console.error("Error building overview:", error);
    return NextResponse.json({ error: "Failed to build overview" }, { status: 500 });
  }
}
