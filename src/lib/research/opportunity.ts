import type { WorkflowEvaluation } from "./evaluation";
import type { WorkflowRecord } from "./workflow";

export interface OpportunityRecord {
  id: string;
  workflowId: string;
  companyId: string;
  companyName: string;
  workflowName: string;
  title: string;
  summary: string;
  agentConcept: string;
  capabilities: string[];
  humanInvolvement: string;
  implementationNotes: string[];
  risks: string[];
  evidenceIds: string[];
  sourceUrls: string[];
  score: number;
  confidence: number;
  status: "new" | "reviewing" | "qualified" | "outreach" | "won" | "lost";
  createdAt: string;
  updatedAt: string;
}

function capabilityMap(name: string): string[] {
  const n = name.toLowerCase();
  if (n.includes("intake") || n.includes("onboarding")) return ["Collect information", "Validate submissions", "Identify missing information", "Route work", "Notify stakeholders"];
  if (n.includes("document")) return ["Receive documents", "Extract information", "Classify records", "Check completeness", "Route exceptions"];
  if (n.includes("claim") || n.includes("case")) return ["Collect case information", "Summarize records", "Check required information", "Route cases", "Generate status updates"];
  if (n.includes("schedule") || n.includes("coordination")) return ["Coordinate requests", "Check availability", "Schedule activities", "Send confirmations", "Handle follow-up"];
  if (n.includes("support")) return ["Classify requests", "Retrieve relevant information", "Draft responses", "Escalate exceptions", "Track resolution"];
  if (n.includes("billing") || n.includes("invoice")) return ["Prepare billing information", "Check records", "Identify discrepancies", "Send follow-up", "Route exceptions"];
  if (n.includes("report") || n.includes("data")) return ["Collect operational data", "Normalize information", "Generate recurring reports", "Flag anomalies", "Distribute results"];
  if (n.includes("sales") || n.includes("lead")) return ["Research prospects", "Enrich records", "Qualify inquiries", "Draft follow-up", "Route qualified leads"];
  return ["Collect workflow inputs", "Process structured information", "Route routine work", "Generate updates", "Escalate exceptions"];
}

export function generateOpportunity(workflow: WorkflowRecord): OpportunityRecord | null {
  const evaluation = workflow.evaluation;
  if (!evaluation) return null;
  const now = new Date().toISOString();
  const score = evaluation.overallScore;
  const confidence = Math.min(1, (workflow.confidence * 0.6) + (evaluation.confidence * 0.4));
  return {
    id: `opportunity-${Buffer.from(workflow.id).toString("base64url")}`,
    workflowId: workflow.id,
    companyId: workflow.companyId,
    companyName: workflow.companyName,
    workflowName: workflow.name,
    title: `${workflow.name} Agent Opportunity`,
    summary: `Potential AI-agent opportunity for ${workflow.companyName} based on the discovered ${workflow.name} workflow and its supporting evidence.`,
    agentConcept: `${workflow.name} Agent`,
    capabilities: capabilityMap(workflow.name),
    humanInvolvement: "Human review should remain in the loop for exceptions, consequential decisions, and cases where evidence is insufficient.",
    implementationNotes: [
      "Start with evidence-backed, repeatable steps in the workflow.",
      "Integrate with the client's existing systems only after workflow requirements are confirmed.",
      "Measure automation coverage, exception rate, and human review time before expanding scope.",
    ],
    risks: [
      "Public web evidence may not describe the full internal process.",
      "Automation boundaries and system integrations require customer discovery.",
      "High-impact decisions may require mandatory human review and additional controls.",
    ],
    evidenceIds: [...workflow.evidenceIds],
    sourceUrls: [...workflow.sourceUrls],
    score,
    confidence,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
}

export function qualificationReason(opportunity: OpportunityRecord): string[] {
  const reasons: string[] = [];
  if (opportunity.score >= 75) reasons.push("High workflow suitability score.");
  if (opportunity.confidence >= 0.65) reasons.push("Sufficient evidence confidence for development-stage review.");
  if (opportunity.evidenceIds.length >= 2) reasons.push("Multiple supporting evidence records.");
  if (reasons.length === 0) reasons.push("Requires additional evidence or research before qualification.");
  return reasons;
}
