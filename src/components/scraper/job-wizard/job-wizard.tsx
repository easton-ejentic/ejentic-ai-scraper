"use client";

import { useState } from "react";
import {
  defaultJobDraft,
  JobDraft,
} from "@/lib/scraper/job-types";
import { TargetStep } from "./target-step";
import { SourcesStep } from "./sources-step";
import { ConfigurationStep } from "./configuration-step";
import { ReviewStep } from "./review-step";

const steps = ["Target", "Sources", "Configuration", "Review"];

export function JobWizard({
  onClose,
  initialCampaignId,
  initialCampaignName,
}: {
  onClose: () => void;
  /** Set when the wizard is opened from inside a campaign - the job is filed under it. */
  initialCampaignId?: string;
  initialCampaignName?: string;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<JobDraft>({
    ...defaultJobDraft,
    campaignId: initialCampaignId,
  });

  const updateDraft = (updates: Partial<JobDraft>) => {
    setDraft((current) => ({
      ...current,
      ...updates,
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-[900px] px-5 py-8 lg:px-8">
        <div className="mb-8">
          <button
            onClick={onClose}
            className="mb-5 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            ← Back to Control Center
          </button>
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
            SCRAPER
          </div>
          <h1 className="mt-1 text-[32px] font-bold tracking-[-0.025em]">
            New Scraper Job
          </h1>
          <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
            Configure a discovery job in four steps.
          </p>
          {initialCampaignId && (
            <p className="mt-3 inline-flex rounded-lg bg-[var(--primary-soft)] px-3 py-1.5 text-[13px] font-medium text-[#1d4ed8]">
              Filing under campaign: {initialCampaignName ?? initialCampaignId}
            </p>
          )}
        </div>

        <div className="mb-8 flex items-center">
          {steps.map((label, index) => {
            const number = index + 1;
            const active = number === step;
            const complete = number < step;
            return (
              <div key={label} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium",
                      active && "bg-[var(--primary)] text-white",
                      complete &&
                        "bg-[var(--success-soft)] text-[var(--success)]",
                      !active &&
                        !complete &&
                        "bg-[var(--surface-subtle)] text-[var(--text-muted)]",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {number}
                  </div>
                  <span
                    className={[
                      "hidden text-[13px] sm:block",
                      active
                        ? "font-medium text-[var(--text-primary)]"
                        : "text-[var(--text-muted)]",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </div>
                {number < 4 && (
                  <div className="mx-3 h-px flex-1 bg-[var(--border)]" />
                )}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <TargetStep
            draft={draft}
            updateDraft={updateDraft}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <SourcesStep
            draft={draft}
            updateDraft={updateDraft}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <ConfigurationStep
            draft={draft}
            updateDraft={updateDraft}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <ReviewStep
            draft={draft}
            onBack={() => setStep(3)}
            onSubmit={() => {
              onClose();
            }}
          />
        )}

      </div>
    </div>
  );
}
