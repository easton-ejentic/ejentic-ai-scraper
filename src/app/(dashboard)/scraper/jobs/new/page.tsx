import { Suspense } from "react";
import { NewJobWizard } from "./new-job-wizard";

/**
 * The wizard reads `?campaign=<id>` so a job can be filed under the campaign it
 * was started from. `useSearchParams()` opts a route into client-side rendering
 * during prerender, which is why it sits behind a Suspense boundary - without
 * this the production build fails on this page.
 */
export default function NewScraperJobPage() {
  return (
    <Suspense fallback={<WizardFallback />}>
      <NewJobWizard />
    </Suspense>
  );
}

function WizardFallback() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-8 lg:px-8">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
        SCRAPER
      </div>
      <h1 className="mt-1 text-[32px] font-bold tracking-[-0.025em]">New Scraper Job</h1>
      <p className="mt-2 text-[15px] text-[var(--text-secondary)]">Loading…</p>
    </div>
  );
}
