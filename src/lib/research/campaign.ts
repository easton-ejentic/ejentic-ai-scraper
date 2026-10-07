/**
 * Campaigns group discovery work around one commercial question.
 *
 * A campaign is the container a user creates before running anything: "Dental
 * practices in Bristol", "Solicitors in Birmingham". Jobs, companies, workflows
 * and opportunities can all be attached to it, which is what makes the
 * dashboard and campaign screens able to answer "what did we find for this?"
 * rather than showing one undifferentiated pile of results.
 */

export interface CampaignRecord {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  region: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDraft {
  name: string;
  description?: string | null;
  industry?: string | null;
  region?: string | null;
}

export type CampaignPatch = Partial<CampaignDraft>;

/** Per-campaign rollup used by the campaigns list and the dashboard. */
export interface CampaignSummary extends CampaignRecord {
  jobIds: string[];
  companyIds: string[];
  workflowIds: string[];
  opportunityIds: string[];
  jobCount: number;
  companyCount: number;
  workflowCount: number;
  opportunityCount: number;
  qualifiedCount: number;
  topScore: number | null;
  lastActivityAt: string | null;
}

const MAX_NAME = 120;
const MAX_DESCRIPTION = 600;

export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignValidationError";
  }
}

export function normaliseCampaignDraft(input: unknown): CampaignDraft {
  if (!input || typeof input !== "object") {
    throw new CampaignValidationError("A campaign payload is required.");
  }

  const source = input as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name.trim() : "";

  if (!name) throw new CampaignValidationError("Campaign name is required.");
  if (name.length > MAX_NAME) {
    throw new CampaignValidationError(`Campaign name must be ${MAX_NAME} characters or fewer.`);
  }

  const text = (value: unknown, limit: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, limit) : null;
  };

  return {
    name,
    description: text(source.description, MAX_DESCRIPTION),
    industry: text(source.industry, MAX_NAME),
    region: text(source.region, MAX_NAME),
  };
}

export function normaliseCampaignPatch(input: unknown): CampaignPatch {
  if (!input || typeof input !== "object") {
    throw new CampaignValidationError("A campaign payload is required.");
  }

  const source = input as Record<string, unknown>;
  if (Object.keys(source).length === 0) {
    throw new CampaignValidationError("Nothing to update.");
  }

  const patch: CampaignPatch = {};

  if ("name" in source) {
    const name = typeof source.name === "string" ? source.name.trim() : "";
    if (!name) throw new CampaignValidationError("Campaign name cannot be empty.");
    if (name.length > MAX_NAME) {
      throw new CampaignValidationError(`Campaign name must be ${MAX_NAME} characters or fewer.`);
    }
    patch.name = name;
  }

  const text = (key: "description" | "industry" | "region", limit: number) => {
    if (!(key in source)) return;
    const value = source[key];
    if (value === null || value === "") {
      patch[key] = null;
      return;
    }
    if (typeof value !== "string") {
      throw new CampaignValidationError(`${key} must be text or null.`);
    }
    const trimmed = value.trim();
    patch[key] = trimmed ? trimmed.slice(0, limit) : null;
  };

  text("description", MAX_DESCRIPTION);
  text("industry", MAX_NAME);
  text("region", MAX_NAME);

  return patch;
}

export function slugifyCampaignId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `campaign-${slug || "untitled"}-${Date.now().toString(36)}`;
}
