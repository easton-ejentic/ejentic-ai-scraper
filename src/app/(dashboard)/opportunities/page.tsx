"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/scraper/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Opportunity = { id:string; companyName:string; workflowName:string; title:string; summary:string; agentConcept:string; score:number; confidence:number; status:string; evidenceIds:string[] };

export default function OpportunitiesPage() {
  const [items,setItems]=useState<Opportunity[]>([]); const [loading,setLoading]=useState(true); const [generating,setGenerating]=useState(false);
  // `loading` already starts true and refreshes fire from button handlers, so
  // this deliberately never sets it back to true - keeping the first statement
  // an `await` also avoids a synchronous setState inside the mount effect.
  const load=useCallback(async()=>{try{const r=await fetch("/api/opportunities"); const d=await r.json(); setItems(d.opportunities||[]);}finally{setLoading(false);}},[]);
  async function generate(){setGenerating(true); await fetch("/api/opportunities",{method:"POST"}); await load(); setGenerating(false);}
  useEffect(()=>{void load();},[load]);
  return <div className="space-y-6"><PageHeader eyebrow="OPPORTUNITIES" title="AI-Agent Opportunities" description="Turn evaluated workflows into concrete, evidence-backed agent opportunities." actions={<Button onClick={generate} disabled={generating}>{generating?"Generating…":"Generate opportunities"}</Button>} />
    <div className="rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">Development qualification uses the current <strong>heuristic-v1</strong> evaluation. It is not the finalized Ejentic sales methodology.</div>
    {loading?<Card className="p-6">Loading opportunities…</Card>:items.length===0?<Card className="p-8"><h3 className="text-lg font-semibold">No opportunities yet</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">Evaluate workflows first, then generate opportunities.</p></Card>:<div className="grid gap-4">{items.map(o=><Card key={o.id} className="p-5"><div className="flex flex-col justify-between gap-4 md:flex-row"><div><div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{o.companyName}</div><h2 className="mt-1 text-xl font-semibold">{o.title}</h2><p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">{o.summary}</p><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1">{o.agentConcept}</span><span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1">{o.status}</span><span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1">{o.evidenceIds.length} evidence</span></div></div><div className="flex items-start gap-3"><div className="text-right"><div className="text-3xl font-bold">{Math.round(o.score)}</div><div className="text-xs text-[var(--text-muted)]">/ 100</div></div><Link href={`/opportunities/${o.id}`}><Button variant="secondary">Review</Button></Link></div></div></Card>)}</div>}
  </div>;
}
