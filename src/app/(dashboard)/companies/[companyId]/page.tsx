"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/scraper/page-header";

type Company = { id: string; name: string; domain: string; website: string; description: string | null; pageCount: number; jobIds: string[]; pages: Array<{ id: string; url: string; title: string | null; description: string | null; crawledAt: string; text: string }> };
type Evidence = { id: string; url: string; label: string; excerpt: string; createdAt: string };

export default function CompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(({ companyId }) => fetch(`/api/companies/${companyId}`).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to load company");
      setCompany(data.company); setEvidence(data.evidence ?? []);
    }).catch((e) => setError(e.message)));
  }, [params]);

  if (error) return <Card className="p-8"><h1 className="text-xl font-semibold">Unable to load company</h1><p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p></Card>;
  if (!company) return <div className="text-sm text-[var(--text-muted)]">Loading company...</div>;

  return <div className="space-y-6">
    <Link href="/companies" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={15}/> Back to companies</Link>
    <PageHeader eyebrow="COMPANY RESEARCH" title={company.name} description={company.description || "Company profile assembled from discovered web pages."} />
    <Card className="p-5"><div className="flex flex-wrap gap-6 text-sm"><a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium hover:underline">{company.domain}<ExternalLink size={14}/></a><span>{company.pageCount} pages discovered</span><span>{company.jobIds.length} discovery jobs</span></div></Card>
    <section><h2 className="mb-3 text-xl font-semibold">Evidence</h2><div className="space-y-3">{evidence.length ? evidence.map((item) => <Card key={item.id} className="p-5"><div className="flex items-center justify-between gap-4"><span className="rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium uppercase text-[var(--primary)]">{item.label}</span><a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-muted)] hover:underline">Source</a></div><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">“{item.excerpt}”</p></Card>) : <Card className="p-8 text-center text-sm text-[var(--text-muted)]">No evidence snippets have been extracted yet.</Card>}</div></section>
    <section><h2 className="mb-3 text-xl font-semibold">Discovered pages</h2><div className="space-y-2">{company.pages.map((page) => <Card key={page.id} className="p-4"><div className="flex gap-3"><FileText size={18} className="mt-0.5 text-[var(--text-muted)]"/><div className="min-w-0"><a href={page.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{page.title || page.url}</a><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{page.url}</p><p className="mt-2 text-xs text-[var(--text-muted)]">Crawled {new Date(page.crawledAt).toLocaleString()}</p></div></div></Card>)}</div></section>
  </div>;
}
