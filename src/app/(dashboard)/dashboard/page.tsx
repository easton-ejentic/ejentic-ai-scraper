"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  FolderKanban,
  Gauge,
  GitBranch,
  Layers,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/scraper/page-header";

type Overview = {
  stats: {
    campaigns: number;
    jobs: number;
    jobsRunning: number;
    jobsCompleted: number;
    companies: number;
    pagesCrawled: number;
    successfulPages: number;
    workflows: number;
    opportunities: number;
    qualified: number;
    averageScore: number;
    evaluatedWorkflows: number;
  };
  pipeline: {
    jobs: number;
    companies: number;
    workflows: number;
    opportunities: number;
    qualified: number;
  };
  opportunityStatus: Record<string, number>;
  topOpportunities: {
    id: string;
    companyName: string;
    workflowName: string;
    title: string;
    score: number;
    confidence: number;
    status: string;
  }[];
  recentJobs: {
    id: string;
    name: string;
    status: string;
    targetLabel: string;
    processedUrls: number;
    totalUrls: number;
    createdAt: string;
    campaignId: string | null;
  }[];
  recentActivity: {
    id: string;
    level: string;
    message: string;
    jobId: string;
    createdAt: string;
  }[];
  system: {
    storage: string;
    queue: string;
    workerConcurrency: number;
    searchProviders: { id: string; label: string; available: boolean; envVar: string }[];
  };
};

function jobStatusTone(status: string): "running" | "success" | "warning" | "error" | "neutral" {
  if (status === "running") return "running";
  if (status === "completed") return "success";
  if (status === "paused") return "warning";
  if (status === "failed") return "error";
  return "neutral";
}

