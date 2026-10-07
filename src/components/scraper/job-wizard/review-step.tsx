"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobDraft } from "@/lib/scraper/job-types";
import { createJob } from "@/lib/scraper/client";

export function ReviewStep({
  draft,
  onBack,
  onSubmit,
}: {
  draft: JobDraft;
  onBack: () => void;
  onSubmit: (jobId?: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const sourceLabels: string[] = [];
  if (draft.sources.websites) sourceLabels.push("Company websites");
  if (draft.sources.search) sourceLabels.push("Search engines");
  if (draft.sources.directories) sourceLabels.push("Business directories");
  if (draft.sources.social) sourceLabels.push("Social profiles");

  const searchBits = [
    draft.descriptor?.name,
    draft.descriptor?.niche || draft.descriptor?.category,
    draft.descriptor?.location,
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  const targetLabel =
    draft.targetType === "search"
      ? searchBits.length
        ? searchBits.join(" · ")
        : "Web search"
      : draft.targetType === "campaign"
        ? draft.campaignId === "insurance"
          ? "Insurance Agencies"
          : draft.campaignId === "accounting"
            ? "Accounting Firms"
            : draft.campaignId ?? "—"
        : draft.targetType === "domain"
          ? draft.target ?? "—"
          : "URL list";

  const targetDetail =
    draft.targetType === "search"
      ? `${(draft.discoveredUrls ?? []).length} website${(draft.discoveredUrls ?? []).length === 1 ? "" : "s"} selected from live search`
      : null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createJob(draft);
      setCreatedId(result.id);
      setDone(true);
      setTimeout(() => onSubmit(result.id), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Card className="p-8 text-center">
        <div className="text-[18px] font-semibold text-[var(--success)]">
          Job created successfully
        </div>
        <p className="mt-2 text-[14px] text-[var(--text-muted)]">
          {createdId ? `${createdId} · ` : ""}Opening Control Center…
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 lg:p-8">
      <div className="mb-7">
        <h2 className="text-[21px] font-semibold">Review job</h2>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          Confirm configuration before starting.
        </p>
      </div>

      <div className="space-y-5">
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Job
          </div>
          <div className="mt-1 text-[16px] font-semibold">{draft.name}</div>
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Target
          </div>
          <div className="mt-1 text-[14px]">
            <span className="capitalize">
              {draft.targetType.replace("-", " ")}
            </span>
            {" · "}
            {targetLabel}
          </div>
          <div className="mt-1 text-[13px] text-[var(--text-muted)]">
            {draft.urlLimit.toLocaleString()} URLs max
            {targetDetail ? ` · ${targetDetail}` : ""}
          </div>
          {draft.targetType === "search" &&
            (draft.discoveredUrls ?? []).length > 0 && (
              <ul className="mt-3 max-h-[180px] space-y-1 overflow-y-auto text-[12px] text-[var(--text-secondary)]">
                {draft.discoveredUrls!.map((url) => (
                  <li key={url} className="truncate">
                    • {url}
                  </li>
                ))}
              </ul>
            )}
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Sources
          </div>
          <div className="mt-1 text-[14px]">
            {sourceLabels.length} selected
          </div>
          <ul className="mt-2 space-y-1 text-[13px] text-[var(--text-secondary)]">
            {sourceLabels.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Configuration
          </div>
          <div className="mt-2 grid gap-2 text-[13px] text-[var(--text-secondary)] sm:grid-cols-2">
            <div>{draft.configuration.workers} workers</div>
            <div>
              {draft.configuration.requestsPerSecond} requests / second
            </div>
            <div>{draft.configuration.retries} retries</div>
            <div>
              JavaScript rendering{" "}
              {draft.configuration.javascriptRendering
                ? "enabled"
                : "disabled"}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="mt-8 flex justify-between border-t border-[var(--border)] pt-5">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          ← Back
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Starting…" : "Start Job"}
        </Button>
      </div>
    </Card>
  );
}
