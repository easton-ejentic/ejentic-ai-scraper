"use client";

import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "./page-header";
import type { SourceDefinition } from "@/lib/scraper/sources";

function sourceStatusBadge(status: SourceDefinition["status"]) {
  switch (status) {
    case "active":
      return { status: "success" as const, label: "Active" };
    case "degraded":
      return { status: "warning" as const, label: "Degraded" };
    case "disabled":
    default:
      return { status: "neutral" as const, label: "Disabled" };
  }
}

export function SourcesPanel({ sources }: { sources: SourceDefinition[] }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
      <PageHeader
        title="Sources"
        description="Discovery sources the scraper can use. Configuration only — no live integrations yet."
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {sources.map((source) => {
          const badge = sourceStatusBadge(source.status);
          return (
            <Card key={source.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold">{source.name}</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                    {source.description}
                  </p>
                </div>
                <StatusBadge status={badge.status} label={badge.label} />
              </div>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--text-secondary)]">
                <span>
                  <span className="text-[var(--text-muted)]">Jobs using:</span>{" "}
                  {source.jobsUsing}
                </span>
                <span>
                  <span className="text-[var(--text-muted)]">Last used:</span>{" "}
                  {source.lastUsed}
                </span>
                <span className="capitalize">
                  <span className="text-[var(--text-muted)]">Type:</span>{" "}
                  {source.type}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
