"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "./page-header";
import type { ScraperJob } from "@/lib/scraper/job-types";

function statusBadge(status: ScraperJob["status"]) {
  switch (status) {
    case "running":
      return { status: "running" as const, label: "Running" };
    case "paused":
      return { status: "warning" as const, label: "Paused" };
    case "completed":
      return { status: "success" as const, label: "Completed" };
    case "failed":
      return { status: "error" as const, label: "Failed" };
    case "cancelled":
      return { status: "neutral" as const, label: "Cancelled" };
    case "queued":
    default:
      return { status: "neutral" as const, label: "Queued" };
  }
}

export function JobsList({ jobs }: { jobs: ScraperJob[] }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
      <PageHeader
        title="Jobs"
        description="All scraper jobs — active, queued, and historical."
        actions={
          <Link href="/scraper/jobs/new">
            <Button>
              <Plus size={17} className="mr-2" />
              New Job
            </Button>
          </Link>
        }
      />

      <Card className="mt-8 overflow-hidden">
        <div className="hidden border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)] md:grid md:grid-cols-12 md:gap-4">
          <div className="md:col-span-4">Job</div>
          <div className="md:col-span-2">Status</div>
          <div className="md:col-span-3">Progress</div>
          <div className="md:col-span-2">Error rate</div>
          <div className="md:col-span-1" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {jobs.map((job) => {
            const badge = statusBadge(job.status);
            const progress =
              job.totalUrls > 0
                ? (job.processedUrls / job.totalUrls) * 100
                : 0;
            return (
              <div
                key={job.id}
                className="grid gap-3 px-5 py-4 md:grid-cols-12 md:items-center md:gap-4"
              >
                <div className="md:col-span-4">
                  <Link
                    href={`/scraper/jobs/${job.id}`}
                    className="text-[14px] font-medium hover:text-[var(--primary)]"
                  >
                    {job.name}
                  </Link>
                  <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {job.id} · {job.targetLabel}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <StatusBadge status={badge.status} label={badge.label} />
                </div>
                <div className="md:col-span-3">
                  <div className="mb-1 flex justify-between text-[12px] text-[var(--text-muted)]">
                    <span>
                      {job.processedUrls.toLocaleString()} /{" "}
                      {job.totalUrls.toLocaleString()}
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
                <div className="text-[13px] text-[var(--text-secondary)] md:col-span-2">
                  {job.errorRate}%
                </div>
                <div className="md:col-span-1 md:text-right">
                  <Link href={`/scraper/jobs/${job.id}`}>
                    <Button variant="ghost" className="h-8 px-2 text-[13px]">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
