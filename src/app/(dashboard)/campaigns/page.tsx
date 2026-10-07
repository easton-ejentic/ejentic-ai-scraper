"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  FolderKanban,
  Layers,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/scraper/page-header";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  region: string | null;
  createdAt: string;
  updatedAt: string;
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
};

type CampaignJob = {
  id: string;
  name: string;
  status: string;
  processedUrls: number;
  totalUrls: number;
  targetLabel: string;
  createdAt: string;
};

const EMPTY_FORM = { name: "", description: "", industry: "", region: "" };

function jobStatusTone(status: string): "running" | "success" | "warning" | "error" | "neutral" {
  if (status === "running") return "running";
  if (status === "completed") return "success";
  if (status === "paused") return "warning";
  if (status === "failed") return "error";
  return "neutral";
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // `loading` already starts true, and refreshes after create/delete don't need
  // a flash - so this never sets loading back to true itself. Keeping the
  // first statement an `await` also avoids a synchronous setState inside the
  // mount effect below, which the React compiler flags.
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCampaign = useCallback(async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setJobsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`);
      const data = await response.json();
      setJobs(data.jobs ?? []);
    } finally {
      setJobsLoading(false);
    }
  }, [openId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return campaigns;
    return campaigns.filter((campaign) =>
      `${campaign.name} ${campaign.industry ?? ""} ${campaign.region ?? ""} ${campaign.description ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [campaigns, query]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function startEdit(campaign: Campaign) {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      industry: campaign.industry ?? "",
      region: campaign.region ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        industry: form.industry || null,
        region: form.region || null,
      };
      const response = await fetch(
        editingId ? `/api/campaigns/${editingId}` : "/api/campaigns",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error ?? "Could not save the campaign.");
        return;
      }
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeCampaign(campaign: Campaign) {
    const confirmed = window.confirm(
      `Delete "${campaign.name}"? The jobs, companies and opportunities underneath it are kept - only the campaign container is removed.`,
    );
    if (!confirmed) return;
    const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error ?? "Could not delete the campaign.");
      return;
    }
    if (openId === campaign.id) setOpenId(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DISCOVERY"
        title="Campaigns"
        description="Group discovery runs around one question — a niche, a region, a sector — so results can be read together instead of as one undifferentiated pile."
        actions={
          <Button onClick={startCreate}>
            <Plus size={16} /> New campaign
          </Button>
        }
      />

      {formOpen && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">
              {editingId ? "Edit campaign" : "New campaign"}
            </h2>
            <button
              onClick={() => setFormOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-[13px] font-medium">Name *</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Bristol dental practices"
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium">Industry / niche</span>
              <input
                value={form.industry}
                onChange={(event) => setForm({ ...form, industry: event.target.value })}
                placeholder="Dentistry"
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium">Region</span>
              <input
                value={form.region}
                onChange={(event) => setForm({ ...form, region: event.target.value })}
                placeholder="Bristol, UK"
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[13px] font-medium">What are we trying to learn?</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                placeholder="Independent practices likely running appointment booking and patient intake by hand."
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-[14px] outline-none focus:border-[var(--primary)]"
              />
            </label>
          </div>

          {formError && (
            <p className="mt-4 text-[13px] text-[var(--danger)]">{formError}</p>
          )}

          <div className="mt-5 flex gap-2">
            <Button onClick={submitForm} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Create campaign"}
            </Button>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-white px-4 py-3">
        <Layers size={17} className="text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search campaigns by name, industry or region..."
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="text-sm text-[var(--text-muted)]">
        {loading ? "Loading..." : `${filtered.length} campaign${filtered.length === 1 ? "" : "s"}`}
      </div>

      {!loading && filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderKanban className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
          <h2 className="text-lg font-semibold">
            {campaigns.length === 0 ? "No campaigns yet" : "No campaigns match that search"}
          </h2>
          <p className="mx-auto mt-1 max-w-[520px] text-sm text-[var(--text-muted)]">
            {campaigns.length === 0
              ? "Create a campaign first, then run a discovery job inside it. Everything the crawler finds — companies, workflows, opportunities — rolls up here."
              : "Try a different name, industry or region."}
          </p>
          {campaigns.length === 0 && (
            <div className="mt-5">
              <Button onClick={startCreate}>
                <Plus size={16} /> Create your first campaign
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((campaign) => {
            const open = openId === campaign.id;
            return (
              <Card key={campaign.id} className="overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <button onClick={() => openCampaign(campaign.id)} className="min-w-0 text-left">
                      <h3 className="text-[19px] font-semibold tracking-[-0.01em] hover:underline">
                        {campaign.name}
                      </h3>
                      <p className="mt-1 max-w-[640px] text-[14px] text-[var(--text-secondary)]">
                        {campaign.description || "No description yet."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[var(--text-muted)]">
                        {campaign.industry && (
                          <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1">
                            {campaign.industry}
                          </span>
                        )}
                        {campaign.region && (
                          <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1">
                            {campaign.region}
                          </span>
                        )}
                        {campaign.lastActivityAt && (
                          <span className="py-1">
                            Last activity {new Date(campaign.lastActivityAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => startEdit(campaign)}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-[13px] hover:bg-[var(--surface-subtle)]"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={() => removeCampaign(campaign)}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-[13px] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-4">
                    <Metric icon={Layers} label="Jobs" value={campaign.jobCount} />
                    <Metric icon={Building2} label="Companies" value={campaign.companyCount} />
                    <Metric icon={Target} label="Opportunities" value={campaign.opportunityCount} />
                    <Metric
                      label="Top score"
                      value={campaign.topScore === null ? "—" : campaign.topScore.toFixed(1)}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/scraper/jobs/new?campaign=${encodeURIComponent(campaign.id)}`}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-[13px] font-medium text-white hover:bg-[var(--primary-hover)]"
                    >
                      <Plus size={14} /> Run discovery in this campaign
                    </Link>
                    {campaign.companyCount > 0 && (
                      <Link
                        href="/companies"
                        className="flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-[13px] hover:bg-[var(--surface-subtle)]"
                      >
                        View companies
                      </Link>
                    )}
                    {campaign.opportunityCount > 0 && (
                      <Link
                        href="/opportunities"
                        className="flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-[13px] hover:bg-[var(--surface-subtle)]"
                      >
                        View opportunities
                      </Link>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
                      Jobs in this campaign
                    </div>
                    {jobsLoading ? (
                      <p className="mt-3 text-[13px] text-[var(--text-muted)]">Loading jobs...</p>
                    ) : jobs.length === 0 ? (
                      <p className="mt-3 text-[13px] text-[var(--text-muted)]">
                        No jobs filed here yet. Use “Run discovery in this campaign” to start one.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {jobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white px-4 py-3"
                          >
                            <div className="min-w-0">
                              <Link
                                href={`/scraper/jobs/${job.id}`}
                                className="text-[14px] font-medium hover:underline"
                              >
                                {job.name}
                              </Link>
                              <div className="text-[12px] text-[var(--text-muted)]">
                                {job.targetLabel} · {job.processedUrls}/{job.totalUrls} pages
                              </div>
                            </div>
                            <StatusBadge status={jobStatusTone(job.status)} label={job.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div
        className="mt-1 text-[24px] font-bold tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
