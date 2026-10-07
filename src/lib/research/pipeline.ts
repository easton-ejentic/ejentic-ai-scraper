/**
 * Shared derivation for the discovery pipeline.
 *
 * Workflow discovery, scoring and opportunity generation used to live inline in
 * the JSON store, which meant the PostgreSQL repository had no implementation
 * at all (two `TODO`s) and the two backends could quietly drift apart.
 *
 * Everything here is pure: it takes plain data and returns plain data. Both
 * repositories call these helpers and then do their own persistence, so the
 * derivations cannot diverge and can be unit-tested without a database.
 */

import { evaluateWorkflow, type WorkflowEvaluation } from "./evaluation";
import {
  discoverWorkflowCandidates,
  type WorkflowRecord,
  type WorkflowSignal,
} from "./workflow";
import { generateOpportunity, type OpportunityRecord } from "./opportunity";

/** A workflow without the identity/timestamp fields the stores own. */
export type WorkflowCore = Omit<WorkflowRecord, "id" | "firstSeenAt" | "lastSeenAt">;

/** What a store already holds for one company, enough to merge against. */
export interface ExistingWorkflow extends WorkflowCore {
  id: string;
}

export interface WorkflowCreate extends WorkflowCore {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  evaluation: WorkflowEvaluation;
}

export interface WorkflowUpdate {
  id: string;
  confidence: number;
  evidenceIds: string[];
  sourceUrls: string[];
  evaluation: WorkflowEvaluation;
  lastSeenAt: string;
}

export interface WorkflowDerivation {
  create: WorkflowCreate[];
  update: WorkflowUpdate[];
}

/** Stable id shared by every backend: the company plus the workflow name. */
export function workflowIdFor(companyId: string, name: string): string {
  return `workflow-${Buffer.from(`${companyId}:${name}`).toString("base64url")}`;
}

/** Score a workflow from whatever evidence currently backs it. */
export function evaluationFor(workflow: {
  name: string;
  description: string;
  confidence: number;
  signals: WorkflowSignal[];
  evidenceIds: string[];
  sourceUrls: string[];
}): WorkflowEvaluation {
  return evaluateWorkflow({
    confidence: workflow.confidence,
    signals: workflow.signals,
    evidenceCount: workflow.evidenceIds.length,
    sourceCount: workflow.sourceUrls.length,
    workflowName: workflow.name,
    description: workflow.description,
  });
}

/**
 * Work out what should be stored after crawling one page.
 *
 * A workflow already recorded for this company is merged, not duplicated:
 * confidence rises to the strongest signal seen, and evidence/source lists
 * accumulate. Newly seen and updated workflows are both re-evaluated.
 */
export function deriveWorkflows(input: {
  companyId: string;
  companyName: string;
  jobId: string;
  url: string;
  text: string;
  evidenceIds: string[];
  existing: ExistingWorkflow[];
  now: string;
}): WorkflowDerivation {
  const create: WorkflowCreate[] = [];
  const update: WorkflowUpdate[] = [];

  const byName = new Map(input.existing.map((workflow) => [workflow.name, workflow]));

  for (const candidate of discoverWorkflowCandidates({
    companyId: input.companyId,
    companyName: input.companyName,
    jobId: input.jobId,
    url: input.url,
    text: input.text,
    evidenceIds: input.evidenceIds,
  })) {
    const existing = byName.get(candidate.name);

    if (existing) {
      const merged: ExistingWorkflow = {
        ...existing,
        confidence: Math.max(existing.confidence, candidate.confidence),
        // A re-crawl of the same page can surface the same evidence id, so
        // dedupe before it inflates the confidence bonus.
        evidenceIds: [...new Set([...existing.evidenceIds, ...candidate.evidenceIds])],
        sourceUrls: [...new Set([...existing.sourceUrls, ...candidate.sourceUrls])],
      };
      update.push({
        id: merged.id,
        confidence: merged.confidence,
        evidenceIds: merged.evidenceIds,
        sourceUrls: merged.sourceUrls,
        evaluation: evaluationFor(merged),
        lastSeenAt: input.now,
      });
      continue;
    }

    const id = workflowIdFor(input.companyId, candidate.name);
    create.push({
      ...candidate,
      id,
      firstSeenAt: input.now,
      lastSeenAt: input.now,
      evaluation: evaluationFor(candidate),
    });
  }

  return { create, update };
}

/**
 * Build the opportunity for a workflow, evaluating it first if needed.
 *
 * `existing` lets a caller preserve what a human decided: the status they set
 * and the original creation time survive a re-generation.
 */
export function deriveOpportunity(
  workflow: WorkflowRecord,
  existing?: { id: string; status: OpportunityRecord["status"]; createdAt: string } | null,
): OpportunityRecord | null {
  const evaluation = workflow.evaluation ?? evaluationFor(workflow);
  const generated = generateOpportunity({ ...workflow, evaluation });
  if (!generated) return null;

  if (!existing) return generated;

  return {
    ...generated,
    id: existing.id,
    status: existing.status,
    createdAt: existing.createdAt,
  };
}
