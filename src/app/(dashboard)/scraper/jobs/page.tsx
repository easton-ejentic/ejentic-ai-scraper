export const dynamic = "force-dynamic";

import { JobsList } from "@/components/scraper/jobs-list";
import { getRepository } from "@/lib/production/repository";

// Reads through the repository rather than the JSON store directly: under
// PostgreSQL the store file is not the source of truth, so this page used to
// show a different set of jobs than the API wrote.
export default async function JobsPage() {
  const jobs = await getRepository().listStoredJobs();
  return <JobsList jobs={jobs} />;
}
