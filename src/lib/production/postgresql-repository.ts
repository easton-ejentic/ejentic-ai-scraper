/**
 * PostgreSQL Repository - Production implementation using Prisma
 * Used when DATABASE_URL is configured
 */

import { randomUUID } from "node:crypto";
import type {
  ContactEnquiryDraft,
  ContactEnquiryRecord,
  IRepository,
  StoredEvidence,
  WorkerRecord,
} from "./repository";
import { prisma } from "./db";
import type { Job as PrismaJob } from "@prisma/client";
import type { TargetType as PrismaTargetType } from "@prisma/client";
import type { JobStatus, JobDraft, ScraperJob, TargetType } from "@/lib/scraper/job-types";
import type { StoredQueueItem, StoredLog, QueueViewItem } from "@/lib/scraper/persistent-store";
import type { CompanyRecord, CompanyPageRecord } from "@/lib/research/company";
import type { WorkflowRecord } from "@/lib/research/workflow";
import type { OpportunityRecord } from "@/lib/research/opportunity";
import {
  normaliseCampaignDraft,
  normaliseCampaignPatch,
  slugifyCampaignId,
  type CampaignRecord,
  type CampaignSummary,
} from "@/lib/research/campaign";
import { companyFromPage, extractEvidence, isErrorPageTitle } from "@/lib/research/company";
import { targetLabelFor } from "@/lib/scraper/resolve-target";
import {
  deriveOpportunity,
  deriveWorkflows,
  evaluationFor,
} from "@/lib/research/pipeline";

/**
 * Prisma hands back `Json` columns as an opaque value and timestamps as `Date`,
 * while the domain types use plain arrays and ISO strings. These keep the
 * conversion in one place instead of `as any` at every call site.
 */
function jsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * The Prisma `TargetType` enum spells the URL-list variant `url_list`, while the
 * domain type used everywhere else spells it `url-list`. These two maps are the
 * only place that difference is reconciled, so a value round-trips unchanged.
 */
const PRISMA_TARGET_TYPE: Record<TargetType, PrismaTargetType> = {
  campaign: "campaign",
  "url-list": "url_list",
  domain: "domain",
  search: "search",
};

const DOMAIN_TARGET_TYPE: Record<PrismaTargetType, TargetType> = {
  campaign: "campaign",
  url_list: "url-list",
  domain: "domain",
  search: "search",
};

function jsonValue<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * PostgreSQL repository implementation
 * All methods are async and use Prisma for database access
 */
export class PostgreSQLRepository implements IRepository {
  // ==================
  // CAMPAIGNS
  // ==================

  async listStoredCampaigns(): Promise<CampaignSummary[]> {
    const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
    const summaries = await Promise.all(
      campaigns.map((campaign) => this.summariseCampaign(this.campaignToDomain(campaign))),
    );
    return summaries;
  }

  async getStoredCampaign(id: string): Promise<CampaignSummary | undefined> {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return undefined;
    return this.summariseCampaign(this.campaignToDomain(campaign));
  }

  async createStoredCampaign(input: unknown): Promise<CampaignRecord> {
    const draft = normaliseCampaignDraft(input);
    const created = await prisma.campaign.create({
      data: {
        id: slugifyCampaignId(draft.name),
        name: draft.name,
        description: draft.description ?? null,
        industry: draft.industry ?? null,
        region: draft.region ?? null,
      },
    });
    return this.campaignToDomain(created);
  }

  async updateStoredCampaign(id: string, patch: unknown): Promise<CampaignRecord | undefined> {
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return undefined;
    const changes = normaliseCampaignPatch(patch);
    const updated = await prisma.campaign.update({ where: { id }, data: changes });
    return this.campaignToDomain(updated);
  }

  async deleteStoredCampaign(id: string): Promise<boolean> {
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return false;
    // Jobs are detached rather than deleted - the crawl evidence outlives the
    // container it was filed under.
    await prisma.campaign.delete({ where: { id } });
    return true;
  }

  private campaignToDomain(campaign: {
    id: string;
    name: string;
    description: string | null;
    industry: string | null;
    region: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CampaignRecord {
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      industry: campaign.industry,
      region: campaign.region,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }

  private async summariseCampaign(campaign: CampaignRecord): Promise<CampaignSummary> {
    const jobs = await prisma.job.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, startedAt: true, createdAt: true, completedAt: true },
    });
    const jobIds = jobs.map((job) => job.id);

