"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/scraper/page-header";

type Company = {
  id: string; name: string; domain: string; website: string;
  description: string | null; firstSeenAt: string; lastSeenAt: string;
  pageCount: number; jobIds: string[];
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter((company) =>
    `${company.name} ${company.domain} ${company.description ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="DISCOVERY" title="Companies" description="Organizations discovered from crawler activity and page evidence." />
      <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-white px-4 py-3">
        <Search size={17} className="text-[var(--text-muted)]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies, domains, or descriptions..." className="w-full bg-transparent text-sm outline-none" />
      </div>
      <div className="text-sm text-[var(--text-muted)]">{loading ? "Loading..." : `${filtered.length} compan${filtered.length === 1 ? "y" : "ies"} discovered`}</div>
      {filtered.length === 0 && !loading ? (
        <Card className="p-10 text-center">
          <Building2 className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
          <h2 className="text-lg font-semibold">No companies yet</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create a job, describe the businesses you want (name, niche or location), and the pages we crawl will show up here automatically.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((company) => (
            <Card key={company.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/companies/${company.id}`} className="font-[var(--font-display)] text-xl font-semibold hover:underline">{company.name}</Link>
                  <a href={company.website} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:underline">{company.domain}<ExternalLink size={13} /></a>
                </div>
                <StatusBadge status="success" label="discovered" />
              </div>
              <p className="mt-4 line-clamp-3 text-sm text-[var(--text-secondary)]">{company.description || "No description extracted yet."}</p>
              <div className="mt-5 flex gap-6 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
                <span><strong className="text-[var(--text-primary)]">{company.pageCount}</strong> pages</span>
                <span><strong className="text-[var(--text-primary)]">{company.jobIds.length}</strong> jobs</span>
                <span>Last seen {new Date(company.lastSeenAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
