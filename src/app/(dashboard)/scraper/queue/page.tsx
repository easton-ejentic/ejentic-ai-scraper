export const dynamic = "force-dynamic";

import { QueuePanel } from "@/components/scraper/queue-panel";
import { getRepository } from "@/lib/production/repository";

export default async function QueuePage() {
  const items = await getRepository().listStoredQueue();
  return <QueuePanel items={items} />;
}