    const companies = await prisma.company.findMany({
      where: { campaignId: campaign.id },
      select: { id: true },
    });

    const workflows = await prisma.workflow.findMany({
      where: { campaignId: campaign.id },
      select: { id: true },
    });
    const workflowIds = workflows.map((workflow) => workflow.id);

    const opportunities = workflowIds.length
      ? await prisma.opportunity.findMany({
          where: { workflowId: { in: workflowIds } },
          select: { id: true, score: true, status: true },
        })
      : [];

    const timestamps = [
      ...jobs.map((job) => (job.completedAt ?? job.startedAt ?? job.createdAt).toISOString()),
      campaign.updatedAt,
    ];

    return {
      ...campaign,
      jobIds,
      companyIds: companies.map((company) => company.id),
      workflowIds,
      opportunityIds: opportunities.map((item) => item.id),
      jobCount: jobIds.length,
      companyCount: companies.length,
      workflowCount: workflowIds.length,
      opportunityCount: opportunities.length,
      qualifiedCount: opportunities.filter((item) =>
        ["qualified", "outreach", "won"].includes(item.status),
      ).length,
      topScore: opportunities.length
        ? Math.max(...opportunities.map((item) => item.score))
        : null,
      lastActivityAt: timestamps.length
        ? timestamps.slice().sort((a, b) => b.localeCompare(a))[0]
        : null,
    };
  }

  // ==================
  // JOBS
  // ==================

  async listStoredJobs(): Promise<ScraperJob[]> {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
    });

    return jobs.map(this.jobToDomain);
  }

  async getStoredJob(id: string): Promise<ScraperJob | undefined> {
    const job = await prisma.job.findUnique({ where: { id } });
    return job ? this.jobToDomain(job) : undefined;
  }

  async createStoredJob(draft: JobDraft, queueUrls: string[]): Promise<ScraperJob> {
    const now = new Date();

    // Generate ID
    const lastJob = await prisma.job.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    const lastNum = lastJob ? parseInt(lastJob.id.replace(/\D/g, "")) : 1041;
    const id = `job-${lastNum + 1}`;

    // Create job
    const job = await prisma.job.create({
      data: {
        id,
        name: draft.name,
        status: "running",
        campaignId: draft.campaignId?.trim() || null,
        targetType: PRISMA_TARGET_TYPE[draft.targetType],
        targetLabel: this.generateTargetLabel(draft, queueUrls),
        totalUrls: draft.urlLimit,
        processedUrls: 0,
        successfulUrls: 0,
        queuedUrls: queueUrls.length,
        workersActive: Math.min(draft.configuration.workers, 10),
        workersTotal: draft.configuration.workers,
        errorRate: 0,
        sources: JSON.stringify(this.generateSources(draft)),
        configuration: JSON.stringify(draft.configuration),
        createdAt: now,
        startedAt: now,
      },
    });

    // Add queue items
    for (const url of queueUrls.slice(0, draft.urlLimit)) {
      const normalized = this.normalizeUrl(url);
      if (!normalized) continue;

      await prisma.queueItem.upsert({
        where: { jobId_normalizedUrl: { jobId: id, normalizedUrl: normalized } },
        create: {
          id: `${id}:${Buffer.from(normalized).toString("base64url")}`,
          jobId: id,
          url,
          normalizedUrl: normalized,
          status: "queued",
          attempts: 0,
          discoveredAt: now,
        },
        update: {},
      });
    }

    // Add log
    await prisma.activityLog.create({
      data: {
        id: `${id}:created:${now.getTime()}`,
        jobId: id,
        level: "info",
        message: `Job created with ${queueUrls.length} initial URL${queueUrls.length === 1 ? "" : "s"}.`,
        createdAt: now,
      },
    });

    return this.jobToDomain(job);
  }

  async updateStoredJobStatus(
    id: string,
    action: "pause" | "resume" | "cancel",
  ): Promise<ScraperJob | undefined> {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return undefined;

    const transitions = {
      pause: { from: ["running"], to: "paused" as const },
      resume: { from: ["paused", "queued"], to: "running" as const },
      cancel: { from: ["running", "paused", "queued"], to: "cancelled" as const },
    };

    const rule = transitions[action];
    if (!rule.from.includes(job.status)) return undefined;

    const now = new Date();
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: rule.to,
        startedAt: action === "resume" && !job.startedAt ? now : job.startedAt,
        workersActive: action === "pause" || action === "cancel" ? 0 : job.workersActive,
      },
    });

    // Add log
    await prisma.activityLog.create({
      data: {
        id: `${id}:${action}:${now.getTime()}`,
        jobId: id,
        level: action === "cancel" ? "error" : "info",
        message: `Job ${action}d.`,
        createdAt: now,
      },
    });

    // Cancel queue items if cancelling
    if (action === "cancel") {
      await prisma.queueItem.updateMany({
        where: { jobId: id, status: { in: ["queued", "processing"] } },
        data: { status: "failed", processedAt: now },
      });
    }

    return this.jobToDomain(updated);
  }

  // ==================
  // QUEUE
  // ==================

  async claimNextQueueItem(jobId: string): Promise<StoredQueueItem | undefined> {
    // Get next item
    const item = await prisma.queueItem.findFirst({
      where: { jobId, status: "queued" },
      orderBy: { discoveredAt: "asc" },
    });

    if (!item) return undefined;

    // Update item
    const updated = await prisma.queueItem.update({
      where: { id: item.id },
      data: { status: "processing", attempts: item.attempts + 1 },
    });

    // Update job
    await prisma.job.update({
      where: { id: jobId },
      data: { workersActive: { increment: 1 } },
    });

    return {
      id: updated.id,
      jobId: updated.jobId,
      url: updated.url,
      normalizedUrl: updated.normalizedUrl,
      status: updated.status as StoredQueueItem["status"],
      attempts: updated.attempts,
      discoveredAt: updated.discoveredAt.toISOString(),
      processedAt: updated.processedAt?.toISOString(),
    };
  }

  async completeQueueItem(itemId: string, data: { success: boolean; message: string }): Promise<void> {
    const item = await prisma.queueItem.findUnique({ where: { id: itemId } });
    if (!item) return;

    const now = new Date();

    // Update item
    await prisma.queueItem.update({
      where: { id: itemId },
      data: { status: data.success ? "completed" : "failed", processedAt: now },
    });

    // Update job stats
    const job = await prisma.job.findUnique({ where: { id: item.jobId } });
    if (job) {
      const newSuccessful = data.success ? job.successfulUrls + 1 : job.successfulUrls;
      const newProcessed = job.processedUrls + 1;
      const newErrorRate =
        newProcessed > 0 ? Number((((newProcessed - newSuccessful) / newProcessed) * 100).toFixed(1)) : 0;

      await prisma.job.update({
        where: { id: item.jobId },
        data: {
          processedUrls: newProcessed,
          successfulUrls: newSuccessful,
          queuedUrls: Math.max(0, job.queuedUrls - 1),
          errorRate: newErrorRate,
          workersActive: Math.max(0, job.workersActive - 1),
        },
      });
    }

    // Add log
    await prisma.activityLog.create({
      data: {
        id: `${item.jobId}:item:${now.getTime()}`,
        jobId: item.jobId,
        level: data.success ? "info" : "error",
        message: data.message,
        createdAt: now,
      },
    });
  }

  async requeueQueueItem(itemId: string, data: { message: string; delayMs: number }): Promise<void> {
    const item = await prisma.queueItem.findUnique({ where: { id: itemId } });
    if (!item) return;

    await prisma.queueItem.update({
      where: { id: itemId },
      data: { status: "queued", processedAt: null },
    });

    await prisma.job.update({
      where: { id: item.jobId },
      data: { workersActive: { decrement: 1 } },
    }).catch(() => undefined);

    await prisma.activityLog.create({
      data: {
        id: `${item.jobId}:retry:${Date.now()}:${item.id}`,
        jobId: item.jobId,
        level: "warning",
        message: `${data.message} · retry scheduled in ${data.delayMs}ms (attempt ${item.attempts})`,
        createdAt: new Date(),
      },
    });
  }

  async addQueueItems(jobId: string, urls: string[], maxTotal?: number): Promise<number> {
    let added = 0;
    const now = new Date();
    const job = await prisma.job.findUnique({ where: { id: jobId } });

    // `queuedUrls` is only incremented once, after this loop, so re-reading the
    // job inside the loop would let a single large batch sail past the job's
    // `totalUrls` budget. Track the running total locally instead.
    let used = job ? job.processedUrls + job.queuedUrls : 0;

    for (const url of urls) {
      if (maxTotal && used >= maxTotal) break;

      const normalized = this.normalizeUrl(url);
      if (!normalized) continue;

      try {
        await prisma.queueItem.upsert({
          where: { jobId_normalizedUrl: { jobId, normalizedUrl: normalized } },
          create: {
            id: `${jobId}:${Buffer.from(normalized).toString("base64url")}`,
            jobId,
            url,
            normalizedUrl: normalized,
            status: "queued",
            attempts: 0,
            discoveredAt: now,
          },
          update: {},
        });
        added++;
        used++;
      } catch {
        // Item already exists, skip
      }
    }

    if (added > 0) {
      await prisma.job.update({
        where: { id: jobId },
        data: { queuedUrls: { increment: added } },
      });
    }

    return added;
  }

  async completeJobIfIdle(jobId: string): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "running") return;

    const remaining = await prisma.queueItem.findFirst({
      where: { jobId, status: { in: ["queued", "processing"] } },
    });

    if (!remaining) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "completed", workersActive: 0, queuedUrls: 0 },
      });
    }
  }

  async listStoredLogs(jobId?: string): Promise<StoredLog[]> {
    const logs = await prisma.activityLog.findMany({
      where: jobId ? { jobId } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return logs.map((log) => ({
      id: log.id,
      jobId: log.jobId,
      level: (log.level as "info" | "warning" | "error" | "success") || "info",
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async listStoredQueue(): Promise<QueueViewItem[]> {
    const items = await prisma.queueItem.findMany({
      where: { status: { not: "completed" } },
      orderBy: { discoveredAt: "asc" },
    });

    const jobs = await prisma.job.findMany();
    const jobMap = new Map(jobs.map((j) => [j.id, j]));

    return items.map((item) => ({
      id: item.id,
      url: item.url,
      jobId: item.jobId,
      jobName: jobMap.get(item.jobId)?.name ?? item.jobId,
      priority: 1,
      attempts: item.attempts,
      status: (item.status === "queued" ? "pending" : item.status) as
        | "pending"
        | "processing"
        | "failed",
      enqueuedAt: item.discoveredAt.toISOString(),
    }));
  }

  // ==================
  // COMPANIES
  // ==================

  async recordCompanyPage(input: {
    jobId: string;
    url: string;
    title: string | null;
    description: string | null;
    text: string;
  }): Promise<CompanyRecord | null> {
    const now = new Date();
    const company = companyFromPage(input.url, input.title);
    if (!company) return null;

    // Find or create company
    let stored = await prisma.company.findFirst({
      where: { domain: company.domain },
    });

    if (!stored) {
      stored = await prisma.company.create({
        data: {
          id: `company-${Buffer.from(company.domain).toString("base64url")}`,
          name: company.name,
          domain: company.domain,
          website: company.website,
          description: input.description,
          firstSeenAt: now,
          lastSeenAt: now,
          jobIds: JSON.stringify([input.jobId]),
        },
      });
    } else {
      const jobIds = jsonArray<string>(stored.jobIds);
      if (!jobIds.includes(input.jobId)) jobIds.push(input.jobId);

      await prisma.company.update({
        where: { id: stored.id },
        data: {
          lastSeenAt: now,
          // A company first met through a blocked page keeps the error title
          // until a real page is crawled - repair the name then.
          name: isErrorPageTitle(stored.name) ? company.name : stored.name,
          description:
            input.description && (!stored.description || input.url === stored.website)
              ? input.description
              : stored.description,
          jobIds: JSON.stringify(jobIds),
        },
      });
    }

    // Create page
    const page = await prisma.companyPage.create({
      data: {
        id: `${stored.id}:${Buffer.from(input.url).toString("base64url")}`,
        companyId: stored.id,
        jobId: input.jobId,
        url: input.url,
        title: input.title,
        description: input.description,
        text: input.text.slice(0, 100_000),
        crawledAt: now,
      },
    });

    // Extract evidence
    const pageEvidence = extractEvidence(input.text);
    for (const item of pageEvidence) {
      await prisma.evidence.create({
        data: {
          id: `${page.id}:${item.label}`,
          companyId: stored.id,
          jobId: input.jobId,
          url: input.url,
          label: item.label,
          excerpt: item.excerpt,
          createdAt: now,
        },
      });
    }

    await this.syncWorkflowsForCompany({
      companyId: stored.id,
      companyName: stored.name,
      jobId: input.jobId,
      url: input.url,
      text: input.text,
      evidenceIds: pageEvidence.map((item) => `${page.id}:${item.label}`),
    });

    return this.companyRowToDomain(stored);
  }

  /**
   * Derive, store and score the workflows implied by one freshly crawled page,
   * then bring that company's opportunities back in line with them.
   *
   * Uses the same shared derivation as the JSON store (see
   * `research/pipeline.ts`), so a page scored under either backend yields the
   * same workflows and the same scores.
   */
  private async syncWorkflowsForCompany(input: {
    companyId: string;
    companyName: string;
    jobId: string;
    url: string;
    text: string;
    evidenceIds: string[];
  }): Promise<void> {
    const now = new Date();
    const existingRows = await prisma.workflow.findMany({
      where: { companyId: input.companyId },
    });

    const { create, update } = deriveWorkflows({
      companyId: input.companyId,
      companyName: input.companyName,
      jobId: input.jobId,
      url: input.url,
      text: input.text,
      evidenceIds: input.evidenceIds,
      existing: existingRows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        companyName: row.companyName,
        jobId: row.jobId,
        name: row.name,
        description: row.description,
        category: row.category,
        confidence: row.confidence,
        signals: jsonArray(row.signals),
        evidenceIds: jsonArray<string>(row.evidenceIds),
        sourceUrls: jsonArray<string>(row.sourceUrls),
      })),
      now: now.toISOString(),
    });

    for (const workflow of create) {
      await prisma.workflow.upsert({
        where: { id: workflow.id },
        create: {
          id: workflow.id,
          companyId: workflow.companyId,
          companyName: workflow.companyName,
          jobId: workflow.jobId,
          name: workflow.name,
          category: workflow.category,
          description: workflow.description,
          confidence: workflow.confidence,
          signals: JSON.stringify(workflow.signals),
          evidenceIds: JSON.stringify(workflow.evidenceIds),
          sourceUrls: JSON.stringify(workflow.sourceUrls),
          evaluation: JSON.stringify(workflow.evaluation),
          firstSeenAt: now,
          lastSeenAt: now,
        },
        // The unique constraint is (companyId, name) but upsert targets the id;
        // a concurrent crawl of the same page can race here, so re-apply
        // rather than failing the whole page.
        update: {
          confidence: workflow.confidence,
          evidenceIds: JSON.stringify(workflow.evidenceIds),
          sourceUrls: JSON.stringify(workflow.sourceUrls),
          evaluation: JSON.stringify(workflow.evaluation),
          lastSeenAt: now,
        },
      });
    }

    for (const workflow of update) {
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          confidence: workflow.confidence,
          evidenceIds: JSON.stringify(workflow.evidenceIds),
          sourceUrls: JSON.stringify(workflow.sourceUrls),
          evaluation: JSON.stringify(workflow.evaluation),
          lastSeenAt: now,
        },
      });
    }

    await this.syncOpportunitiesForCompany(input.companyId);
  }

  /**
   * Re-generate every opportunity for one company.
   *
   * Workflows without an evaluation are scored first. A status a human set is
   * preserved - regenerating must never silently undo a review decision.
   */
  private async syncOpportunitiesForCompany(companyId: string): Promise<void> {
    const rows = await prisma.workflow.findMany({ where: { companyId } });

    for (const workflow of rows.map((row) => this.workflowRowToDomain(row))) {
      const existing = await prisma.opportunity.findUnique({
        where: { workflowId: workflow.id },
      });

      const generated = deriveOpportunity(
        workflow,
        existing
          ? { id: existing.id, status: existing.status as never, createdAt: iso(existing.createdAt) }
          : null,
      );
      if (!generated) continue;

      await this.upsertOpportunity(generated, Boolean(existing));
    }
  }

  /**
   * Convert a Prisma workflow row into the domain record.
   *
   * A row that has never been scored is evaluated on the way out rather than
   * returned unevaluated, because `generateOpportunity` refuses to build an
   * opportunity from an unscored workflow - without this, workflows written by
   * an older run would silently produce no opportunities at all.
   */
  /**
   * The Prisma `Company` row has no `pages` column - pages live in a separate
   * table and are only loaded by callers that need them. Domain records require
   * the array, so callers that have not fetched pages get an empty one rather
   * than an `undefined` that would break `.length` / `.map()` downstream.
   */
  private companyRowToDomain(
    row: {
      id: string;
      name: string;
      domain: string;
      website: string;
      description: string | null;
      pageCount: number;
      jobIds: unknown;
      firstSeenAt: Date | string;
      lastSeenAt: Date | string;
    },
    pages: CompanyPageRecord[] = [],
  ): CompanyRecord {
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      website: row.website,
      description: row.description,
      pageCount: row.pageCount,
      jobIds: jsonArray<string>(row.jobIds),
      firstSeenAt: iso(row.firstSeenAt),
      lastSeenAt: iso(row.lastSeenAt),
      pages,
    };
  }

  private workflowRowToDomain(row: {
    id: string;
    companyId: string;
    companyName: string;
    jobId: string;
    name: string;
    description: string;
    category: string;
    confidence: number;
    signals: unknown;
    evidenceIds: unknown;
    sourceUrls: unknown;
    firstSeenAt: Date | string;
    lastSeenAt: Date | string;
    evaluation?: unknown;
  }): WorkflowRecord {
    const workflow: WorkflowRecord = {
      id: row.id,
      companyId: row.companyId,
      companyName: row.companyName,
      jobId: row.jobId,
      name: row.name,
      description: row.description,
      category: row.category,
      confidence: row.confidence,
      signals: jsonArray<WorkflowRecord["signals"][number]>(row.signals),
      evidenceIds: jsonArray<string>(row.evidenceIds),
      sourceUrls: jsonArray<string>(row.sourceUrls),
      firstSeenAt: iso(row.firstSeenAt),
      lastSeenAt: iso(row.lastSeenAt),
      evaluation: jsonValue<WorkflowRecord["evaluation"]>(row.evaluation),
    };

    if (!workflow.evaluation) workflow.evaluation = evaluationFor(workflow);
    return workflow;
  }

  private opportunityRowToDomain(row: {
    id: string;
    workflowId: string;
    companyId: string;
    companyName: string;
    workflowName: string;
    title: string;
    summary: string;
    agentConcept: string;
    capabilities: unknown;
    humanInvolvement: string;
    implementationNotes: unknown;
    risks: unknown;
    evidenceIds: unknown;
    sourceUrls: unknown;
    score: number;
    confidence: number;
    status: unknown;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): OpportunityRecord {
    return {
      id: row.id,
      workflowId: row.workflowId,
      companyId: row.companyId,
      companyName: row.companyName,
      workflowName: row.workflowName,
      title: row.title,
      summary: row.summary,
      agentConcept: row.agentConcept,
      capabilities: jsonArray<string>(row.capabilities),
      humanInvolvement: row.humanInvolvement,
      implementationNotes: jsonArray<string>(row.implementationNotes),
      risks: jsonArray<string>(row.risks),
      evidenceIds: jsonArray<string>(row.evidenceIds),
      sourceUrls: jsonArray<string>(row.sourceUrls),
      score: row.score,
      confidence: row.confidence,
      status: String(row.status) as OpportunityRecord["status"],
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private async upsertOpportunity(
    opportunity: OpportunityRecord,
    exists: boolean,
  ): Promise<void> {
    const data = {
      companyId: opportunity.companyId,
      companyName: opportunity.companyName,
      workflowName: opportunity.workflowName,
      title: opportunity.title,
      summary: opportunity.summary,
      agentConcept: opportunity.agentConcept,
      capabilities: JSON.stringify(opportunity.capabilities),
      humanInvolvement: opportunity.humanInvolvement,
      implementationNotes: JSON.stringify(opportunity.implementationNotes),
      risks: JSON.stringify(opportunity.risks),
      evidenceIds: JSON.stringify(opportunity.evidenceIds),
      sourceUrls: JSON.stringify(opportunity.sourceUrls),
      score: opportunity.score,
      confidence: opportunity.confidence,
      status: opportunity.status as never,
      updatedAt: new Date(),
    };

    if (exists) {
      await prisma.opportunity.update({ where: { id: opportunity.id }, data });
      return;
    }

    await prisma.opportunity.upsert({
      where: { id: opportunity.id },
      create: {
        ...data,
        id: opportunity.id,
        workflowId: opportunity.workflowId,
        createdAt: new Date(opportunity.createdAt),
      },
      update: data,
    });
  }

  async listStoredCompanies(): Promise<CompanyRecord[]> {
    const companies = await prisma.company.findMany({
      orderBy: { lastSeenAt: "desc" },
    });
    return companies.map((row) => this.companyRowToDomain(row));
  }

  async getStoredCompany(
    id: string,
  ): Promise<{ company: CompanyRecord; evidence: StoredEvidence[] } | undefined> {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return undefined;

    const evidence = await prisma.evidence.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { company: this.companyRowToDomain(company), evidence };
  }

  // ==================
  // WORKFLOWS
  // ==================

  async listStoredWorkflows(): Promise<WorkflowRecord[]> {
    const workflows = await prisma.workflow.findMany({
      orderBy: [{ confidence: "desc" }, { lastSeenAt: "desc" }],
    });

    return workflows.map((row) => this.workflowRowToDomain(row));
  }

  async getStoredWorkflow(
    id: string,
  ): Promise<{ workflow: WorkflowRecord; evidence: StoredEvidence[] } | undefined> {
    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return undefined;

    const evidence = await prisma.evidence.findMany({
      where: { id: { in: jsonArray<string>(workflow.evidenceIds) } },
    });

    return { workflow: this.workflowRowToDomain(workflow), evidence };
  }

  async evaluateStoredWorkflow(id: string): Promise<WorkflowRecord | undefined> {
    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return undefined;

    const evaluation = evaluationFor({
      name: workflow.name,
      description: workflow.description,
      confidence: workflow.confidence,
      signals: jsonArray(workflow.signals),
      evidenceIds: jsonArray<string>(workflow.evidenceIds),
      sourceUrls: jsonArray<string>(workflow.sourceUrls),
    });

    await prisma.workflow.update({
      where: { id },
      data: { evaluation: JSON.stringify(evaluation) },
    });

    return this.workflowRowToDomain({ ...workflow, evaluation: JSON.stringify(evaluation) });
  }

  async evaluateAllStoredWorkflows(): Promise<WorkflowRecord[]> {
    const workflows = await prisma.workflow.findMany();

    return Promise.all(
      workflows.map(async (workflow) => {
        const evaluation = evaluationFor({
          name: workflow.name,
          description: workflow.description,
          confidence: workflow.confidence,
          signals: jsonArray(workflow.signals),
          evidenceIds: jsonArray<string>(workflow.evidenceIds),
          sourceUrls: jsonArray<string>(workflow.sourceUrls),
        });

        await prisma.workflow.update({
          where: { id: workflow.id },
          data: { evaluation: JSON.stringify(evaluation) },
        });

        return this.workflowRowToDomain({ ...workflow, evaluation: JSON.stringify(evaluation) });
      }),
    );
  }

  // ==================
  // OPPORTUNITIES
  // ==================

  async listStoredOpportunities(): Promise<OpportunityRecord[]> {
    const opportunities = await prisma.opportunity.findMany({
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    });

    return opportunities.map((row) => this.opportunityRowToDomain(row));
  }

  async generateAllStoredOpportunities(): Promise<OpportunityRecord[]> {
    const rows = await prisma.workflow.findMany();

    for (const workflow of rows.map((row) => this.workflowRowToDomain(row))) {
      const existing = await prisma.opportunity.findUnique({
        where: { workflowId: workflow.id },
      });

      const generated = deriveOpportunity(
        workflow,
        existing
          ? { id: existing.id, status: existing.status as never, createdAt: iso(existing.createdAt) }
          : null,
      );
      if (!generated) continue;

      await this.upsertOpportunity(generated, Boolean(existing));
    }

    return this.listStoredOpportunities();
  }

  async getStoredOpportunity(id: string): Promise<OpportunityRecord | undefined> {
    const opportunity = await prisma.opportunity.findUnique({ where: { id } });
    return opportunity ? this.opportunityRowToDomain(opportunity) : undefined;
  }

  async updateOpportunityStatus(
    id: string,
    status: OpportunityRecord["status"],
  ): Promise<OpportunityRecord | undefined> {
    const updated = await prisma.opportunity.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });

    return this.opportunityRowToDomain(updated);
  }

  // ==================
  // WORKER LIVENESS
  // ==================

  async upsertWorkerHeartbeat(heartbeat: import("./repository").WorkerHeartbeat): Promise<void> {
    await prisma.worker.upsert({
      where: { id: heartbeat.id },
      create: {
        id: heartbeat.id,
        name: heartbeat.name,
        status: heartbeat.status,
        concurrency: heartbeat.concurrency,
        host: heartbeat.host,
        jobsProcessed: heartbeat.jobsProcessed,
        lastHeartbeatAt: new Date(),
        startedAt: new Date(),
      },
      update: {
        name: heartbeat.name,
        status: heartbeat.status,
        concurrency: heartbeat.concurrency,
        host: heartbeat.host,
        jobsProcessed: heartbeat.jobsProcessed,
        lastHeartbeatAt: new Date(),
      },
    });
  }

  async retireWorker(id: string): Promise<void> {
    await prisma.worker
      .update({
        where: { id },
        data: { status: "stopped", stoppedAt: new Date(), lastHeartbeatAt: new Date() },
      })
      .catch(() => undefined);
  }

  async listWorkers(): Promise<WorkerRecord[]> {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeatAt: "desc" },
    });

    return workers.map((row) => ({
      id: row.id,
      name: row.name,
      status: String(row.status) as WorkerRecord["status"],
      concurrency: row.concurrency,
      host: row.host ?? null,
      jobsProcessed: row.jobsProcessed,
      // The Worker table tracks liveness, not what a worker is fetching right
      // now; the UI falls back to a status line rather than inventing a URL.
      currentUrl: null,
      lastHeartbeatAt: iso(row.lastHeartbeatAt),
      startedAt: iso(row.startedAt),
      stoppedAt: row.stoppedAt ? iso(row.stoppedAt) : null,
    }));
  }

  // Contact enquiries

  async createContactEnquiry(input: ContactEnquiryDraft): Promise<ContactEnquiryRecord> {
    const row = await prisma.contactEnquiry.create({
      data: {
        id: `enq-${randomUUID()}`,
        name: input.name,
        email: input.email,
        company: input.company || null,
        market: input.market || null,
        interest: input.interest || null,
        message: input.message,
      },
    });

    return this.enquiryRowToDomain(row);
  }

  async listContactEnquiries(): Promise<ContactEnquiryRecord[]> {
    const rows = await prisma.contactEnquiry.findMany({
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => this.enquiryRowToDomain(row));
  }

  async updateContactEnquiryStatus(
    id: string,
    status: ContactEnquiryRecord["status"],
  ): Promise<ContactEnquiryRecord | undefined> {
    // `update` throws P2025 when the row is gone, which would surface as a 500
    // on a simple triage click. Treat a missing enquiry as "nothing to do".
    const existing = await prisma.contactEnquiry.findUnique({ where: { id } });
    if (!existing) return undefined;

    const row = await prisma.contactEnquiry.update({
      where: { id },
      data: { status },
    });

    return this.enquiryRowToDomain(row);
  }

  private enquiryRowToDomain(row: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    market: string | null;
    interest: string | null;
    message: string;
    status: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): ContactEnquiryRecord {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      company: row.company ?? undefined,
      market: row.market ?? undefined,
      interest: row.interest ?? undefined,
      message: row.message,
      status: String(row.status) as ContactEnquiryRecord["status"],
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  async listQualifiedLeads(): Promise<OpportunityRecord[]> {
    const opportunities = await prisma.opportunity.findMany({
      where: {
        status: { not: "lost" },
        score: { gte: 75 },
        confidence: { gte: 0.65 },
      },
      orderBy: [{ score: "desc" }, { confidence: "desc" }],
    });

    return opportunities.map((row) => this.opportunityRowToDomain(row));
  }

  // ==================
  // HELPERS
  // ==================

  private jobToDomain(job: PrismaJob): ScraperJob {
    return {
      id: job.id,
      name: job.name,
      status: job.status as JobStatus,
      totalUrls: job.totalUrls,
      processedUrls: job.processedUrls,
      successfulUrls: job.successfulUrls,
      queuedUrls: job.queuedUrls,
      workersActive: job.workersActive,
      workersTotal: job.workersTotal,
      errorRate: job.errorRate,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      targetType: DOMAIN_TARGET_TYPE[job.targetType],
      targetLabel: job.targetLabel,
      sources: jsonArray<string>(job.sources),
      configuration:
        jsonValue<ScraperJob["configuration"]>(job.configuration) ??
        { workers: 1, requestsPerSecond: 1, retries: 0, javascriptRendering: false },
    };
  }

  private generateTargetLabel(draft: JobDraft, queueUrls: string[]): string {
    return targetLabelFor(draft, queueUrls);
  }

  private generateSources(draft: JobDraft): string[] {
    const sources: string[] = [];
    if (draft.sources.websites) sources.push("Company websites");
    if (draft.sources.search) sources.push("Search engines");
    if (draft.sources.directories) sources.push("Business directories");
    if (draft.sources.social) sources.push("Social profiles");
    return sources;
  }

  private normalizeUrl(value: string): string | null {
    try {
      const url = new URL(value.startsWith("http") ? value : `https://${value}`);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      url.hash = "";
      url.hostname = url.hostname.toLowerCase();
      if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.slice(0, -1);
      }
      return url.toString();
    } catch {
      return null;
    }
  }
}
