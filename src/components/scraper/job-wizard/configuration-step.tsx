import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobDraft } from "@/lib/scraper/job-types";

export function ConfigurationStep({
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
  const config = draft.configuration;
  const highRate = config.requestsPerSecond > 10;

  return (
    <Card className="p-6 lg:p-8">
      <div className="mb-7">
        <h2 className="text-[21px] font-semibold">Configure execution</h2>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          Set worker count, rate limits, and rendering behavior.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-[13px] font-medium">
              Workers
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={config.workers}
              onChange={(event) =>
                updateDraft({
                  configuration: {
                    ...config,
                    workers: Number(event.target.value),
                  },
                })
              }
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
            />
            <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              Concurrent workers for this job.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium">
              Requests per second
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.requestsPerSecond}
              onChange={(event) =>
                updateDraft({
                  configuration: {
                    ...config,
                    requestsPerSecond: Number(event.target.value),
                  },
                })
              }
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
            />
            <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              Aggregate request rate across workers.
            </p>
            {highRate && (
              <p className="mt-1.5 text-[12px] text-[var(--warning)]">
                High rates increase blocking and CAPTCHA risk.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium">
              Retries
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={config.retries}
              onChange={(event) =>
                updateDraft({
                  configuration: {
                    ...config,
                    retries: Number(event.target.value),
                  },
                })
              }
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
            />
            <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              Retry attempts for failed requests.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium">
              JavaScript rendering
            </label>
            <label className="flex h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-strong)] px-3">
              <input
                type="checkbox"
                checked={config.javascriptRendering}
                onChange={(event) =>
                  updateDraft({
                    configuration: {
                      ...config,
                      javascriptRendering: event.target.checked,
                    },
                  })
                }
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <span className="text-[14px]">
                {config.javascriptRendering ? "Enabled" : "Disabled"}
              </span>
            </label>
            <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              Required for SPA-heavy sites. Slower and costlier.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between border-t border-[var(--border)] pt-5">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button
          onClick={onNext}
          disabled={
            config.workers < 1 ||
            config.requestsPerSecond < 1 ||
            config.retries < 0
          }
        >
          Continue →
        </Button>
      </div>
    </Card>
  );
}
