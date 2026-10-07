export type WorkflowSignal = "labor" | "repetition" | "information" | "economic-impact";

export interface WorkflowRecord {
  id: string;
  companyId: string;
  companyName: string;
  jobId: string;
  name: string;
  description: string;
  category: string;
  confidence: number;
  signals: WorkflowSignal[];
  evidenceIds: string[];
  sourceUrls: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  evaluation?: import("./evaluation").WorkflowEvaluation;
}

const WORKFLOW_PATTERNS: Array<{
  name: string;
  category: string;
  description: string;
  pattern: RegExp;
  signals: WorkflowSignal[];
}> = [
  { name: "Client intake & onboarding", category: "Intake", description: "Collecting information, forms, applications, or documents from new or existing clients.", pattern: /\b(intake|onboarding|application|new client|client information|enrollment)\b/i, signals: ["labor", "repetition", "information"] },
  { name: "Document processing & review", category: "Documents", description: "Receiving, reviewing, validating, organizing, or processing business documents and records.", pattern: /\b(document|documents|records|forms|review|validate|verification|processing)\b/i, signals: ["labor", "repetition", "information"] },
  { name: "Claims / case processing", category: "Case management", description: "Handling claims, cases, requests, or supporting records through a review or resolution process.", pattern: /\b(claims?|case management|casework|requests?|resolution)\b/i, signals: ["labor", "repetition", "information", "economic-impact"] },
  { name: "Scheduling & coordination", category: "Coordination", description: "Coordinating appointments, people, tasks, resources, or follow-up activities.", pattern: /\b(schedule|scheduling|appointment|coordination|coordinate|dispatch|follow[- ]?up)\b/i, signals: ["labor", "repetition"] },
  { name: "Customer / member support", category: "Support", description: "Handling recurring customer, member, patient, or client questions and service requests.", pattern: /\b(customer support|customer service|member services|patient support|client support|help desk|service requests?)\b/i, signals: ["labor", "repetition", "information"] },
  { name: "Billing & invoicing", category: "Finance", description: "Preparing, sending, reconciling, or following up on invoices, billing, or payment information.", pattern: /\b(billing|invoice|invoicing|accounts receivable|payments?|collections?)\b/i, signals: ["labor", "repetition", "information", "economic-impact"] },
  { name: "Reporting & data administration", category: "Administration", description: "Compiling, maintaining, transforming, or reporting on recurring operational data.", pattern: /\b(reporting|reports?|data entry|data management|administration|administrative)\b/i, signals: ["labor", "repetition", "information"] },
  { name: "Sales / lead follow-up", category: "Growth", description: "Researching prospects, responding to inquiries, qualifying leads, or conducting follow-up.", pattern: /\b(leads?|prospects?|lead generation|sales support|follow[- ]?up|inquiries|business development)\b/i, signals: ["labor", "repetition", "information", "economic-impact"] },
];

function score(pattern: RegExp, text: string): number {
  const matches = text.match(new RegExp(pattern.source, pattern.flags.includes("i") ? "gi" : "g"));
  return Math.min(0.98, 0.45 + Math.min(5, matches?.length ?? 0) * 0.08);
}

export interface WorkflowCandidateInput {
  companyId: string;
  companyName: string;
  jobId: string;
  url: string;
  text: string;
  evidenceIds: string[];
}

export function discoverWorkflowCandidates(input: WorkflowCandidateInput): Array<Omit<WorkflowRecord, "id" | "firstSeenAt" | "lastSeenAt">> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!text) return [];
  return WORKFLOW_PATTERNS.filter((candidate) => candidate.pattern.test(text)).map((candidate) => ({
    companyId: input.companyId,
    companyName: input.companyName,
    jobId: input.jobId,
    name: candidate.name,
    description: candidate.description,
    category: candidate.category,
    confidence: Number(score(candidate.pattern, text).toFixed(2)),
    signals: candidate.signals,
    evidenceIds: input.evidenceIds,
    sourceUrls: [input.url],
  }));
}
