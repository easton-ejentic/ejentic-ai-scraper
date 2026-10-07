"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "./page-header";
import type { ActivityEvent } from "@/lib/scraper/job-types";

export function LogsPanel({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
      <PageHeader
        title="Logs"
        description="Persistent scraper events across jobs."
      />

      <Card className="mt-8 overflow-hidden">
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
              <span className="ml-auto hidden text-[11px] uppercase tracking-[0.04em] text-[var(--text-disabled)] sm:block">
                {event.type}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
