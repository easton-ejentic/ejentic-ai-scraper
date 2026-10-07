import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobDraft } from "@/lib/scraper/job-types";

export function SourcesStep({
  draft,
  updateDraft,
  onBack,
  onNext,
}: {
  draft: JobDraft;
  updateDraft: (updates: Partial<JobDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const sources = [
    {
      key: "websites" as const,
      title: "Company websites",
      description: "Discover and crawl company-owned websites.",
    },
    {
      key: "search" as const,
      title: "Search engines",
      description: "Use search results to discover relevant domains.",
    },
    {
      key: "directories" as const,
      title: "Business directories",
      description: "Discover companies through structured directories.",
    },
    {
      key: "social" as const,
      title: "Social profiles",
      description: "Include publicly available social profile sources.",
    },
  ];

  const hasSource =
    draft.sources.websites ||
    draft.sources.search ||
    draft.sources.directories ||
    draft.sources.social;

  return (
    <Card className="p-6 lg:p-8">
      <div className="mb-7">
        <h2 className="text-[21px] font-semibold">Select sources</h2>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          Choose where the scraper should discover and retrieve information.
        </p>
      </div>

      <div className="space-y-3">
        {sources.map((source) => {
          const enabled = draft.sources[source.key];
          return (
            <label
              key={source.key}
              className={[
                "flex cursor-pointer items-start gap-4 rounded-lg border p-4",
                enabled
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                  : "border-[var(--border)]",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) =>
                  updateDraft({
                    sources: {
                      ...draft.sources,
                      [source.key]: event.target.checked,
                    },
                  })
                }
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
              />
              <div>
                <div className="text-[14px] font-medium">{source.title}</div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">
                  {source.description}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-8 flex justify-between border-t border-[var(--border)] pt-5">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext} disabled={!hasSource}>
          Continue →
        </Button>
      </div>
    </Card>
  );
}
