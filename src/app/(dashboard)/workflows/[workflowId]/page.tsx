"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/scraper/page-header";

type Evidence = { id: string; url: string; label: string; excerpt: string; createdAt: string };
type Workflow = { id: string; companyId: string; companyName: string; jobId: string; name: string; description: string; category: string; confidence: number; signals: string[]; evidenceIds: string[]; sourceUrls: string[]; firstSeenAt: string; lastSeenAt: string; evaluation?: { labor: number; repetition: number; informationSupport: number; scalability: number; economicConsequence: number; aiPlausibility: number; strategicAdvantage: number; overallScore: number; confidence: number; methodology: string; evaluatedAt: string } };

export default function WorkflowDetailPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [error, setError] = useState("");
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    params.then(({ workflowId }) => fetch(`/api/workflows/${workflowId}`).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to load workflow");
      setWorkflow(data.workflow); setEvidence(data.evidence ?? []);
    }).catch((e) => setError(e.message)));
  }, [params]);

  if (error) return <Card className="p-8"><h1 className="text-xl font-semibold">Unable to load workflow</h1><p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p></Card>;
  if (!workflow) return <div className="text-sm text-[var(--text-muted)]">Loading workflow...</div>;

  async function evaluate() {
    if (!workflow) return;
    setEvaluating(true);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/evaluate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Evaluation failed");
      setWorkflow(data.workflow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  const dimensions = workflow.evaluation ? [
    ["Labor", workflow.evaluation.labor],
    ["Repetition", workflow.evaluation.repetition],
    ["Information support", workflow.evaluation.informationSupport],
    ["Scalability", workflow.evaluation.scalability],
    ["Economic consequence", workflow.evaluation.economicConsequence],
    ["AI plausibility", workflow.evaluation.aiPlausibility],
    ["Strategic advantage", workflow.evaluation.strategicAdvantage],
  ] as const : [];

  return <div className="space-y-6">
    <Link href="/workflows" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={15}/> Back to workflows</Link>
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><PageHeader eyebrow="WORKFLOW RESEARCH" title={workflow.name} description={workflow.description} /><button onClick={evaluate} disabled={evaluating} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-[var(--surface-subtle)] disabled:opacity-50"><RefreshCw size={15} className={evaluating ? "animate-spin" : ""} /> {evaluating ? "Evaluating…" : "Run evaluation"}</button></div>
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5"><div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Company</div><Link href={`/companies/${workflow.companyId}`} className="mt-2 block font-[var(--font-display)] text-lg font-semibold hover:underline">{workflow.companyName}</Link></Card>
      <Card className="p-5"><div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Confidence</div><div className="mt-2 font-[var(--font-display)] text-2xl font-semibold">{Math.round(workflow.confidence * 100)}%</div></Card>
      <Card className="p-5"><div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Category</div><div className="mt-2 text-sm font-medium">{workflow.category}</div></Card>
    </div>
    <Card className="p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div><h2 className="font-[var(--font-display)] text-xl font-semibold">Ejentic evaluation</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Seven dimensions used to assess whether this workflow is a promising AI-agent candidate.</p></div>
        {workflow.evaluation ? <div className="text-left md:text-right"><div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Overall score</div><div className="font-[var(--font-display)] text-3xl font-semibold">{workflow.evaluation.overallScore}/100</div></div> : null}
      </div>
      {workflow.evaluation ? <div className="mt-6 grid gap-3 md:grid-cols-2">{dimensions.map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--border)] p-4"><div className="flex items-center justify-between text-sm"><span>{label}</span><strong>{value}/10</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${value * 10}%` }} /></div></div>)}</div> : <div className="mt-5 rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">No evaluation has been run yet.</div>}
      {workflow.evaluation ? <p className="mt-4 text-xs text-[var(--text-muted)]">Methodology: {workflow.evaluation.methodology}. This is the current development heuristic, not the finalized Ejentic scoring methodology.</p> : null}
    </Card>
    <Card className="p-5"><h2 className="font-[var(--font-display)] text-xl font-semibold">Detected signals</h2><div className="mt-4 flex flex-wrap gap-2">{workflow.signals.map((signal) => <span key={signal} className="rounded-md bg-[var(--surface-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)]">{signal}</span>)}</div></Card>
    <section><h2 className="mb-3 font-[var(--font-display)] text-xl font-semibold">Supporting evidence</h2><div className="space-y-3">{evidence.length ? evidence.map((item) => <Card key={item.id} className="p-5"><div className="flex items-center justify-between gap-4"><span className="rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium uppercase text-[var(--primary)]">{item.label}</span><a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:underline">Source <ExternalLink size={12}/></a></div><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">“{item.excerpt}”</p></Card>) : <Card className="p-8 text-center text-sm text-[var(--text-muted)]">No linked evidence was captured for this candidate.</Card>}</div></section>
    <section><h2 className="mb-3 font-[var(--font-display)] text-xl font-semibold">Source pages</h2><div className="space-y-2">{workflow.sourceUrls.map((url) => <Card key={url} className="p-4"><a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">{url}<ExternalLink size={13}/></a></Card>)}</div></section>
  </div>;
}
