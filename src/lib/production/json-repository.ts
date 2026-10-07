/**
 * JSON Repository - wraps the existing persistent-store for JSON-based persistence
 * Used in development mode when DATABASE_URL is not configured
 */

import type {
  ContactEnquiryDraft,
  ContactEnquiryRecord,
  IRepository,
  StoredEvidence,
  WorkerHeartbeat,
  WorkerRecord,
} from "./repository";
import * as persistentStore from "@/lib/scraper/persistent-store";
import type { JobDraft, ScraperJob } from "@/lib/scraper/job-types";
import type { StoredQueueItem, StoredLog, QueueViewItem } from "@/lib/scraper/persistent-store";
import type { CompanyRecord } from "@/lib/research/company";
import type { WorkflowRecord } from "@/lib/research/workflow";
import type { OpportunityRecord } from "@/lib/research/opportunity";
import type { CampaignRecord, CampaignSummary } from "@/lib/research/campaign";

/**
 * JSON-based repository implementation
 * Wraps the existing sync persistent-store and makes it async-compatible
 */
export class JSONRepository implements IRepository {
  // Campaigns
  async listStoredCampaigns(): Promise<CampaignSummary[]> {
    return persistentStore.listStoredCampaigns();
  }

  async getStoredCampaign(id: string): Promise<CampaignSummary | undefined> {
    return persistentStore.getStoredCampaign(id);
  }

  async createStoredCampaign(input: unknown): Promise<CampaignRecord> {
    return persistentStore.createStoredCampaign(input);
  }

  async updateStoredCampaign(id: string, patch: unknown): Promise<CampaignRecord | undefined> {
    return persistentStore.updateStoredCampaign(id, patch);
  }

  async deleteStoredCampaign(id: string): Promise<boolean> {
    return persistentStore.deleteStoredCampaign(id);
  }

  // Jobs
  async listStoredJobs(): Promise<ScraperJob[]> {
    return persistentStore.listStoredJobs();
  }

  async getStoredJob(id: string): Promise<ScraperJob | undefined> {
    return persistentStore.getStoredJob(id);
  }

  async createStoredJob(draft: JobDraft, queueUrls: string[]): Promise<ScraperJob> {
    return persistentStore.createStoredJob(draft, queueUrls);
  }

  async updateStoredJobStatus(
    id: string,
    action: "pause" | "resume" | "cancel",
  ): Promise<ScraperJob | undefined> {
    return persistentStore.updateStoredJobStatus(id, action);
  }

  // Queue
  async claimNextQueueItem(jobId: string): Promise<StoredQueueItem | undefined> {
    return persistentStore.claimNextQueueItem(jobId);
  }

  async completeQueueItem(itemId: string, data: { success: boolean; message: string }): Promise<void> {
    persistentStore.completeQueueItem(itemId, data);
  }

  async requeueQueueItem(itemId: string, data: { message: string; delayMs: number }): Promise<void> {
    persistentStore.requeueQueueItem(itemId, data);
  }

  async addQueueItems(jobId: string, urls: string[], maxTotal?: number): Promise<number> {
    return persistentStore.addQueueItems(jobId, urls, maxTotal);
  }

  async completeJobIfIdle(jobId: string): Promise<void> {
    persistentStore.completeJobIfIdle(jobId);
  }

  async listStoredLogs(jobId?: string): Promise<StoredLog[]> {
    return persistentStore.listStoredLogs(jobId);
  }

  async listStoredQueue(): Promise<QueueViewItem[]> {
    return persistentStore.listStoredQueue();
  }

  // Companies
  async recordCompanyPage(input: {
    jobId: string;
    url: string;
    title: string | null;
    description: string | null;
    text: string;
  }): Promise<CompanyRecord | null> {
    return persistentStore.recordCompanyPage(input);
  }

  async listStoredCompanies(): Promise<CompanyRecord[]> {
    return persistentStore.listStoredCompanies() as CompanyRecord[];
  }

  async getStoredCompany(
    id: string,
  ): Promise<{ company: CompanyRecord; evidence: StoredEvidence[] } | undefined> {
    return persistentStore.getStoredCompany(id) as
      | { company: CompanyRecord; evidence: StoredEvidence[] }
      | undefined;
  }

  // Workflows
  async listStoredWorkflows(): Promise<WorkflowRecord[]> {
    return persistentStore.listStoredWorkflows();
  }

  async getStoredWorkflow(
    id: string,
  ): Promise<{ workflow: WorkflowRecord; evidence: StoredEvidence[] } | undefined> {
    return persistentStore.getStoredWorkflow(id) as
      | { workflow: WorkflowRecord; evidence: StoredEvidence[] }
      | undefined;
  }

  async evaluateStoredWorkflow(id: string): Promise<WorkflowRecord | undefined> {
    return persistentStore.evaluateStoredWorkflow(id);
  }

  async evaluateAllStoredWorkflows(): Promise<WorkflowRecord[]> {
    return persistentStore.evaluateAllStoredWorkflows();
  }

  // Opportunities
  async listStoredOpportunities(): Promise<OpportunityRecord[]> {
    return persistentStore.listStoredOpportunities();
  }

  async generateAllStoredOpportunities(): Promise<OpportunityRecord[]> {
    return persistentStore.generateAllStoredOpportunities();
  }

  async getStoredOpportunity(id: string): Promise<OpportunityRecord | undefined> {
    return persistentStore.getStoredOpportunity(id);
  }

  async updateOpportunityStatus(
    id: string,
    status: OpportunityRecord["status"],
  ): Promise<OpportunityRecord | undefined> {
    return persistentStore.updateOpportunityStatus(id, status);
  }

  async listQualifiedLeads(): Promise<OpportunityRecord[]> {
    return persistentStore.listQualifiedLeads();
  }

  // Worker liveness
  async upsertWorkerHeartbeat(heartbeat: WorkerHeartbeat): Promise<void> {
    persistentStore.upsertWorkerHeartbeat(heartbeat);
  }

  async retireWorker(id: string): Promise<void> {
    persistentStore.retireWorker(id);
  }

  async listWorkers(): Promise<WorkerRecord[]> {
    return persistentStore.listStoredWorkers();
  }

  // Contact enquiries
  async createContactEnquiry(input: ContactEnquiryDraft): Promise<ContactEnquiryRecord> {
    return persistentStore.createStoredEnquiry(input);
  }

  async listContactEnquiries(): Promise<ContactEnquiryRecord[]> {
    return persistentStore.listStoredEnquiries();
  }

  async updateContactEnquiryStatus(
    id: string,
    status: ContactEnquiryRecord["status"],
  ): Promise<ContactEnquiryRecord | undefined> {
    return persistentStore.updateStoredEnquiryStatus(id, status);
  }
}
