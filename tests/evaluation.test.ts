import { describe, expect, it } from "vitest";
import { evaluateWorkflow, type EvaluationInput } from "@/lib/research/evaluation";
import { discoverWorkflowCandidates } from "@/lib/research/workflow";

const DIMENSIONS = [
  "labor",
  "repetition",
  "informationSupport",
  "scalability",
  "economicConsequence",
  "aiPlausibility",
  "strategicAdvantage",
] as const;

const baseInput: EvaluationInput = {
  confidence: 0.8,
  signals: [],
  evidenceCount: 0,
  sourceCount: 1,
  workflowName: "Document processing & review",
  description: "Reviewing documents.",
};

describe("evaluateWorkflow", () => {
  it("returns all seven dimensions within 0-10", () => {
    const result = evaluateWorkflow({ ...baseInput, signals: ["labor", "repetition", "information"] });
    for (const dimension of DIMENSIONS) {
      expect(result[dimension]).toBeGreaterThanOrEqual(0);
      expect(result[dimension]).toBeLessThanOrEqual(10);
    }
  });

  it("never exceeds 100 on the overall score", () => {
    const result = evaluateWorkflow({
      ...baseInput,
      signals: ["labor", "repetition", "information", "economic-impact", "documents"],
      evidenceCount: 50,
      sourceCount: 40,
    });
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.overallScore).toBeGreaterThan(0);
  });

  it("scores a heavily-signalled workflow above a bare one", () => {
    const bare = evaluateWorkflow(baseInput);
    const rich = evaluateWorkflow({
      ...baseInput,
      signals: ["labor", "repetition", "information", "economic-impact"],
      evidenceCount: 6,
      sourceCount: 4,
    });
    expect(rich.overallScore).toBeGreaterThan(bare.overallScore);
  });

  it("is labelled as a provisional heuristic, not a final verdict", () => {
    expect(evaluateWorkflow(baseInput).methodology).toBe("heuristic-v1");
  });

  it("keeps confidence within 0-1", () => {
    const low = evaluateWorkflow({ ...baseInput, confidence: 0, evidenceCount: 0 });
    const high = evaluateWorkflow({ ...baseInput, confidence: 5, evidenceCount: 99 });
    expect(low.confidence).toBeGreaterThanOrEqual(0);
    expect(high.confidence).toBeLessThanOrEqual(1);
  });

  it("clamps negative and absurd inputs instead of producing NaN", () => {
    const result = evaluateWorkflow({
      ...baseInput,
      confidence: -3,
      evidenceCount: -10,
      sourceCount: -5,
    });
    for (const dimension of DIMENSIONS) {
      expect(Number.isFinite(result[dimension])).toBe(true);
    }
    expect(Number.isFinite(result.overallScore)).toBe(true);
  });
});

describe("discoverWorkflowCandidates", () => {
  it("detects a document-processing workflow from page text", () => {
    const candidates = discoverWorkflowCandidates({
      companyId: "company-1",
      companyName: "Northwind",
      jobId: "job-1",
      url: "https://northwind.example.com/",
      text: "We handle document review and records processing for every claim that arrives.",
      evidenceIds: ["e1"],
    });
    expect(candidates.map((candidate) => candidate.name)).toContain(
      "Document processing & review",
    );
  });

  it("returns nothing when the text matches no pattern", () => {
    const candidates = discoverWorkflowCandidates({
      companyId: "company-1",
      companyName: "Northwind",
      jobId: "job-1",
      url: "https://northwind.example.com/",
      text: "Welcome to our website. Nice weather today.",
      evidenceIds: [],
    });
    expect(candidates).toEqual([]);
  });

  it("keeps confidence between 0 and 1", () => {
    const candidates = discoverWorkflowCandidates({
      companyId: "company-1",
      companyName: "Northwind",
      jobId: "job-1",
      url: "https://northwind.example.com/",
      text: "claims claims claims claims claims claims claims claims case management requests",
      evidenceIds: [],
    });
    for (const candidate of candidates) {
      expect(candidate.confidence).toBeGreaterThan(0);
      expect(candidate.confidence).toBeLessThanOrEqual(1);
    }
  });
});
