"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobDraft } from "@/lib/scraper/job-types";
import { discoverBusinesses } from "@/lib/scraper/client";
import type { DiscoverResponse } from "@/lib/scraper/api-types";

const TARGET_TYPES = [
  {
    value: "search" as const,
    title: "Web search",
    description: "Describe the businesses and we find their websites.",
  },
  {
    value: "domain" as const,
    title: "Domain",
    description: "Crawl one specific website.",
  },
  {
    value: "url-list" as const,
    title: "URL list",
    description: "Start from URLs you already have.",
  },
  {
    value: "campaign" as const,
    title: "Campaign",
    description: "Run a saved discovery preset.",
  },
];

export function TargetStep({
  draft,
  updateDraft,
  onNext,
}: {
  draft: JobDraft;
  updateDraft: (updates: Partial<JobDraft>) => void;
  onNext: () => void;
}) {
  const descriptor = draft.descriptor ?? {};
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DiscoverResponse | null>(null);
  const [selected, setSelected] = useState<string[]>(draft.discoveredUrls ?? []);

  const setDescriptor = (updates: Partial<NonNullable<JobDraft["descriptor"]>>) => {
    updateDraft({ descriptor: { ...descriptor, ...updates } });
  };

  const hasInput = Boolean(
    descriptor.name?.trim() ||
      descriptor.niche?.trim() ||
      descriptor.category?.trim() ||
      descriptor.location?.trim(),
  );

  const runSearch = async () => {
    setSearching(true);
    setError(null);
    setPreview(null);
    try {
      const result = await discoverBusinesses({
        name: descriptor.name,
        niche: descriptor.niche,
        category: descriptor.category,
        location: descriptor.location,
        keywords: descriptor.keywords,
        maxUrls: Math.min(draft.urlLimit || 25, 100),
      });
      setPreview(result);
      setSelected(result.urls);
      updateDraft({ discoveredUrls: result.urls });
      if (result.error && !result.urls.length) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const toggle = (url: string) => {
    setSelected((current) => {
      const next = current.includes(url)
        ? current.filter((value) => value !== url)
        : [...current, url];
      updateDraft({ discoveredUrls: next });
      return next;
    });
  };

  const canContinue =
    Boolean(draft.name) &&
    draft.urlLimit >= 1 &&
    (draft.targetType === "search"
      ? selected.length > 0
      : draft.targetType === "campaign"
        ? Boolean(draft.campaignId)
        : Boolean(draft.target?.trim()));

  return (
    <Card className="p-6 lg:p-8">
      <div className="mb-7">
        <h2 className="text-[21px] font-semibold">Define your target</h2>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          Tell the scraper what you want to discover.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-[13px] font-medium">Job name</label>
          <input
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder="e.g. Manchester Emergency Plumbers"
            className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>

        <div>
          <label className="mb-3 block text-[13px] font-medium">
            Target type
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TARGET_TYPES.map((option) => {
              const isSelected = draft.targetType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateDraft({
                      targetType: option.value,
                      campaignId: undefined,
                      target: undefined,
                      discoveredUrls: undefined,
                    })
                  }
                  className={[
                    "rounded-lg border p-4 text-left transition",
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]",
                  ].join(" ")}
                >
                  <div className="text-[14px] font-medium">{option.title}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {draft.targetType === "search" && (
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="text-[13px] font-medium">
              What are you looking for?
            </div>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Fill in any of these. We search the open web and return real
              business websites — no URLs needed.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Business name"
                hint="Optional"
                value={descriptor.name ?? ""}
                placeholder="Northwind Logistics"
                onChange={(value) => setDescriptor({ name: value })}
              />
              <Field
                label="Niche / service"
                hint="Optional"
                value={descriptor.niche ?? ""}
                placeholder="emergency plumbing"
                onChange={(value) => setDescriptor({ niche: value })}
              />
              <Field
                label="Category"
                hint="Optional"
                value={descriptor.category ?? ""}
                placeholder="plumber"
                onChange={(value) => setDescriptor({ category: value })}
              />
              <Field
                label="Location"
                hint="Optional"
                value={descriptor.location ?? ""}
                placeholder="Manchester"
                onChange={(value) => setDescriptor({ location: value })}
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[13px] font-medium">
                Extra keywords <span className="text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                value={(descriptor.keywords ?? []).join(", ")}
                onChange={(event) =>
                  setDescriptor({
                    keywords: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="24 hour, emergency callout"
                className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={runSearch} disabled={!hasInput || searching}>
                {searching ? "Searching the web…" : "Find websites"}
              </Button>
              {hasInput && !preview && !searching && (
                <span className="text-[12px] text-[var(--text-muted)]">
                  Runs a live search — nothing is created yet.
                </span>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
                {error}
                {preview?.providerNote && (
                  <div className="mt-2 font-normal text-[12px] text-[var(--text-secondary)]">
                    {preview.providerNote}
                  </div>
                )}
              </div>
            )}

            {preview && (
              <div className="mt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[13px] font-medium">
                    {preview.results.length} website
                    {preview.results.length === 1 ? "" : "s"} found
                    <span className="ml-2 font-normal text-[var(--text-muted)]">
                      {selected.length} selected
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)]">
                    via {preview.providerLabel}
                  </div>
                </div>

                {preview.queries.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {preview.queries.map((query) => (
                      <span
                        key={query}
                        className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                      >
                        {query}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {preview.results.map((result) => {
                    const checked = selected.includes(result.url);
                    return (
                      <label
                        key={result.url}
                        className={[
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                          checked
                            ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                            : "border-[var(--border)] hover:border-[var(--border-strong)]",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(result.url)}
                          className="mt-1 h-4 w-4 accent-[var(--primary)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">
                            {result.domain}
                          </div>
                          <div className="truncate text-[12px] text-[var(--text-muted)]">
                            {result.title}
                          </div>
                          {result.snippet && (
                            <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                              {result.snippet}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {preview.error && preview.results.length > 0 && (
                  <div className="mt-3 text-[12px] text-[var(--warning)]">
                    {preview.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {draft.targetType === "campaign" && (
          <div>
            <label className="mb-2 block text-[13px] font-medium">
              Campaign
            </label>
            <select
              value={draft.campaignId ?? ""}
              onChange={(event) =>
                updateDraft({ campaignId: event.target.value })
              }
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] outline-none focus:border-[var(--primary)]"
            >
              <option value="" disabled>
                Select campaign
              </option>
              <option value="insurance">Insurance Agencies</option>
              <option value="accounting">Accounting Firms</option>
            </select>
            <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              Campaigns run a live web search for their niche and region.
            </p>
          </div>
        )}

        {draft.targetType === "domain" && (
          <div>
            <label className="mb-2 block text-[13px] font-medium">Domain</label>
            <input
              value={draft.target ?? ""}
              onChange={(event) => updateDraft({ target: event.target.value })}
              placeholder="example.com"
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}

        {draft.targetType === "url-list" && (
          <div>
            <label className="mb-2 block text-[13px] font-medium">
              URL list
            </label>
            <textarea
              value={draft.target ?? ""}
              onChange={(event) => updateDraft({ target: event.target.value })}
              placeholder="One URL per line&#10;https://example.com&#10;https://another.com"
              rows={5}
              className="w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 text-[14px] outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-[13px] font-medium">
            URL limit
          </label>
          <input
            type="number"
            min={1}
            value={draft.urlLimit}
            onChange={(event) =>
              updateDraft({ urlLimit: Number(event.target.value) })
            }
            className="h-11 w-full rounded-lg border border-[var(--border-strong)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
          />
          <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
            Maximum number of URLs this job can process.
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t border-[var(--border)] pt-5">
        <Button onClick={onNext} disabled={!canContinue}>
          Continue
          <span className="ml-2">→</span>
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium">
        {label}
        {hint && (
          <span className="ml-1.5 font-normal text-[var(--text-muted)]">
            ({hint})
          </span>
        )}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] outline-none focus:border-[var(--primary)]"
      />
    </div>
  );
}
