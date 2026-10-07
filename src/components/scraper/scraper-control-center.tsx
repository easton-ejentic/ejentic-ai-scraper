"use client";

import Link from "next/link";
import { Activity, Pause, Play, Plus, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "./stat-card";
import type { ActivityEvent, ScraperJob, Worker } from "@/lib/scraper/job-types";
import { updateJob } from "@/lib/scraper/client";

function badgeFor(status: ScraperJob["status"]) {
  switch (status) {
    case "running": return { status: "running" as const, label: "Running" };
    case "paused": return { status: "warning" as const, label: "Paused" };
    case "completed": return { status: "success" as const, label: "Completed" };
    case "failed": return { status: "error" as const, label: "Failed" };
    default: return { status: "neutral" as const, label: status === "cancelled" ? "Cancelled" : "Queued" };
  }
}

export function ScraperControlCenter({
  jobs: initialJobs,
  workers,
  events,
}: {
  jobs: ScraperJob[];
  workers: Worker[];
  events: ActivityEvent[];
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeJob = jobs.find((job) => job.status === "running") ?? jobs.find((job) => job.status === "paused") ?? jobs.find((job) => job.status === "queued");
  const runningCount = jobs.filter((job) => job.status === "running").length;
  const queuedCount = jobs.filter((job) => job.status === "queued").reduce((sum, job) => sum + job.queuedUrls, 0);
  const avgError = jobs.length ? (jobs.reduce((sum, job) => sum + job.errorRate, 0) / jobs.length).toFixed(1) : "0.0";
  // Derived from real heartbeats rather than a fixed number: a worker whose
  // process died without a clean shutdown is simply not in the list.
  const liveWorkers = workers.filter((worker) => worker.status === "running").length;
  const health = workers.length ? `${Math.round((liveWorkers / workers.length) * 100)}%` : "—";
  const healthNote = workers.length ? `${liveWorkers} of ${workers.length} workers active` : "No workers reporting";

  const runAction = async (id: string, action: "pause" | "resume" | "cancel") => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await updateJob(id, action);
      setJobs((current) => current.map((job) => (job.id === id ? updated : job)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update job");
    } finally {
      setBusyId(null);
    }
  };

  const progress = activeJob && activeJob.totalUrls > 0 ? (activeJob.processedUrls / activeJob.totalUrls) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">SCRAPER</div>
          <h1 className="mt-1 text-[32px] font-bold tracking-[-0.025em] lg:text-[40px]">Scraper Control Center</h1>
          <p className="mt-2 max-w-[620px] text-[15px] text-[var(--text-secondary)]">Monitor discovery infrastructure, jobs and system activity.</p>
        </div>
        <Link href="/scraper/jobs/new"><Button><Plus size={17} className="mr-2" />New Job</Button></Link>
      </div>

      {error && <div className="mt-5 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">{error}</div>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="SYSTEM HEALTH" value={health} description={healthNote} />
        <StatCard label="RUNNING JOBS" value={String(runningCount)} description={`${jobs.length} total jobs`} />
        <StatCard label="QUEUE" value={queuedCount.toLocaleString()} description="URLs pending" />
        <StatCard label="ERROR RATE" value={`${avgError}%`} description="Across current jobs" />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[18px] font-semibold">Active Job</h2><Link href="/scraper/jobs" className="text-[13px] font-medium text-[var(--primary)] hover:underline">View all</Link></div>
        {activeJob ? (
          <Card className="p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div><h3 className="text-[19px] font-semibold">{activeJob.name}</h3><div className="mt-2"><StatusBadge {...badgeFor(activeJob.status)} /></div></div>
                <Link href={`/scraper/jobs/${activeJob.id}`}><Button variant="secondary">View Job</Button></Link>
              </div>
              <div><div className="mb-2 flex justify-between text-[13px] text-[var(--text-secondary)]"><span>{activeJob.processedUrls.toLocaleString()} / {activeJob.totalUrls.toLocaleString()} URLs</span><span>{Math.round(progress)}%</span></div><Progress value={progress} /></div>
              <div className="flex flex-col justify-between gap-4 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[var(--text-muted)]"><span>{activeJob.workersActive} workers</span><span>{activeJob.queuedUrls.toLocaleString()} queued</span><span>{activeJob.errorRate}% errors</span></div>
                <div className="flex gap-2">
                  {activeJob.status === "running" && <Button variant="secondary" disabled={busyId === activeJob.id} onClick={() => runAction(activeJob.id, "pause")}><Pause size={15} className="mr-1.5" />Pause</Button>}
                  {(activeJob.status === "paused" || activeJob.status === "queued") && <Button variant="secondary" disabled={busyId === activeJob.id} onClick={() => runAction(activeJob.id, "resume")}><Play size={15} className="mr-1.5" />Resume</Button>}
                  {(activeJob.status === "running" || activeJob.status === "paused" || activeJob.status === "queued") && <Button variant="danger" disabled={busyId === activeJob.id} onClick={() => runAction(activeJob.id, "cancel")}><Square size={14} className="mr-1.5" />Cancel</Button>}
                </div>
              </div>
            </div>
          </Card>
        ) : <Card className="p-8 text-center text-[14px] text-[var(--text-muted)]">No scraper jobs yet. Create your first job to begin discovery.</Card>}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card><div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-[17px] font-semibold">Workers</h2><p className="mt-0.5 text-[13px] text-[var(--text-muted)]">Current worker activity</p></div><Activity size={18} className="text-[var(--text-muted)]" /></div><div className="divide-y divide-[var(--border)]">{workers.length ? workers.map((worker) => <div key={worker.id} className="flex items-center justify-between px-5 py-4"><div className="min-w-0"><div className="text-[14px] font-medium">{worker.name}</div><div className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{worker.currentUrl ?? (worker.status === "running" ? "Working…" : "Idle")}</div></div><div className="ml-4 flex items-center gap-2"><span className={worker.status === "running" ? "text-[var(--success)]" : "text-[var(--text-muted)]"}>●</span><span className="text-[13px] capitalize text-[var(--text-secondary)]">{worker.status}</span></div></div>) : <div className="px-5 py-8 text-center text-[13px] text-[var(--text-muted)]">No workers have reported yet. Start a worker to see live activity here.</div>}</div></Card>
        <Card><div className="border-b border-[var(--border)] px-5 py-4"><h2 className="text-[17px] font-semibold">Live Activity</h2><p className="mt-0.5 text-[13px] text-[var(--text-muted)]">Latest scraper events</p></div><div className="divide-y divide-[var(--border)]">{events.length ? events.slice(0,5).map((event) => <div key={event.id} className="flex items-center gap-4 px-5 py-4"><span className="w-12 shrink-0 text-[12px] text-[var(--text-muted)]">{event.time}</span><span className={["h-2 w-2 shrink-0 rounded-full",event.type === "success" && "bg-[var(--success)]",event.type === "warning" && "bg-[var(--warning)]",event.type === "info" && "bg-[var(--primary)]",event.type === "error" && "bg-[var(--danger)]"].filter(Boolean).join(" ")} /><span className="text-[13px] text-[var(--text-secondary)]">{event.message}</span></div>) : <div className="px-5 py-8 text-center text-[13px] text-[var(--text-muted)]">No activity recorded yet.</div>}</div></Card>
      </div>
    </div>
  );
}
