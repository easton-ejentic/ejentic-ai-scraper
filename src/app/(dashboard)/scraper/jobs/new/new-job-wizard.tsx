"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JobWizard } from "@/components/scraper/job-wizard/job-wizard";

/**
 * Reads `?campaign=<id>` (how the Campaigns page opens the wizard) and resolves
 * the campaign's display name, so the new job is filed under that campaign.
 *
 * Split out of `page.tsx` because `useSearchParams()` needs a Suspense boundary
 * above it during prerender.
 */
export function NewJobWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const campaignId = searchParams.get("campaign") ?? undefined;
  const [campaignName, setCampaignName] = useState<string | undefined>();

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    fetch("/api/campaigns")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const match = (data.campaigns ?? []).find((item: { id: string }) => item.id === campaignId);
        if (match) setCampaignName(match.name);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  return (
    <JobWizard
      initialCampaignId={campaignId}
      initialCampaignName={campaignName}
      onClose={() => router.push(campaignId ? "/campaigns" : "/scraper/control-center")}
    />
  );
}
