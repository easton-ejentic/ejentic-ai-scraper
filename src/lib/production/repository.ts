/**
 * Production async repository layer
 * Provides database-agnostic interface for all data operations
 * Can work with both Prisma/PostgreSQL and development JSON fallback
 */

import { persistenceMode, productionConfig } from "./config";
import { JSONRepository } from "./json-repository";
import { PostgreSQLRepository } from "./postgresql-repository";
import type { JobDraft, ScraperJob } from "@/lib/scraper/job-types";
import type { StoredQueueItem, StoredLog, QueueViewItem } from "@/lib/scraper/persistent-store";
import type { CompanyRecord } from "@/lib/research/company";
import type { WorkflowRecord } from "@/lib/research/workflow";
import type { OpportunityRecord } from "@/lib/research/opportunity";
import type {
  CampaignRecord,
  CampaignSummary,
} from "@/lib/research/campaign";

/**
 * An evidence row as returned by `getStoredCompany` / `getStoredWorkflow`.
 *
 * The JSON store and the Prisma `Evidence` model keep slightly different
 * fields, so this describes the subset both implementations guarantee.
 * `createdAt` is an ISO string in the JSON store and a `Date` from Prisma.
 */
export interface StoredEvidence {
  id: string;
  companyId: string;
  jobId: string;
  url: string;
  label: string;
  excerpt: string;
  createdAt: string | Date;
}

/**
 * Repository interface - all methods are async for database compatibility
 */
export interface IRepository {
  // Campaigns
  listStoredCampaigns(): Promise<CampaignSummary[]>;
  getStoredCampaign(id: string): Promise<CampaignSummary | undefined>;
  createStoredCampaign(input: unknown): Promise<CampaignRecord>;
  updateStoredCampaign(id: string, patch: unknown): Promise<CampaignRecord | undefined>;
  deleteStoredCampaign(id: string): Promise<boolean>;

  // Jobs
  listStoredJobs(): Promise<ScraperJob[]>;
  getStoredJob(id: string): Promise<ScraperJob | undefined>;
  createStoredJob(draft: JobDraft, queueUrls: string[]): Promise<ScraperJob>;
  updateStoredJobStatus(id: string, action: "pause" | "resume" | "cancel"): Promise<ScraperJob | undefined>;

  // Queue
  claimNextQueueItem(jobId: string): Promise<StoredQueueItem | undefined>;
  completeQueueItem(itemId: string, data: { success: boolean; message: string }): Promise<void>;
  requeueQueueItem(itemId: string, data: { message: string; delayMs: number }): Promise<void>;
  addQueueItems(jobId: string, urls: string[], maxTotal?: number): Promise<number>;
  completeJobIfIdle(jobId: string): Promise<void>;
  listStoredLogs(jobId?: string): Promise<StoredLog[]>;
  listStoredQueue(): Promise<QueueViewItem[]>;

  // Companies
  recordCompanyPage(input: {
    jobId: string;
    url: string;
    title: string | null;
    description: string | null;
    text: string;
  }): Promise<CompanyRecord | null>;
  listStoredCompanies(): Promise<CompanyRecord[]>;
  getStoredCompany(id: string): Promise<{ company: CompanyRecord; evidence: StoredEvidence[] } | undefined>;

  // Workflows
  listStoredWorkflows(): Promise<WorkflowRecord[]>;
  getStoredWorkflow(id: string): Promise<{ workflow: WorkflowRecord; evidence: StoredEvidence[] } | undefined>;
  evaluateStoredWorkflow(id: string): Promise<WorkflowRecord | undefined>;
  evaluateAllStoredWorkflows(): Promise<WorkflowRecord[]>;

  // Opportunities
  listStoredOpportunities(): Promise<OpportunityRecord[]>;
  generateAllStoredOpportunities(): Promise<OpportunityRecord[]>;
  getStoredOpportunity(id: string): Promise<OpportunityRecord | undefined>;
  updateOpportunityStatus(id: string, status: OpportunityRecord["status"]): Promise<OpportunityRecord | undefined>;
  listQualifiedLeads(): Promise<OpportunityRecord[]>;

  // Worker liveness
  upsertWorkerHeartbeat(heartbeat: WorkerHeartbeat): Promise<void>;
  retireWorker(id: string): Promise<void>;
  listWorkers(): Promise<WorkerRecord[]>;

  // Contact enquiries (public marketing form)
  createContactEnquiry(input: ContactEnquiryDraft): Promise<ContactEnquiryRecord>;
  listContactEnquiries(): Promise<ContactEnquiryRecord[]>;
  updateContactEnquiryStatus(
    id: string,
    status: ContactEnquiryRecord["status"],
  ): Promise<ContactEnquiryRecord | undefined>;
}

export type ContactEnquiryStatus = "new" | "read" | "archived";

export interface ContactEnquiryDraft {
  name: string;
  email: string;
  company?: string;
  market?: string;
  interest?: string;
  message: string;
}

export interface ContactEnquiryRecord extends ContactEnquiryDraft {
  id: string;
  status: ContactEnquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerRecord {
  id: string;
  name: string;
  status: "idle" | "running" | "stopped";
  concurrency: number;
  host: string | null;
  jobsProcessed: number;
  currentUrl: string | null;
  lastHeartbeatAt: string;
  startedAt: string;
  stoppedAt: string | null;
}

export interface WorkerHeartbeat {
  id: string;
  name: string;
  status: "idle" | "running" | "stopped";
  concurrency: number;
  host?: string;
  jobsProcessed: number;
  currentUrl?: string | null;
}

/**
 * Get the appropriate repository implementation based on environment.
 *
 * Production has no JSON fallback. The file store is written by the web
 * process and the worker at the same time with no locking, so running it in
 * production silently loses whichever writer commits second. Failing here
 * turns that into a startup/request error naming the fix, instead of data
 * that quietly disappears.
 */
export function getRepository(): IRepository {
  const mode = persistenceMode();

  if (mode === "postgresql") return new PostgreSQLRepository();
  if (mode === "json") return new JSONRepository();

  throw new Error(
    "No durable storage configured. Set DATABASE_URL to a PostgreSQL " +
      "connection string before running in production (NODE_ENV=production). " +
      "The .data/scraper.json file store is development-only.",
  );
}

/**
 * Check if we're in production mode (using database)
 */
export function isProductionMode(): boolean {
  return productionConfig().databaseUrlConfigured;
}
