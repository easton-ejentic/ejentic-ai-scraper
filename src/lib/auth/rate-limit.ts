/**
 * In-process brute-force throttle for sign-in.
 *
 * Deliberately simple: a fixed-window counter per `clientIP:email`. This slows
 * credential stuffing from a single origin, which is the realistic threat for an
 * internal tool. It is NOT a substitute for a shared rate limiter - because the
 * map lives in one process, a horizontally scaled deployment gets one counter
 * per instance.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8;

interface AttemptRecord {
  count: number;
  windowStart: number;
}

const attempts = new Map<string, AttemptRecord>();

// Bound memory growth if someone sprays random keys at us.
const MAX_TRACKED_KEYS = 10_000;

function prune(now: number): void {
  if (attempts.size < MAX_TRACKED_KEYS) return;
  for (const [key, record] of attempts) {
    if (now - record.windowStart > WINDOW_MS) attempts.delete(key);
  }
  // Still too large - drop the oldest half rather than grow unbounded.
  if (attempts.size >= MAX_TRACKED_KEYS) {
    const keys = [...attempts.keys()].slice(0, Math.floor(attempts.size / 2));
    for (const key of keys) attempts.delete(key);
  }
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  return checkLimit("login", key, MAX_ATTEMPTS, WINDOW_MS);
}

export function recordFailedAttempt(key: string): void {
  recordUse("login", key, WINDOW_MS);
}

export function clearAttempts(key: string): void {
  attempts.delete(`login:${key}`);
}

/** Test seam. */
export function resetAllAttempts(): void {
  attempts.clear();
}

/**
 * Generic fixed-window limiter.
 *
 * Buckets share one bounded map, so a new rate-limited surface (public search,
 * contact form) does not need its own module. Keys are namespaced by `bucket`
 * to stop one surface exhausting another's budget.
 */
export function checkLimit(
  bucket: string,
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  prune(now);

  const mapKey = `${bucket}:${key}`;
  const record = attempts.get(mapKey);
  if (!record || now - record.windowStart > windowMs) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (record.count < max) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterMs = Math.max(0, record.windowStart + windowMs - now);
  return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

/** Count one use against a bucket. Call after the work, not before. */
export function recordUse(bucket: string, key: string, windowMs: number): void {
  const now = Date.now();
  prune(now);
  const mapKey = `${bucket}:${key}`;
  const record = attempts.get(mapKey);
  if (!record || now - record.windowStart > windowMs) {
    attempts.set(mapKey, { count: 1, windowStart: now });
    return;
  }
  record.count += 1;
}

/**
 * Best-effort client IP for throttling.
 *
 * Only trustworthy when the app runs behind a proxy that sets these headers;
 * that is the normal deployment, and an inaccurate IP just means a wider or
 * narrower bucket - never a security hole, since this is throttling only.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
