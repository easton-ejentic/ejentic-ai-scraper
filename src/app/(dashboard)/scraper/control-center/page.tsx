export const dynamic = "force-dynamic";

import { ScraperControlCenter } from "@/components/scraper/scraper-control-center";
import { getRepository } from "@/lib/production/repository";
import { toActivityEvents } from "@/lib/scraper/activity";

// Jobs, workers and events all come from the repository now. The workers and
// activity cards used to be fed from `mock-data`, so the control centre showed
// three invented workers even when nothing was running.
export default async function Page() {
  const repository = getRepository();
  const [jobs, workers, logs] = await Promise.all([
    repository.listStoredJobs(),
    repository.listWorkers(),
    repository.listStoredLogs(),
  ]);

  return (
    <ScraperControlCenter
      jobs={jobs}
      workers={workers.map((worker) => ({
        id: worker.id,
        name: worker.name,
        status: worker.status,
        currentUrl: worker.currentUrl,
        jobsProcessed: worker.jobsProcessed,
        concurrency: worker.concurrency,
      }))}
      events={toActivityEvents(logs)}
    />
  );
}
