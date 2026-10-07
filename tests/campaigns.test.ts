import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CampaignValidationError,
  normaliseCampaignDraft,
  normaliseCampaignPatch,
} from "../src/lib/research/campaign";

/**
 * Campaigns are the container discovery work is filed under, so they must
 * persist and roll up correctly — and deleting one must never delete the crawl
 * evidence underneath it.
 */
const originalCwd = process.cwd();
let tempDir: string;
type Store = typeof import("../src/lib/scraper/persistent-store");
let store: Store;

function jobDraft(name: string, campaignId?: string) {
  return {
    name,
    targetType: "url-list" as const,
    campaignId,
    urlLimit: 5,
    sources: { websites: true, search: false, directories: false, social: false },
    configuration: { workers: 1, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "ejentic-campaigns-"));
  process.chdir(tempDir);
  store = await import("../src/lib/scraper/persistent-store");
}, 60_000);

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

describe("campaign validation", () => {
  it("requires a name", () => {
    expect(() => normaliseCampaignDraft({ name: "   " })).toThrow(CampaignValidationError);
  });

  it("trims the name", () => {
    expect(normaliseCampaignDraft({ name: "  Bristol dentals  " }).name).toBe("Bristol dentals");
  });

  it("rejects an over-long name rather than silently truncating it", () => {
    // Truncating a name the user typed would mangle it; a clear 400 lets them
    // shorten it themselves. Softer fields (description, industry, region) are
    // truncated instead.
    expect(() => normaliseCampaignDraft({ name: "x".repeat(121) })).toThrow(CampaignValidationError);
    expect(normaliseCampaignDraft({ name: "x".repeat(120) }).name).toHaveLength(120);
  });

  it("turns blank optional fields into null rather than empty strings", () => {
    const draft = normaliseCampaignDraft({ name: "Test", description: "   ", industry: "" });
    expect(draft.description).toBeNull();
    expect(draft.industry).toBeNull();
  });

  it("rejects a non-object payload", () => {
    expect(() => normaliseCampaignDraft(null)).toThrow(CampaignValidationError);
  });

  it("rejects an empty patch", () => {
    expect(() => normaliseCampaignPatch({})).toThrow(CampaignValidationError);
  });

  it("allows clearing a field with null", () => {
    expect(normaliseCampaignPatch({ region: null })).toEqual({ region: null });
  });
});

describe("campaign persistence", () => {
  it("creates, lists and reads a campaign", () => {
    const created = store.createStoredCampaign({
      name: "Bristol dentals",
      industry: "Dentistry",
      region: "Bristol",
    });

    expect(created.id).toMatch(/^campaign-bristol-dentals-/);
    expect(created.industry).toBe("Dentistry");

    const found = store.getStoredCampaign(created.id);
    expect(found?.name).toBe("Bristol dentals");
    expect(store.listStoredCampaigns().some((item) => item.id === created.id)).toBe(true);
  });

  it("updates only the supplied fields and bumps updatedAt", () => {
    const created = store.createStoredCampaign({ name: "Leeds accountants", region: "Leeds" });
    const updated = store.updateStoredCampaign(created.id, { region: "West Yorkshire" });
    expect(updated).toBeDefined();

    expect(updated!.region).toBe("West Yorkshire");
    expect(updated!.industry).toBeNull();
    expect(updated!.updatedAt >= created.updatedAt).toBe(true);
  });

  it("returns undefined for an unknown id", () => {
    expect(store.getStoredCampaign("nope")).toBeUndefined();
    expect(store.updateStoredCampaign("nope", { name: "x" })).toBeUndefined();
    expect(store.deleteStoredCampaign("nope")).toBe(false);
  });

  it("rolls up jobs filed under the campaign", () => {
    const campaign = store.createStoredCampaign({ name: "Birmingham solicitors" });
    store.createStoredJob(jobDraft("firm search", campaign.id), ["https://a-solicitors.example.com"]);
    store.createStoredJob(jobDraft("second pass", campaign.id), ["https://b-solicitors.example.com"]);
    store.createStoredJob(jobDraft("unrelated"), ["https://other.example.com"]);

    const summary = store.getStoredCampaign(campaign.id)!;
    expect(summary.jobCount).toBe(2);
    expect(summary.jobIds).toHaveLength(2);
    expect(summary.lastActivityAt).not.toBeNull();
  });

  it("deletes the container but keeps the jobs underneath it", () => {
    const campaign = store.createStoredCampaign({ name: "Temporary container" });
    const job = store.createStoredJob(jobDraft("keep me", campaign.id), [
      "https://keep.example.com",
    ]);

    expect(store.deleteStoredCampaign(campaign.id)).toBe(true);

    const surviving = store.getStoredJob(job.id)!;
    expect(surviving).toBeDefined();
    // Detached, not destroyed - the crawl evidence outlives the container.
    expect(surviving.campaignId ?? null).toBeNull();
  });
});
