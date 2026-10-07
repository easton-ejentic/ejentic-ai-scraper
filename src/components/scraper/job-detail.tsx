"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Play, Square, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import type { ActivityEvent, ScraperJob, Worker } from "@/lib/scraper/job-types";
import { updateJob } from "@/lib/scraper/client";

function statusToBadge(
  status: ScraperJob["status"]
): {
  status: "running" | "success" | "warning" | "error" | "neutral";
  label: string;
} {
  switch (status) {
    case "running":
      return { status: "running", label: "Running" };
    case "paused":
      return { status: "warning", label: "Paused" };
    case "completed":
      return { status: "success", label: "Completed" };
    case "failed":
      return { status: "error", label: "Failed" };
    case "cancelled":
      return { status: "neutral", label: "Cancelled" };
    case "queued":
    default:
      return { status: "neutral", label: "Queued" };
  }
}

export function JobDetail({
  job: initialJob,
  workers,
  events,
}: {
  job: ScraperJob;
  workers: Worker[];
  events: ActivityEvent[];
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const progress =
    job.totalUrls > 0
      ? (job.processedUrls / job.totalUrls) * 100
      : 0;
  const successRate =
    job.processedUrls > 0
      ? ((job.successfulUrls / job.processedUrls) * 100).toFixed(1)
      : "—";
  const badge = statusToBadge(job.status);

  const runAction = async (action: "pause" | "resume" | "cancel") => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateJob(job.id, action);
      setJob(updated);
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Action failed"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
      <div className="mb-6">
        <Link
          href="/scraper/control-center"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={15} />
          Back to Control Center
        </Link>
      </div>

      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
            JOB · {job.id}
          </div>
          <h1 className="mt-1 text-[28px] font-bold tracking-[-0.025em] lg:text-[34px]">
            {job.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={badge.status} label={badge.label} />
            <span className="text-[13px] text-[var(--text-muted)]">
              Target: {job.targetLabel}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {job.status === "running" && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => runAction("pause")}
            >
              <Pause size={15} className="mr-1.5" />
              Pause
            </Button>
          )}
          {(job.status === "paused" || job.status === "queued") && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => runAction("resume")}
            >
              <Play size={15} className="mr-1.5" />
              Resume
            </Button>
          )}
          {(job.status === "running" ||
            job.status === "paused" ||
            job.status === "queued") && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => runAction("cancel")}
            >
              <Square size={14} className="mr-1.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">
          {actionError}
        </div>
      )}

      <Card className="mt-8 p-6">
        <div className="mb-2 flex justify-between text-[13px] text-[var(--text-secondary)]">
          <span>
            {job.processedUrls.toLocaleString()} /{" "}
            {job.totalUrls.toLocaleString()} URLs
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-[var(--text-muted)]">
          <span>{job.successfulUrls.toLocaleString()} successful</span>
          <span>{job.queuedUrls} queued</span>
          <span>{job.errorRate}% error rate</span>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Workers
          </div>
          <div
            className="mt-2 text-[26px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {job.workersActive} / {job.workersTotal}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Queue
          </div>
          <div
            className="mt-2 text-[26px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {job.queuedUrls}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Success rate
          </div>
          <div
            className="mt-2 text-[26px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {successRate}%
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Error rate
          </div>
          <div
            className="mt-2 text-[26px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {job.errorRate}%
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-[17px] font-semibold">Discovery results</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              Aggregate findings from this job
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5">
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">URLs</div>
              <div className="mt-1 text-[20px] font-semibold">
                {job.processedUrls.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">
                Companies
              </div>
              <div className="mt-1 text-[20px] font-semibold">
                {Math.floor(job.successfulUrls * 0.42).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">Pages</div>
              <div className="mt-1 text-[20px] font-semibold">
                {job.successfulUrls.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">
                Findings
              </div>
              <div className="mt-1 text-[20px] font-semibold">
                {Math.floor(job.successfulUrls * 1.8).toLocaleString()}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-[17px] font-semibold">Configuration</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              Job execution settings
            </p>
          </div>
          <div className="divide-y divide-[var(--border)] text-[14px]">
            <div className="flex justify-between px-5 py-3">
              <span className="text-[var(--text-muted)]">Workers</span>
              <span className="font-medium">{job.configuration.workers}</span>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-[var(--text-muted)]">Requests / sec</span>
              <span className="font-medium">
                {job.configuration.requestsPerSecond}
              </span>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-[var(--text-muted)]">Retries</span>
              <span className="font-medium">{job.configuration.retries}</span>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-[var(--text-muted)]">JS rendering</span>
              <span className="font-medium">
                {job.configuration.javascriptRendering
                  ? "Enabled"
                  : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-[var(--text-muted)]">Sources</span>
              <span className="max-w-[60%] text-right font-medium">
                {job.sources.join(", ")}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-[17px] font-semibold">Workers</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              Current assignment for this job
            </p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{worker.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                    {worker.currentUrl ??
                      (worker.status === "running" ? "Working…" : "Idle")}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-disabled)]">
                    {worker.jobsProcessed} processed · {worker.concurrency}×
                    concurrency
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <span
                    className={
                      worker.status === "running"
                        ? "text-[var(--success)]"
                        : "text-[var(--text-muted)]"
                    }
                  >
                    ●
                  </span>
                  <span className="text-[13px] capitalize text-[var(--text-secondary)]">
                    {worker.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-[17px] font-semibold">Activity / Logs</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              Recent events for this job
            </p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <span className="w-12 shrink-0 text-[12px] text-[var(--text-muted)]">
                  {event.time}
                </span>
                <span
                  className={[
                    "h-2 w-2 shrink-0 rounded-full",
                    event.type === "success" && "bg-[var(--success)]",
                    event.type === "warning" && "bg-[var(--warning)]",
                    event.type === "info" && "bg-[var(--primary)]",
                    event.type === "error" && "bg-[var(--danger)]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                <span className="text-[13px] text-[var(--text-secondary)]">
                  {event.message}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
