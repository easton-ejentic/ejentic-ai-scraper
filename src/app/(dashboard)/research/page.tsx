"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Cpu,
  ExternalLink,
  FileText,
  GitBranch,
  Loader2,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/scraper/page-header";

type Company = {
  id: string;
  name: string;
  domain: string;
  website: string;
  description: string | null;
  pageCount: number;
  jobIds: string[];
  lastSeenAt: string;
};

type Evidence = {
  id: string;
  url: string;
  label: string;
  excerpt: string;
  createdAt: string;
};

type Page = {
  id: string;
  url: string;
  title: string | null;
  crawledAt: string;
};

type DossierCompany = Company & { pages: Page[] };

type Workflow = {
  id: string;
  name: string;
  description: string;
  category: string;
  confidence: number;
  evidenceIds: string[];
  sourceUrls: string[];
  evaluation?: {
    labor: number;
    repetition: number;
    informationSupport: number;
    scalability: number;
    economicConsequence: number;
    aiPlausibility: number;
    strategicAdvantage: number;
    overallScore: number;
    confidence: number;
    methodology: string;
  };
};

type Opportunity = {
  id: string;
  workflowId: string;
  title: string;
  summary: string;
  score: number;
  confidence: number;
  status: string;
};

const DIMENSIONS: { key: keyof NonNullable<Workflow["evaluation"]>; label: string }[] = [
  { key: "labor", label: "Labour intensity" },
  { key: "repetition", label: "Repetition" },
  { key: "informationSupport", label: "Information support" },
  { key: "scalability", label: "Scalability" },
  { key: "economicConsequence", label: "Economic consequence" },
  { key: "aiPlausibility", label: "AI plausibility" },
  { key: "strategicAdvantage", label: "Strategic advantage" },
];

