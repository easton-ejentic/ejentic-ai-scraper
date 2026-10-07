"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "./page-header";
import type { QueueViewItem as QueueItem } from "@/lib/scraper/persistent-store";

function queueStatusBadge(status: QueueItem["status"]) {
  switch (status) {
    case "processing":
      return { status: "running" as const, label: "Processing" };
    case "completed":
      return { status: "success" as const, label: "Completed" };
    case "failed":
      return { status: "error" as const, label: "Failed" };
    case "pending":
    default:
      return { status: "neutral" as const, label: "Pending" };
  }
}

export function QueuePanel({ items }: { items: QueueItem[] }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
      <PageHeader
        title="Queue"
        description="URLs waiting to be processed across active and paused jobs."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Pending
          </div>
          <div
            className="mt-2 text-[28px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {items.filter((i) => i.status === "pending").length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Processing
          </div>
          <div
            className="mt-2 text-[28px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {items.filter((i) => i.status === "processing").length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Failed
          </div>
          <div
            className="mt-2 text-[28px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {items.filter((i) => i.status === "failed").length}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="hidden border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)] lg:grid lg:grid-cols-12 lg:gap-4">
          <div className="lg:col-span-4">URL</div>
          <div className="lg:col-span-3">Job</div>
          <div className="lg:col-span-2">Status</div>
          <div className="lg:col-span-1">Attempts</div>
          <div className="lg:col-span-1">Priority</div>
          <div className="lg:col-span-1">Enqueued</div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => {
            const badge = queueStatusBadge(item.status);
            return (
              <div
                key={item.id}
                className="grid gap-2 px-5 py-4 lg:grid-cols-12 lg:items-center lg:gap-4"
              >
                <div className="min-w-0 lg:col-span-4">
                  <div className="truncate text-[14px] font-medium">
                    {item.url}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {item.id}
                  </div>
                </div>
                <div className="lg:col-span-3">
                  <Link
                    href={`/scraper/jobs/${item.jobId}`}
                    className="text-[13px] text-[var(--primary)] hover:underline"
                  >
                    {item.jobName}
                  </Link>
                </div>
                <div className="lg:col-span-2">
                  <StatusBadge status={badge.status} label={badge.label} />
                </div>
                <div className="text-[13px] text-[var(--text-secondary)] lg:col-span-1">
                  {item.attempts}
                </div>
                <div className="text-[13px] text-[var(--text-secondary)] lg:col-span-1">
                  P{item.priority}
                </div>
                <div className="text-[13px] text-[var(--text-muted)] lg:col-span-1">
                  {item.enqueuedAt}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
