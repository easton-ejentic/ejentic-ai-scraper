import { SourcesPanel } from "@/components/scraper/sources-panel";
import { deriveSources } from "@/lib/scraper/sources";
import { getRepository } from "@/lib/production/repository";

// Reads live job state, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const jobs = await getRepository().listStoredJobs();
  return <SourcesPanel sources={deriveSources(jobs)} />;
}
