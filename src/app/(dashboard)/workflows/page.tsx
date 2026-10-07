"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch, Search, ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/scraper/page-header";

type Workflow = {
  id: string; companyId: string; companyName: string; jobId: string; name: string;
  description: string; category: string; confidence: number; signals: string[];
  evidenceIds: string[]; sourceUrls: string[]; firstSeenAt: string; lastSeenAt: string;
  evaluation?: { overallScore: number; confidence: number; methodology: string };
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((data) => setWorkflows(data.workflows ?? []))
      .finally(() => setLoading(false));
  }, []);

  const evaluateAll = async () => {
    setEvaluating(true);
    try {
      const response = await fetch("/api/workflows/evaluate", { method: "POST" });
      const data = await response.json();
      setWorkflows(data.workflows ?? []);
    } finally {
      setEvaluating(false);
    }
  };

  const categories = useMemo(() => ["all", ...new Set(workflows.map((w) => w.category))], [workflows]);
  const filtered = workflows.filter((w) => {
    const matchesQuery = `${w.name} ${w.companyName} ${w.description} ${w.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "all" || w.category === category);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><PageHeader eyebrow="RESEARCH" title="Workflows" description="Candidate business workflows detected from company pages and evidence." /><button onClick={evaluateAll} disabled={evaluating} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-[var(--surface-subtle)] disabled:opacity-50"><RefreshCw size={15} className={evaluating ? "animate-spin" : ""} /> {evaluating ? "Evaluating…" : "Evaluate all"}</button></div>
      <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--border)] bg-white p-3 md:flex-row">
        <div className="flex flex-1 items-center gap-3 px-2">
          <Search size={17} className="text-[var(--text-muted)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search workflows or companies..." className="w-full bg-transparent text-sm outline-none" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none">
          {categories.map((item) => <option key={item} value={item}>{item === "all" ? "All categories" : item}</option>)}
        </select>
      </div>
      <div className="text-sm text-[var(--text-muted)]">{loading ? "Loading..." : `${filtered.length} workflow candidate${filtered.length === 1 ? "" : "s"}`}</div>
      {!loading && filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <GitBranch className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
          <h2 className="text-lg font-semibold">No workflow candidates yet</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Run a discovery job first. Workflow candidates are generated from successfully crawled company pages.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((workflow) => (
            <Card key={workflow.id} className="p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="min-w-0">
                  <Link href={`/workflows/${workflow.id}`} className="font-[var(--font-display)] text-xl font-semibold hover:underline">{workflow.name}</Link>
                  <Link href={`/companies/${workflow.companyId}`} className="mt-1 block text-sm text-[var(--text-secondary)] hover:underline">{workflow.companyName}</Link>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{workflow.description}</p>
                </div>
                <div className="shrink-0 text-left md:text-right">
                  <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Confidence</div>
                  <div className="mt-1 font-[var(--font-display)] text-2xl font-semibold">{workflow.evaluation ? `${workflow.evaluation.overallScore}/100` : `${Math.round(workflow.confidence * 100)}%`}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{workflow.evaluation ? "Suitability" : "Detection confidence"}</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]">{workflow.category}</span>
                {workflow.signals.map((signal) => <span key={signal} className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]">{signal}</span>)}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
                <span>{workflow.evidenceIds.length} evidence item{workflow.evidenceIds.length === 1 ? "" : "s"}</span>
                <span>{workflow.sourceUrls.length} source{workflow.sourceUrls.length === 1 ? "" : "s"}</span>
                {workflow.sourceUrls[0] && <a href={workflow.sourceUrls[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">View source <ExternalLink size={12} /></a>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
