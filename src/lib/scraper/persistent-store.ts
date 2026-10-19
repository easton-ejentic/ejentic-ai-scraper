/**
 * Local persistent store used by the development build.
 *
 * This deliberately keeps persistence behind a repository boundary so the UI/API
 * does not care whether the backing store is a JSON file, PostgreSQL, or another
 * production datastore later.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { JobDraft, ScraperJob } from "./job-types";
import { targetLabelFor } from "./resolve-target";
import {
  companyFromPage,
  extractEvidence,
  isErrorPageTitle,
  type CompanyRecord,
  type CompanyPageRecord,
} from "../research/company";
import type { WorkflowRecord } from "../research/workflow";
import {
  deriveOpportunity,
  deriveWorkflows,
  evaluationFor,
} from "../research/pipeline";
import {
  qualificationReason,
  type OpportunityRecord,
} from "../research/opportunity";
import {
  normaliseCampaignDraft,
  normaliseCampaignPatch,
  slugifyCampaignId,
  type CampaignDraft,
  type CampaignPatch,
  type CampaignRecord,
  type CampaignSummary,
} from "../research/campaign";
export interface StoredQueueItem {
  id: string;
  jobId: string;
  url: string;
  normalizedUrl: string;
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  discoveredAt: string;
  processedAt?: string;
}

export interface StoredLog {
  id: string;
  jobId: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  createdAt: string;
}

export interface StoredWorker {
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

interface DatabaseFile {
  jobs: ScraperJob[];
  queue: StoredQueueItem[];
  logs: StoredLog[];
  companies: CompanyRecord[];
  evidence: Array<{ id: string; companyId: string; jobId: string; url: string; label: string; excerpt: string; createdAt: string }>;
  workflows: WorkflowRecord[];
  opportunities: OpportunityRecord[];
  campaigns: CampaignRecord[];
  workers: StoredWorker[];
  enquiries: StoredEnquiry[];
  contacts: StoredContact[];
}

/**
 * A discovered way to reach a person at a company, plus the result of the
 * deliverability check. Kept with the URL it was extracted from so any address
 * can be traced back to the page that produced it.
 */
export interface StoredContact {
  id: string;
  companyId: string;
  email: string;
  kind: "personal" | "role" | "generic" | "unknown";
  confidence: number;
  sourceUrl: string;
  context: string | null;
  firstName: string | null;
  lastName: string | null;
  verification: "unverified" | "invalid" | "disposable" | "mx_missing" | "mx_valid";
  mxRecord: string | null;
  verifiedAt: string | null;
  discoveredAt: string;
  updatedAt: string;
}

/**
 * A contact-form submission from the public marketing site. Stored so an
 * operator can actually read enquiries instead of them living only in stdout.
 */
export interface StoredEnquiry {
  id: string;
  name: string;
  email: string;
  company?: string;
  market?: string;
  interest?: string;
  message: string;
  status: "new" | "read" | "archived";
  createdAt: string;
  updatedAt: string;
}

const dataPath = join(process.cwd(), ".data", "scraper.json");

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureDatabase(): DatabaseFile {
  if (!existsSync(dataPath)) {
    mkdirSync(dirname(dataPath), { recursive: true });

    const initial: DatabaseFile = {
      jobs: [],
      queue: [],
      logs: [],
      companies: [],
      evidence: [],
      workflows: [],
      opportunities: [],
      campaigns: [],
      workers: [],
      enquiries: [],
      contacts: [],
    };

    writeFileSync(dataPath, JSON.stringify(initial, null, 2));
  }

  const database = readDatabaseFile();
  database.companies ??= [];
  database.evidence ??= [];
  database.workflows ??= [];
  database.opportunities ??= [];
  database.campaigns ??= [];
  database.workers ??= [];
  database.enquiries ??= [];
  database.contacts ??= [];
  database.jobs ??= [];
  database.queue ??= [];
  database.logs ??= [];
  return database as DatabaseFile;
}

