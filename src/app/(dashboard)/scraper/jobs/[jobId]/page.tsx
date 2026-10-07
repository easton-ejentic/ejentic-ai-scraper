import { notFound } from "next/navigation";
import { JobDetail } from "@/components/scraper/job-detail";
import { getRepository } from "@/lib/production/repository";
import { toActivityEvents } from "@/lib/scraper/activity";

// Workers and events are read from the repository now. They used to come from
// `mock-data`, so this screen reported three invented workers and a fixed list
// of events regardless of what the crawl was actually doing.
export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const repository = getRepository();
  const job = await repository.getStoredJob(jobId);

  if (!job) {
    notFound();
  }

  const [workers, logs] = await Promise.all([
    repository.listWorkers(),
    repository.listStoredLogs(jobId),
  ]);

  return (
    <JobDetail
      job={job}
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
