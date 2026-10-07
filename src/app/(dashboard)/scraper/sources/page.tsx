import { SourcesPanel } from "@/components/scraper/sources-panel";
import { deriveSources } from "@/lib/scraper/sources";
import { getRepository } from "@/lib/production/repository";

export default async function SourcesPage() {
  const jobs = await getRepository().listStoredJobs();
  return <SourcesPanel sources={deriveSources(jobs)} />;
}
