import type { ActivityEvent } from "./job-types";

/** The shape the log tables render, before display formatting. */
export interface LogLike {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

/**
 * Turn stored logs into the activity feed the dashboard renders.
 *
 * Shared by the logs page, the control centre and the job detail screen so all
 * three show the same thing. The time is formatted on the server to keep the
 * client and server markup identical - `toLocaleTimeString` depends on the
 * machine's locale, which differs between the two.
 */
export function toActivityEvents(logs: LogLike[], limit = 200): ActivityEvent[] {
  return logs.slice(0, limit).map((log) => ({
    id: log.id,
    time: formatClock(log.createdAt),
    message: log.message,
    type: normaliseLevel(log.level),
  }));
}

function normaliseLevel(level: string): ActivityEvent["type"] {
  if (level === "success" || level === "warning" || level === "error") return level;
  return "info";
}

/** HH:MM from an ISO timestamp, without locale-dependent separators. */
function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