function levelTone(level: string): "success" | "warning" | "error" | "neutral" {
  if (level === "success") return "success";
  if (level === "warning") return "warning";
  if (level === "error") return "error";
  return "neutral";
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/overview")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Failed to load overview");
        return body as Overview;
      })
      .then((body) => {
        if (active) setData(body);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load overview");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8">
        <p className="text-[14px] text-[var(--text-muted)]">Loading overview...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8">
        <Card className="p-8">
          <h2 className="text-[18px] font-semibold">Could not load the dashboard</h2>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{error}</p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  const { stats, pipeline, topOpportunities, recentJobs, recentActivity, system } = data;
  const isEmpty = stats.jobs === 0 && stats.companies === 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow="OVERVIEW"
        title="Dashboard"
        description="Where the pipeline stands right now — what has been crawled, what it turned into, and what is worth acting on."
        actions={
          <Link
            href="/scraper/jobs/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[14px] font-medium text-white hover:bg-[var(--primary-hover)]"
          >
            <Plus size={16} /> New discovery job
          </Link>
        }
      />

      {isEmpty ? (
        <Card className="p-10 text-center">
          <Gauge className="mx-auto mb-3 text-[var(--text-muted)]" size={30} />
          <h2 className="text-[20px] font-semibold">Nothing discovered yet</h2>
          <p className="mx-auto mt-2 max-w-[560px] text-[14px] text-[var(--text-secondary)]">
            Describe the businesses you want — a trade, a niche, a city — and the platform
            searches the open web for their websites, reads the pages, and turns what it
            finds into scored automation opportunities. You never have to paste a URL.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/scraper/jobs/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[14px] font-medium text-white hover:bg-[var(--primary-hover)]"
            >
              Start your first search <ArrowRight size={16} />
            </Link>
            <Link
              href="/campaigns"
              className="inline-flex h-10 items-center rounded-lg border border-[var(--border)] px-4 text-[14px] hover:bg-[var(--surface-subtle)]"
            >
              Create a campaign first
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={Layers} label="Discovery jobs" value={stats.jobs} hint={`${stats.jobsRunning} running · ${stats.jobsCompleted} completed`} />
            <StatTile icon={Building2} label="Companies found" value={stats.companies} hint={`${stats.pagesCrawled} pages crawled`} />
            <StatTile icon={GitBranch} label="Workflows" value={stats.workflows} hint={`${stats.evaluatedWorkflows} evaluated`} />
            <StatTile icon={Target} label="Opportunities" value={stats.opportunities} hint={`${stats.qualified} qualified · avg ${stats.averageScore}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-1">
              <h2 className="text-[15px] font-semibold">Pipeline</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                How raw crawling turns into qualified leads.
              </p>
              <div className="mt-5 space-y-3">
                <PipelineRow label="Jobs run" value={pipeline.jobs} max={Math.max(1, pipeline.jobs)} />
                <PipelineRow label="Companies" value={pipeline.companies} max={Math.max(1, pipeline.jobs)} />
                <PipelineRow label="Workflows" value={pipeline.workflows} max={Math.max(1, pipeline.jobs)} />
                <PipelineRow label="Opportunities" value={pipeline.opportunities} max={Math.max(1, pipeline.jobs)} />
                <PipelineRow label="Qualified" value={pipeline.qualified} max={Math.max(1, pipeline.jobs)} />
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Opportunity status
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(data.opportunityStatus).map(([status, count]) => (
                    <span
                      key={status}
                      className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-[12px]"
                    >
                      <strong className="text-[var(--text-primary)]">{count}</strong> {status}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Top opportunities</h2>
                <Link href="/opportunities" className="flex items-center gap-1 text-[13px] text-[var(--primary)] hover:underline">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              {topOpportunities.length === 0 ? (
                <p className="mt-4 text-[14px] text-[var(--text-muted)]">
                  No opportunities yet. Evaluate workflows to generate them.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {topOpportunities.map((item) => (
                    <Link
                      key={item.id}
                      href={`/opportunities/${item.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-subtle)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">{item.title}</div>
                        <div className="truncate text-[12px] text-[var(--text-muted)]">
                          {item.companyName} · {item.workflowName}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge status="neutral" label={item.status} />
                        <span
                          className="w-12 text-right text-[18px] font-bold"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {item.score.toFixed(0)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Recent jobs</h2>
                <Link href="/scraper/jobs" className="flex items-center gap-1 text-[13px] text-[var(--primary)] hover:underline">
                  All jobs <ArrowRight size={14} />
                </Link>
              </div>
              {recentJobs.length === 0 ? (
                <p className="mt-4 text-[14px] text-[var(--text-muted)]">No jobs yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {recentJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/scraper/jobs/${job.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-subtle)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">{job.name}</div>
                        <div className="truncate text-[12px] text-[var(--text-muted)]">
                          {job.targetLabel} · {job.processedUrls}/{job.totalUrls} pages
                        </div>
                      </div>
                      <StatusBadge status={jobStatusTone(job.status)} label={job.status} />
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Recent activity</h2>
                <Link href="/scraper/logs" className="flex items-center gap-1 text-[13px] text-[var(--primary)] hover:underline">
                  All logs <ArrowRight size={14} />
                </Link>
              </div>
              {recentActivity.length === 0 ? (
                <p className="mt-4 text-[14px] text-[var(--text-muted)]">No activity logged yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {recentActivity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 rounded-lg px-1 py-2">
                      <StatusBadge status={levelTone(entry.level)} label={entry.level} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-[var(--text-primary)]">{entry.message}</div>
                        <div className="text-[12px] text-[var(--text-muted)]">
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[var(--text-muted)]" />
          <h2 className="text-[15px] font-semibold">System</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Storage" value={system.storage} />
          <Detail label="Queue" value={system.queue} />
          <Detail label="Worker concurrency" value={String(system.workerConcurrency)} />
          <Detail
            label="Search provider"
            value={
              system.searchProviders.find((provider) => provider.available)?.label ?? "None configured"
            }
          />
        </div>
        {!system.searchProviders.some((provider) => provider.available) && (
          <p className="mt-4 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-[13px] text-[var(--warning)]">
            No search provider is available, so new searches will find nothing until one is
            configured. See Settings.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/campaigns" className="flex items-center gap-1.5 text-[13px] text-[var(--primary)] hover:underline">
            <FolderKanban size={14} /> {stats.campaigns} campaign{stats.campaigns === 1 ? "" : "s"}
          </Link>
          <Link href="/companies" className="flex items-center gap-1.5 text-[13px] text-[var(--primary)] hover:underline">
            <Building2 size={14} /> {stats.companies} companies
          </Link>
          <Link href="/workflows" className="flex items-center gap-1.5 text-[13px] text-[var(--primary)] hover:underline">
            <GitBranch size={14} /> {stats.workflows} workflows
          </Link>
          <Link href="/qualified-leads" className="flex items-center gap-1.5 text-[13px] text-[var(--primary)] hover:underline">
            <TrendingUp size={14} /> {stats.qualified} qualified
          </Link>
        </div>
      </Card>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
        <Icon size={14} />
        {label}
      </div>
      <div
        className="mt-2 text-[30px] font-bold tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[13px] text-[var(--text-muted)]">{hint}</div>
    </Card>
  );
}

function PipelineRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-[14px] text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
