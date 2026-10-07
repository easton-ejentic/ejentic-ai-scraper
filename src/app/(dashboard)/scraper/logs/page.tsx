export const dynamic = "force-dynamic";

import { LogsPanel } from "@/components/scraper/logs-panel";
import { toActivityEvents } from "@/lib/scraper/activity";
import { getRepository } from "@/lib/production/repository";

export default async function LogsPage() {
  const logs = await getRepository().listStoredLogs();
  return <LogsPanel events={toActivityEvents(logs)} />;
}