export default function ResearchPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [company, setCompany] = useState<DossierCompany | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionNote, setActionNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then((response) => response.json())
      .then((data) => setCompanies(data.companies ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function loadDossier(id: string) {
    setDetailLoading(true);
    setDetailError(null);
    setActionNote(null);
    try {
      const response = await fetch(`/api/research/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load this company");
      setCompany(data.company ?? null);
      setEvidence(data.evidence ?? []);
      setWorkflows(data.workflows ?? []);
      setOpportunities(data.opportunities ?? []);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : "Could not load this company");
    } finally {
      setDetailLoading(false);
    }
  }

  // Fetched from the click handler rather than an effect: setState synchronously
  // inside an effect is exactly what the React compiler flags, and an effect
  // keyed on selectedId would also fire on mount for no reason.
  function selectCompany(id: string) {
    setSelectedId(id);
    void loadDossier(id);
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return companies;
    return companies.filter((item) =>
      `${item.name} ${item.domain} ${item.description ?? ""}`.toLowerCase().includes(needle),
    );
  }, [companies, query]);

  async function evaluateWorkflow(workflowId: string) {
    setEvaluatingId(workflowId);
    setActionNote(null);
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/evaluate`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Evaluation failed");
      if (selectedId) await loadDossier(selectedId);
      setActionNote("Workflow evaluated.");
    } catch (cause) {
      setActionNote(cause instanceof Error ? cause.message : "Evaluation failed");
    } finally {
      setEvaluatingId(null);
    }
  }

  async function evaluateAll() {
    setGenerating(true);
    setActionNote(null);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate-all" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Evaluation failed");
      if (selectedId) await loadDossier(selectedId);
      setActionNote(`Evaluated ${data.count ?? 0} workflows.`);
    } catch (cause) {
      setActionNote(cause instanceof Error ? cause.message : "Evaluation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function generateOpportunities() {
    setGenerating(true);
    setActionNote(null);
    try {
      const response = await fetch("/api/opportunities", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      if (selectedId) await loadDossier(selectedId);
      setActionNote(`Generated ${data.opportunities?.length ?? 0} opportunities.`);
    } catch (cause) {
      setActionNote(cause instanceof Error ? cause.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const opportunityByWorkflow = useMemo(() => {
    const map = new Map<string, Opportunity>();
    for (const opportunity of opportunities) map.set(opportunity.workflowId, opportunity);
    return map;
  }, [opportunities]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow="RESEARCH"
        title="Research"
        description="Pick a company and read the evidence behind it. Every workflow statement links back to the page it came from, so a claim can always be checked."
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit p-4">
          <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-white px-3 py-2">
            <Search size={16} className="text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a company..."
              className="w-full bg-transparent text-[14px] outline-none"
            />
          </div>

          <div className="mt-3 text-[12px] text-[var(--text-muted)]">
            {loading ? "Loading..." : `${filtered.length} compan${filtered.length === 1 ? "y" : "ies"}`}
          </div>

          <div className="mt-2 max-h-[560px] space-y-1 overflow-y-auto">
            {!loading && filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-[13px] text-[var(--text-muted)]">
                {companies.length === 0
                  ? "No companies yet. Run a discovery job first."
                  : "No companies match that search."}
              </p>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => selectCompany(item.id)}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left",
                  selectedId === item.id
                    ? "bg-[var(--primary-soft)]"
                    : "hover:bg-[var(--surface-subtle)]",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{item.name}</div>
                  <div className="truncate text-[12px] text-[var(--text-muted)]">{item.domain}</div>
                </div>
                <ChevronRight size={15} className="shrink-0 text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        </Card>

        <div className="min-w-0">
          {!selectedId ? (
            <Card className="p-12 text-center">
              <Building2 className="mx-auto mb-3 text-[var(--text-muted)]" size={30} />
              <h2 className="text-[19px] font-semibold">Select a company</h2>
              <p className="mx-auto mt-2 max-w-[480px] text-[14px] text-[var(--text-secondary)]">
                Choose a company on the left to see the pages we read, the evidence we
                extracted, the workflows we inferred, and the opportunities scored from them.
              </p>
              {companies.length > 0 && (
                <div className="mt-5">
                  <Button onClick={() => selectCompany(companies[0].id)}>
                    Open {companies[0].name}
                  </Button>
                </div>
              )}
            </Card>
          ) : detailLoading ? (
            <Card className="p-12 text-center text-[14px] text-[var(--text-muted)]">
              Loading dossier...
            </Card>
          ) : detailError ? (
            <Card className="p-12 text-center">
              <p className="text-[14px] text-[var(--danger)]">{detailError}</p>
              <Button className="mt-4" variant="secondary" onClick={() => selectedId && loadDossier(selectedId)}>
                Retry
              </Button>
            </Card>
          ) : company ? (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[24px] font-semibold tracking-[-0.02em]">{company.name}</h2>
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[14px] text-[var(--text-secondary)] hover:underline"
                    >
                      {company.domain} <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="flex gap-4 text-[13px] text-[var(--text-muted)]">
                    <span>
                      <strong className="text-[var(--text-primary)]">{company.pages?.length ?? 0}</strong> pages
                    </span>
                    <span>
                      <strong className="text-[var(--text-primary)]">{company.jobIds.length}</strong> jobs
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-[14px] text-[var(--text-secondary)]">
                  {company.description || "No description could be extracted from the pages read."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={evaluateAll} disabled={generating || workflows.length === 0}>
                    {generating ? <Loader2 size={15} className="animate-spin" /> : <Cpu size={15} />}
                    Evaluate all workflows
                  </Button>
                  <Button onClick={generateOpportunities} disabled={generating}>
                    {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    Generate opportunities
                  </Button>
                </div>
                {actionNote && (
                  <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{actionNote}</p>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[var(--text-muted)]" />
                  <h3 className="text-[15px] font-semibold">
                    Evidence <span className="text-[var(--text-muted)]">({evidence.length})</span>
                  </h3>
                </div>
                {evidence.length === 0 ? (
                  <p className="mt-4 text-[14px] text-[var(--text-muted)]">
                    No evidence extracted. Crawl more pages for this company.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {evidence.slice(0, 12).map((item) => (
                      <div key={item.id} className="rounded-lg border border-[var(--border)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge status="neutral" label={item.label} />
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex max-w-[60%] items-center gap-1 truncate text-[12px] text-[var(--primary)] hover:underline"
                          >
                            {item.url} <ExternalLink size={12} />
                          </a>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                          “{item.excerpt}”
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-[var(--text-muted)]" />
                  <h3 className="text-[15px] font-semibold">
                    Workflows <span className="text-[var(--text-muted)]">({workflows.length})</span>
                  </h3>
                </div>
                {workflows.length === 0 ? (
                  <p className="mt-4 text-[14px] text-[var(--text-muted)]">
                    No workflows inferred yet. Workflows are derived from the language on the
                    pages we crawl — more pages means better coverage.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {workflows.map((workflow) => {
                      const opportunity = opportunityByWorkflow.get(workflow.id);
                      return (
                        <div key={workflow.id} className="rounded-lg border border-[var(--border)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/workflows/${workflow.id}`}
                                className="text-[15px] font-medium hover:underline"
                              >
                                {workflow.name}
                              </Link>
                              <div className="text-[12px] text-[var(--text-muted)]">
                                {workflow.category} · {workflow.evidenceIds.length} evidence ·{" "}
                                {workflow.sourceUrls.length} sources
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <StatusBadge
                                status="neutral"
                                label={`${Math.round(workflow.confidence * 100)}% conf`}
                              />
                              <button
                                onClick={() => evaluateWorkflow(workflow.id)}
                                disabled={evaluatingId === workflow.id}
                                className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-[13px] hover:bg-[var(--surface-subtle)] disabled:opacity-50"
                              >
                                {evaluatingId === workflow.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Cpu size={13} />
                                )}
                                Evaluate
                              </button>
                            </div>
                          </div>

                          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                            {workflow.description}
                          </p>

                          {workflow.sourceUrls.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {workflow.sourceUrls.slice(0, 4).map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex max-w-[280px] items-center gap-1 truncate text-[12px] text-[var(--primary)] hover:underline"
                                >
                                  {url.replace(/^https?:\/\//, "")} <ExternalLink size={11} />
                                </a>
                              ))}
                            </div>
                          )}

                          {workflow.evaluation && (
                            <div className="mt-4 rounded-lg bg-[var(--surface-subtle)] p-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
                                  {workflow.evaluation.methodology}
                                </span>
                                <span
                                  className="text-[20px] font-bold"
                                  style={{ fontFamily: "var(--font-display)" }}
                                >
                                  {workflow.evaluation.overallScore.toFixed(1)}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {DIMENSIONS.map(({ key, label }) => {
                                  const value = workflow.evaluation![key] as number;
                                  return (
                                    <div key={String(key)}>
                                      <div className="flex justify-between text-[12px]">
                                        <span className="text-[var(--text-secondary)]">{label}</span>
                                        <span className="font-medium">{value.toFixed(1)}</span>
                                      </div>
                                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                                        <div
                                          className="h-full rounded-full bg-[var(--primary)]"
                                          style={{ width: `${value * 10}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {opportunity && (
                            <Link
                              href={`/opportunities/${opportunity.id}`}
                              className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-subtle)]"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                                  <Target size={13} /> Opportunity
                                </div>
                                <div className="truncate text-[14px] font-medium">
                                  {opportunity.title}
                                </div>
                              </div>
                              <span
                                className="shrink-0 text-[20px] font-bold"
                                style={{ fontFamily: "var(--font-display)" }}
                              >
                                {opportunity.score.toFixed(0)}
                              </span>
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