function saveDatabase(database: DatabaseFile) {
  mkdirSync(dirname(dataPath), { recursive: true });
  const payload = JSON.stringify(database, null, 2);

  // The web app and the worker are separate processes that both write this
  // file. Writing straight to `dataPath` can leave a half-written or torn file
  // (two writers, different lengths) and every later read then throws. Write to
  // a private temp file and rename instead - rename is atomic within a volume,
  // so a reader always sees either the old file or the complete new one.
  const tempPath = `${dataPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, payload);

  // On Windows the rename can briefly fail with EPERM while another process (or
  // real-time antivirus scanning) still holds the target. Retry, and only fall
  // back to a direct write if the rename never succeeds.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      renameSync(tempPath, dataPath);
      return;
    } catch {
      const settled = busyWait(5 * (attempt + 1));
      if (!settled) break;
    }
  }

  try {
    writeFileSync(dataPath, payload);
    rmSync(tempPath, { force: true });
  } catch {
    // Nothing further we can do; the next read will repair a torn file.
  }
}

/** Sleeps without awaiting, so the synchronous store stays synchronous. */
function busyWait(milliseconds: number): boolean {
  try {
    const until = Date.now() + milliseconds;
    while (Date.now() < until) {
      // Spin - short and bounded.
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the database, repairing a torn file instead of crashing the process.
 * Returns the longest valid JSON object that is still present in the file, so a
 * partially overwritten database loses at most the last write rather than
 * everything.
 */
function readDatabaseFile(): Partial<DatabaseFile> {
  const raw = readFileSync(dataPath, "utf8");

  try {
    return JSON.parse(raw) as Partial<DatabaseFile>;
  } catch {
    // Fall through to recovery.
  }

  const recovered = truncateToLastCompleteObject(raw);
  if (recovered) {
    try {
      const database = JSON.parse(recovered) as Partial<DatabaseFile>;
      if (database && typeof database === "object") {
        writeFileSync(`${dataPath}.recovered`, recovered);
        return database;
      }
    } catch {
      // Fall through to a fresh database.
    }
  }

  return {
    jobs: [],
    queue: [],
    logs: [],
    companies: [],
    evidence: [],
    workflows: [],
    opportunities: [],
    campaigns: [],
    workers: [],
    enquiries: [],
    contacts: [],
  };
}

/**
 * Finds the offset just past the last `}` that closes the top-level object,
 * ignoring braces inside string literals.
 */
function truncateToLastCompleteObject(raw: string): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastComplete = -1;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) lastComplete = index + 1;
      if (depth < 0) break;
    }
  }

  return lastComplete > 0 ? raw.slice(0, lastComplete) : null;
}

export function listStoredJobs(): ScraperJob[] {
  return clone(ensureDatabase().jobs);
}

export function getStoredJob(id: string): ScraperJob | undefined {
  const database = ensureDatabase();
  return clone(database.jobs.find((job) => job.id === id));
}

export function createStoredJob(
  draft: JobDraft,
  queueUrls: string[] = [],
): ScraperJob {
  const database = ensureDatabase();
  const now = new Date().toISOString();
  const numericIds = database.jobs
    .map((job) => Number(job.id.replace(/\D/g, "")))
    .filter(Number.isFinite);
  const nextNumber = Math.max(1042, ...numericIds) + 1;
  const id = `job-${nextNumber}`;

  const targetLabel = targetLabelFor(draft, queueUrls);

  const sources: string[] = [];
  if (draft.sources.websites) sources.push("Company websites");
  if (draft.sources.search) sources.push("Search engines");
  if (draft.sources.directories) sources.push("Business directories");
  if (draft.sources.social) sources.push("Social profiles");

  const job: ScraperJob = {
    id,
    name: draft.name.trim(),
    status: "running",
    campaignId: draft.campaignId?.trim() || null,
    totalUrls: draft.urlLimit,
    processedUrls: 0,
    successfulUrls: 0,
    queuedUrls: queueUrls.length,
    workersActive: Math.min(draft.configuration.workers, 10),
    workersTotal: draft.configuration.workers,
    errorRate: 0,
    createdAt: now,
    startedAt: now,
    targetType: draft.targetType,
    targetLabel,
    sources,
    configuration: { ...draft.configuration },
  };

  database.jobs.unshift(job);

  for (const url of queueUrls.slice(0, draft.urlLimit)) {
    const normalizedUrl = normalizeForStorage(url);
    if (!normalizedUrl) continue;
    const exists = database.queue.some(
      (item) => item.jobId === id && item.normalizedUrl === normalizedUrl,
    );
    if (exists) continue;

    database.queue.push({
      id: `${id}:${Buffer.from(normalizedUrl).toString("base64url")}`,
      jobId: id,
      url,
      normalizedUrl,
      status: "queued",
      attempts: 0,
      discoveredAt: now,
    });
  }

  database.logs.unshift({
    id: `${id}:created`,
    jobId: id,
    level: "success",
    message: `Job created with ${queueUrls.length} initial URL${queueUrls.length === 1 ? "" : "s"}.`,
    createdAt: now,
  });

  saveDatabase(database);
  return clone(job);
}

export function updateStoredJobStatus(
  id: string,
  action: "pause" | "resume" | "cancel",
): ScraperJob | undefined {
  const database = ensureDatabase();
  const job = database.jobs.find((item) => item.id === id);
  if (!job) return undefined;

  const transitions = {
    pause: { from: ["running"], to: "paused" },
    resume: { from: ["paused", "queued"], to: "running" },
    cancel: { from: ["running", "paused", "queued"], to: "cancelled" },
  } as const;

  const rule = transitions[action];
  if (!rule.from.includes(job.status as never)) return undefined;

  job.status = rule.to;
  if (action === "resume" && !job.startedAt) job.startedAt = new Date().toISOString();
  if (action === "pause" || action === "cancel") job.workersActive = 0;

  const now = new Date().toISOString();
  database.logs.unshift({
    id: `${id}:${now}:${action}`,
    jobId: id,
    level: action === "cancel" ? "warning" : "info",
    message: `Job ${action}d.`,
    createdAt: now,
  });

  if (action === "cancel") {
    for (const item of database.queue) {
      if (item.jobId === id && (item.status === "queued" || item.status === "processing")) {
        item.status = "failed";
        item.processedAt = now;
      }
    }
  }

  saveDatabase(database);
  return clone(job);
}

export function claimNextQueueItem(jobId: string): StoredQueueItem | undefined {
  const database = ensureDatabase();
  const item = database.queue.find(
    (candidate) => candidate.jobId === jobId && candidate.status === "queued",
  );
  if (!item) return undefined;

  item.status = "processing";
  item.attempts += 1;
  const job = database.jobs.find((candidate) => candidate.id === jobId);
  if (job) job.workersActive += 1;
  saveDatabase(database);
  return clone(item);
}

export function completeQueueItem(
  itemId: string,
  data: { success: boolean; message: string },
) {
  const database = ensureDatabase();
  const item = database.queue.find((candidate) => candidate.id === itemId);
  if (!item) return;

  item.status = data.success ? "completed" : "failed";
  item.processedAt = new Date().toISOString();

  const job = database.jobs.find((candidate) => candidate.id === item.jobId);
  if (job) {
    job.processedUrls += 1;
    job.queuedUrls = Math.max(0, job.queuedUrls - 1);
    if (data.success) job.successfulUrls += 1;
    else job.errorRate = Number((((job.processedUrls - job.successfulUrls) / job.processedUrls) * 100).toFixed(1));
    job.workersActive = Math.max(0, job.workersActive - 1);
  }

  const now = new Date().toISOString();
  database.logs.unshift({
    id: `${item.jobId}:${item.id}:${now}`,
    jobId: item.jobId,
    level: data.success ? "success" : "error",
    message: data.message,
    createdAt: now,
  });

  saveDatabase(database);
}

/**
 * Return a processing queue item back to "queued" so it can be retried later.
 * Used by the worker for transient failures (timeouts, throttling, 5xx).
 */
export function requeueQueueItem(itemId: string, data: { message: string; delayMs: number }) {
  const database = ensureDatabase();
  const item = database.queue.find((candidate) => candidate.id === itemId);
  if (!item) return;

  item.status = "queued";
  item.processedAt = undefined;

  const job = database.jobs.find((candidate) => candidate.id === item.jobId);
  if (job) job.workersActive = Math.max(0, job.workersActive - 1);

  const now = new Date().toISOString();
  database.logs.unshift({
    id: `${item.jobId}:${item.id}:retry:${now}`,
    jobId: item.jobId,
    level: "warning",
    message: `${data.message} · retry scheduled in ${data.delayMs}ms (attempt ${item.attempts})`,
    createdAt: now,
  });

  saveDatabase(database);
}

export function addQueueItems(jobId: string, urls: string[], maxTotal?: number) {
  const database = ensureDatabase();
  const now = new Date().toISOString();
  const job = database.jobs.find((candidate) => candidate.id === jobId);

  // `job.queuedUrls` is only incremented once, after this loop finishes, so
  // re-reading the job inside the loop would let a single large batch (the
  // worker sends up to 50 links per page) sail past the job's `totalUrls`
  // budget. Track the running total locally instead.
  let used = job ? job.processedUrls + job.queuedUrls : 0;
  let added = 0;

  for (const url of urls) {
    if (maxTotal !== undefined && used >= maxTotal) break;
    const normalizedUrl = normalizeForStorage(url);
    if (!normalizedUrl) continue;
    if (database.queue.some((item) => item.jobId === jobId && item.normalizedUrl === normalizedUrl)) continue;

    database.queue.push({
      id: `${jobId}:${Buffer.from(normalizedUrl).toString("base64url")}`,
      jobId,
      url,
      normalizedUrl,
      status: "queued",
      attempts: 0,
      discoveredAt: now,
    });
    added += 1;
    used += 1;
  }

  const jobAfterInsert = database.jobs.find((candidate) => candidate.id === jobId);
  if (jobAfterInsert) jobAfterInsert.queuedUrls += added;
  saveDatabase(database);
  return added;
}

export function completeJobIfIdle(jobId: string) {
  const database = ensureDatabase();
  const job = database.jobs.find((candidate) => candidate.id === jobId);
  if (!job || job.status !== "running") return;

  const remaining = database.queue.some(
    (item) => item.jobId === jobId && (item.status === "queued" || item.status === "processing"),
  );

  if (!remaining) {
    job.status = "completed";
    job.workersActive = 0;
    job.queuedUrls = 0;
    saveDatabase(database);
  }
}

export function listStoredLogs(jobId?: string): StoredLog[] {
  const logs = ensureDatabase().logs;
  return clone(jobId ? logs.filter((log) => log.jobId === jobId) : logs).slice(0, 200);
}

export interface QueueViewItem {
  id: string;
  url: string;
  jobId: string;
  jobName: string;
  priority: number;
  attempts: number;
  status: "pending" | "processing" | "completed" | "failed";
  enqueuedAt: string;
}

export function listStoredQueue(): QueueViewItem[] {
  const database = ensureDatabase();
  return database.queue
    .filter((item) => item.status !== "completed")
    .map((item) => ({
      id: item.id,
      url: item.url,
      jobId: item.jobId,
      jobName: database.jobs.find((job) => job.id === item.jobId)?.name ?? item.jobId,
      priority: 1,
      attempts: item.attempts,
      status: (item.status === "queued" ? "pending" : item.status) as "pending" | "processing" | "failed",
      enqueuedAt: item.discoveredAt,
    }))
    .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
}

export function listStoredActivityEvents(): import("./job-types").ActivityEvent[] {
  return ensureDatabase().logs.slice(0, 200).map((log) => ({
    id: log.id,
    time: new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    message: log.message,
    type: log.level,
  }));
}

// ---------------------------------------------------------------------------
// Workers
//
// Heartbeats are written by the discovery worker. They used to be persisted
// only by the PostgreSQL backend, which left the JSON dev backend with nothing
// to show and the control centre rendering hardcoded workers instead.
// ---------------------------------------------------------------------------

export function upsertWorkerHeartbeat(heartbeat: {
  id: string;
  name: string;
  status: "idle" | "running" | "stopped";
  concurrency: number;
  host?: string;
  jobsProcessed: number;
  currentUrl?: string | null;
}): StoredWorker {
  const database = ensureDatabase();
  const now = new Date().toISOString();
  const existing = database.workers.find((worker) => worker.id === heartbeat.id);

  if (existing) {
    existing.name = heartbeat.name;
    existing.status = heartbeat.status;
    existing.concurrency = heartbeat.concurrency;
    existing.host = heartbeat.host ?? existing.host;
    existing.jobsProcessed = heartbeat.jobsProcessed;
    existing.currentUrl = heartbeat.currentUrl ?? existing.currentUrl;
    existing.lastHeartbeatAt = now;
    existing.stoppedAt = heartbeat.status === "stopped" ? now : null;
    saveDatabase(database);
    return clone(existing);
  }

  const worker: StoredWorker = {
    id: heartbeat.id,
    name: heartbeat.name,
    status: heartbeat.status,
    concurrency: heartbeat.concurrency,
    host: heartbeat.host ?? null,
    jobsProcessed: heartbeat.jobsProcessed,
    currentUrl: heartbeat.currentUrl ?? null,
    lastHeartbeatAt: now,
    startedAt: now,
    stoppedAt: heartbeat.status === "stopped" ? now : null,
  };
  database.workers.unshift(worker);
  saveDatabase(database);
  return clone(worker);
}

export function retireWorker(id: string): void {
  const database = ensureDatabase();
  const worker = database.workers.find((item) => item.id === id);
  if (!worker) return;
  worker.status = "stopped";
  worker.stoppedAt = new Date().toISOString();
  saveDatabase(database);
}

export function listStoredWorkers(): StoredWorker[] {
  return clone(ensureDatabase().workers).sort((a, b) =>
    b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt),
  );
}

function normalizeForStorage(value: string): string | null {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return null;
  }
}

export function recordCompanyPage(input: {
  jobId: string;
  url: string;
  title: string | null;
  description: string | null;
  text: string;
}) {
  const database = ensureDatabase();
  const company = companyFromPage(input.url, input.title);
  if (!company) return null;
  const now = new Date().toISOString();
  let stored = database.companies.find((item) => item.domain === company.domain);
  if (!stored) {
    stored = {
      id: `company-${Buffer.from(company.domain).toString("base64url")}`,
      name: company.name,
      domain: company.domain,
      website: company.website,
      description: input.description,
      firstSeenAt: now,
      lastSeenAt: now,
      pageCount: 0,
      jobIds: [],
      pages: [],
    };
    database.companies.unshift(stored);
  }
  stored.lastSeenAt = now;
  // A company first met through a blocked page keeps the error title until a
  // real page is crawled - repair the name then.
  if (isErrorPageTitle(stored.name) && !isErrorPageTitle(company.name)) stored.name = company.name;
  if (input.description && (!stored.description || input.url === stored.website)) stored.description = input.description;
  if (!stored.jobIds.includes(input.jobId)) stored.jobIds.push(input.jobId);
  if (!stored.pages.some((page) => page.url === input.url)) {
    const page: CompanyPageRecord = {
      id: `${stored.id}:${Buffer.from(input.url).toString("base64url")}`,
      companyId: stored.id,
      jobId: input.jobId,
      url: input.url,
      title: input.title,
      description: input.description,
      text: input.text.slice(0, 100_000),
      crawledAt: now,
    };
    stored.pages.unshift(page);
    stored.pageCount = stored.pages.length;
    const pageEvidence = extractEvidence(input.text);
    const evidenceIds: string[] = [];
    for (const item of pageEvidence) {
      const evidenceId = `${page.id}:${item.label}`;
      evidenceIds.push(evidenceId);
      database.evidence.unshift({
        id: evidenceId,
        companyId: stored.id,
        jobId: input.jobId,
        url: input.url,
        label: item.label,
        excerpt: item.excerpt,
        createdAt: now,
      });
    }
    // Derivation is shared with the PostgreSQL repository (see
    // `research/pipeline.ts`) so both backends score identically.
    const derivation = deriveWorkflows({
      companyId: stored.id,
      companyName: stored.name,
      jobId: input.jobId,
      url: input.url,
      text: input.text,
      evidenceIds,
      existing: database.workflows
        .filter((workflow) => workflow.companyId === stored.id)
        .map(({ id, name, description, category, confidence, signals, evidenceIds, sourceUrls, companyId, companyName, jobId }) => ({
          id, name, description, category, confidence, signals, evidenceIds, sourceUrls, companyId, companyName, jobId,
        })),
      now,
    });

    for (const created of derivation.create) database.workflows.unshift(created);

    for (const update of derivation.update) {
      const workflow = database.workflows.find((item) => item.id === update.id);
      if (!workflow) continue;
      workflow.lastSeenAt = update.lastSeenAt;
      workflow.confidence = update.confidence;
      workflow.evidenceIds = update.evidenceIds;
      workflow.sourceUrls = update.sourceUrls;
      workflow.evaluation = update.evaluation;
    }
  }

  // Keep the opportunity layer synchronized with newly discovered/evaluated workflows.
  for (const workflow of database.workflows.filter((item) => item.companyId === stored!.id)) {
    if (!workflow.evaluation) workflow.evaluation = evaluationFor(workflow);
    const existingOpportunity = database.opportunities.find((item) => item.workflowId === workflow.id);
    const generated = deriveOpportunity(workflow, existingOpportunity);
    if (!generated) continue;
    if (existingOpportunity) {
      Object.assign(existingOpportunity, generated);
    } else {
      database.opportunities.unshift(generated);
    }
  }

  saveDatabase(database);
  return clone(stored);
}

export function listStoredCompanies() {
  return clone(databaseCompanies(ensureDatabase()));
}

export function getStoredCompany(id: string) {
  const database = ensureDatabase();
  const company = database.companies.find((item) => item.id === id);
  if (!company) return undefined;
  return { company: clone(company), evidence: clone(database.evidence.filter((item) => item.companyId === id).slice(0, 100)) };
}

function databaseCompanies(database: DatabaseFile) {
  return database.companies.map(({ pages, ...company }) => ({ ...company }));
}


export function evaluateStoredWorkflow(id: string) {
  const database = ensureDatabase();
  const workflow = database.workflows.find((item) => item.id === id);
  if (!workflow) return undefined;
  workflow.evaluation = evaluationFor(workflow);
  saveDatabase(database);
  return clone(workflow);
}

export function evaluateAllStoredWorkflows() {
  const database = ensureDatabase();
  for (const workflow of database.workflows) {
    workflow.evaluation = evaluationFor(workflow);
  }
  saveDatabase(database);
  return clone(database.workflows);
}

export function listStoredWorkflows() {
  return clone(ensureDatabase().workflows).sort((a, b) => b.confidence - a.confidence || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function getStoredWorkflow(id: string) {
  const database = ensureDatabase();
  const workflow = database.workflows.find((item) => item.id === id);
  if (!workflow) return undefined;
  const evidence = database.evidence.filter((item) => workflow.evidenceIds.includes(item.id));
  return { workflow: clone(workflow), evidence: clone(evidence) };
}


export function listStoredOpportunities() {
  return clone(ensureDatabase().opportunities).sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt));
}

export function getStoredOpportunity(id: string) {
  const database = ensureDatabase();
  const opportunity = database.opportunities.find((item) => item.id === id);
  if (!opportunity) return undefined;
  return clone(opportunity);
}

export function generateStoredOpportunity(workflowId: string) {
  const database = ensureDatabase();
  const workflow = database.workflows.find((item) => item.id === workflowId);
  if (!workflow) return undefined;
  if (!workflow.evaluation) workflow.evaluation = evaluationFor(workflow);
  const existing = database.opportunities.find((item) => item.workflowId === workflowId);
  const generated = deriveOpportunity(workflow, existing);
  if (!generated) return undefined;
  if (existing) {
    Object.assign(existing, generated);
    saveDatabase(database);
    return clone(existing);
  }
  database.opportunities.unshift(generated);
  saveDatabase(database);
  return clone(generated);
}

export function generateAllStoredOpportunities() {
  const database = ensureDatabase();
  const output: OpportunityRecord[] = [];
  for (const workflow of database.workflows) {
    if (!workflow.evaluation) workflow.evaluation = evaluationFor(workflow);
    const existing = database.opportunities.find((item) => item.workflowId === workflow.id);
    const generated = deriveOpportunity(workflow, existing);
    if (!generated) continue;
    if (existing) {
      Object.assign(existing, generated);
      output.push(existing);
    } else {
      database.opportunities.unshift(generated);
      output.push(generated);
    }
  }
  saveDatabase(database);
  return clone(output);
}

export function listQualifiedLeads() {
  const database = ensureDatabase();
  return clone(database.opportunities
    .filter((item) => item.status !== "lost" && item.score >= 75 && item.confidence >= 0.65)
    .map((item) => ({ ...item, qualificationReasons: qualificationReason(item) }))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence));
}

export function updateOpportunityStatus(id: string, status: OpportunityRecord["status"]) {
  const database = ensureDatabase();
  const opportunity = database.opportunities.find((item) => item.id === id);
  if (!opportunity) return undefined;
  opportunity.status = status;
  opportunity.updatedAt = new Date().toISOString();
  saveDatabase(database);
  return clone(opportunity);
}

/* ------------------------------------------------------------------ *
 * Campaigns
 *
 * Campaigns are the container users create before running discovery, so the
 * results of several jobs can be read together ("Bristol dentals"). Everything
 * hangs off `job.campaignId`; the rollups below just follow that link.
 * ------------------------------------------------------------------ */

export function listStoredCampaigns(): CampaignSummary[] {
  const database = ensureDatabase();
  return clone(
    database.campaigns
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((campaign) => summariseCampaign(database, campaign)),
  );
}

export function getStoredCampaign(id: string): CampaignSummary | undefined {
  const database = ensureDatabase();
  const campaign = database.campaigns.find((item) => item.id === id);
  if (!campaign) return undefined;
  return clone(summariseCampaign(database, campaign));
}

export function createStoredCampaign(input: unknown): CampaignRecord {
  const database = ensureDatabase();
  const draft: CampaignDraft = normaliseCampaignDraft(input);
  const now = new Date().toISOString();

  const campaign: CampaignRecord = {
    id: slugifyCampaignId(draft.name),
    name: draft.name,
    description: draft.description ?? null,
    industry: draft.industry ?? null,
    region: draft.region ?? null,
    createdAt: now,
    updatedAt: now,
  };

  database.campaigns.unshift(campaign);
  saveDatabase(database);
  return clone(campaign);
}

export function updateStoredCampaign(id: string, patch: unknown): CampaignRecord | undefined {
  const database = ensureDatabase();
  const campaign = database.campaigns.find((item) => item.id === id);
  if (!campaign) return undefined;

  const changes: CampaignPatch = normaliseCampaignPatch(patch);
  Object.assign(campaign, changes, { updatedAt: new Date().toISOString() });
  saveDatabase(database);
  return clone(campaign);
}

/**
 * Deleting a campaign never deletes the work underneath it. Jobs, companies,
 * workflows and opportunities are the evidence - losing them because someone
 * tidied up a container would be far worse than an unfiled job.
 */
export function deleteStoredCampaign(id: string): boolean {
  const database = ensureDatabase();
  const index = database.campaigns.findIndex((item) => item.id === id);
  if (index === -1) return false;

  database.campaigns.splice(index, 1);
  for (const job of database.jobs) {
    if (job.campaignId === id) job.campaignId = null;
  }
  saveDatabase(database);
  return true;
}

export function summariseCampaign(
  database: DatabaseFile,
  campaign: CampaignRecord,
): CampaignSummary {
  const jobIds = database.jobs
    .filter((job) => job.campaignId === campaign.id)
    .map((job) => job.id);
  const jobIdSet = new Set(jobIds);

  const companyIds = database.companies
    .filter((company) => company.jobIds.some((jobId) => jobIdSet.has(jobId)))
    .map((company) => company.id);

  const workflows = database.workflows.filter((workflow) => jobIdSet.has(workflow.jobId));
  const workflowIds = workflows.map((workflow) => workflow.id);
  const workflowIdSet = new Set(workflowIds);

  const opportunities = database.opportunities.filter((item) => workflowIdSet.has(item.workflowId));

  const timestamps = [
    ...database.jobs
      .filter((job) => jobIdSet.has(job.id))
      .map((job) => job.startedAt ?? job.createdAt),
    campaign.updatedAt,
  ].filter((value): value is string => Boolean(value));

  return {
    ...campaign,
    jobIds,
    companyIds,
    workflowIds,
    opportunityIds: opportunities.map((item) => item.id),
    jobCount: jobIds.length,
    companyCount: companyIds.length,
    workflowCount: workflowIds.length,
    opportunityCount: opportunities.length,
    qualifiedCount: opportunities.filter(
      (item) => item.status === "qualified" || item.status === "outreach" || item.status === "won",
    ).length,
    topScore: opportunities.length
      ? Math.max(...opportunities.map((item) => item.score))
      : null,
    lastActivityAt: timestamps.length
      ? timestamps.slice().sort((a, b) => b.localeCompare(a))[0]
      : null,
  };
}

/**
 * Contact enquiries -------------------------------------------------------
 */

export function createStoredEnquiry(input: {
  name: string;
  email: string;
  company?: string;
  market?: string;
  interest?: string;
  message: string;
}): StoredEnquiry {
  const database = ensureDatabase();
  const now = new Date().toISOString();
  const enquiry: StoredEnquiry = {
    id: `enq-${randomUUID()}`,
    name: input.name,
    email: input.email,
    company: input.company || undefined,
    market: input.market || undefined,
    interest: input.interest || undefined,
    message: input.message,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };

  database.enquiries.unshift(enquiry);
  saveDatabase(database);
  return clone(enquiry);
}

export function listStoredEnquiries(): StoredEnquiry[] {
  return clone(ensureDatabase().enquiries).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function updateStoredEnquiryStatus(
  id: string,
  status: StoredEnquiry["status"],
): StoredEnquiry | undefined {
  const database = ensureDatabase();
  const enquiry = database.enquiries.find((item) => item.id === id);
  if (!enquiry) return undefined;

  enquiry.status = status;
  enquiry.updatedAt = new Date().toISOString();
  saveDatabase(database);
  return clone(enquiry);
}

/* -------------------------------------------------------------------------
 * Discovered contacts
 * ---------------------------------------------------------------------- */

/**
 * Persist discovered contacts for a company.
 *
 * Upserts on (companyId, email) so re-running discovery after a recrawl
 * refreshes verification data instead of piling up duplicates.
 */
export function saveStoredContacts(
  companyId: string,
  contacts: Array<Omit<StoredContact, "id" | "companyId" | "discoveredAt" | "updatedAt">>,
): StoredContact[] {
  const database = ensureDatabase();
  const now = new Date().toISOString();
  const saved: StoredContact[] = [];

  for (const contact of contacts) {
    const existing = database.contacts.find(
      (item) => item.companyId === companyId && item.email === contact.email,
    );

    if (existing) {
      Object.assign(existing, contact, { updatedAt: now });
      saved.push(existing);
      continue;
    }

    const created: StoredContact = {
      ...contact,
      id: randomUUID(),
      companyId,
      discoveredAt: now,
      updatedAt: now,
    };
    database.contacts.unshift(created);
    saved.push(created);
  }

  saveDatabase(database);
  return clone(saved);
}

export function listStoredContacts(companyId?: string): StoredContact[] {
  const contacts = ensureDatabase().contacts.filter(
    (item) => !companyId || item.companyId === companyId,
  );
  return clone(contacts).sort(
    (a, b) => b.confidence - a.confidence || a.email.localeCompare(b.email),
  );
}

export function deleteStoredContact(id: string): boolean {
  const database = ensureDatabase();
  const index = database.contacts.findIndex((item) => item.id === id);
  if (index === -1) return false;

  database.contacts.splice(index, 1);
  saveDatabase(database);
  return true;
}
