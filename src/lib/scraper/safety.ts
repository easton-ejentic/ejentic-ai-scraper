/**
 * Crawler safety primitives.
 *
 * These controls are mandatory for every outbound request made by the worker:
 *
 *  1. SSRF protection  - private / loopback / link-local / metadata addresses are refused,
 *                        both by literal IP and by DNS resolution, and re-checked on every
 *                        redirect hop (a public host may redirect to an internal one).
 *  2. robots.txt       - honoured when the host publishes a policy that applies to us.
 *  3. Per-host throttle- bounded request rate so we never hammer a single origin.
 *  4. Response limits  - hard 5 MB cap plus HTML-only content types.
 *
 * Everything here is pure / side-effect free except the network calls, so it can be
 * unit tested without a crawler running.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

export const CRAWLER_USER_AGENT = "EjenticAI-DiscoveryBot/0.4";
export const REQUEST_TIMEOUT_MS = 20_000;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 5;

/**
 * Hostnames that host cloud instance-metadata services. Reachable from inside a
 * datacentre and a classic SSRF escalation target, so they are always refused.
 */
const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "instance-data",
  "instance-data.ec2.internal",
]);

/** True for RFC1918, loopback, link-local and unspecified IPv4 addresses. */
export function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local, incl. 169.254.169.254 cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

/** True for loopback, unspecified, unique-local and link-local IPv6 addresses. */
export function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) must be evaluated as IPv4.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return (
    value === "::1" ||
    value === "::" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80") ||
    value.startsWith("ff")
  );
}

/** True when a hostname (or literal IP) must never be fetched. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (net.isIP(host) === 4) return isPrivateIpv4(host);
  if (net.isIP(host) === 6) return isPrivateIpv6(host);
  return false;
}

export type UrlSafetyVerdict =
  | { safe: true; hostname: string }
  | { safe: false; hostname: string; reason: string };

/**
 * Resolve a URL's host and confirm every resolved address is publicly routable.
 * `skipDns` exists for unit tests that must not touch the network.
 */
export async function checkUrlSafety(
  url: string,
  options: { skipDns?: boolean } = {},
): Promise<UrlSafetyVerdict> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, hostname: "", reason: "Malformed URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, hostname: parsed.hostname, reason: `Unsupported protocol: ${parsed.protocol}` };
  }
  if (isBlockedHostname(parsed.hostname)) {
    return {
      safe: false,
      hostname: parsed.hostname,
      reason: "Refusing private, loopback or metadata address",
    };
  }

  if (options.skipDns) return { safe: true, hostname: parsed.hostname };

  try {
    const records = await lookup(parsed.hostname, { all: true, verbatim: true });
    if (!records.length) {
      return { safe: false, hostname: parsed.hostname, reason: "Hostname did not resolve" };
    }
    for (const record of records) {
      if (isBlockedHostname(record.address)) {
        return {
          safe: false,
          hostname: parsed.hostname,
          reason: `Hostname resolves to a private address (${record.address})`,
        };
      }
    }
  } catch {
    return { safe: false, hostname: parsed.hostname, reason: "Hostname did not resolve" };
  }

  return { safe: true, hostname: parsed.hostname };
}

/**
 * Throw when a URL is not safe to fetch. Every redirect hop must pass through here
 * again because a public host can redirect into an internal network.
 */
export async function assertPublicHost(url: string): Promise<void> {
  const verdict = await checkUrlSafety(url);
  if (!verdict.safe) throw new Error(verdict.reason);
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}

/**
 * Minimal robots.txt matcher: collects the rules for the user-agent group that
 * applies to us (or `*`), then applies longest-prefix-wins between Allow/Disallow.
 */
export function robotsAllows(
  robotsText: string,
  targetUrl: string,
  userAgent: string = CRAWLER_USER_AGENT,
): boolean {
  let applies = false;
  let rules: RobotsRule[] = [];
  const wanted = userAgent.toLowerCase();

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      const candidate = value.toLowerCase();
      const matches = value === "*" || wanted.startsWith(candidate.split(" ")[0] ?? candidate);
      if (matches) {
        applies = true;
        rules = [];
      } else if (applies) {
        applies = false;
      }
      continue;
    }
    if (applies && (key === "disallow" || key === "allow")) {
      rules.push({ type: key, path: value });
    }
  }

  if (!rules.length) return true;

  let path: string;
  try {
    path = new URL(targetUrl).pathname || "/";
  } catch {
    return true;
  }

  let winner: RobotsRule | null = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    if (path.startsWith(rule.path) && (!winner || rule.path.length >= winner.path.length)) {
      winner = rule;
    }
  }

  return !winner || winner.type === "allow";
}

interface RobotsPolicy {
  text: string;
  available: boolean;
}

/** Per-origin robots.txt cache. Failed lookups are cached as "no policy". */
export class RobotsCache {
  private cache = new Map<string, RobotsPolicy>();

  constructor(private readonly userAgent: string = CRAWLER_USER_AGENT) {}

  async get(origin: string): Promise<RobotsPolicy> {
    const cached = this.cache.get(origin);
    if (cached) return cached;

    let policy: RobotsPolicy = { text: "", available: false };
    const robotsUrl = `${origin}/robots.txt`;
    try {
      await assertPublicHost(robotsUrl);
      const response = await fetch(robotsUrl, {
        headers: { "User-Agent": this.userAgent, Accept: "text/plain" },
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        policy = { text: (await response.text()).slice(0, 100_000), available: true };
      }
    } catch {
      // No reachable robots.txt means no published policy, which we treat as allowed.
    }

    this.cache.set(origin, policy);
    return policy;
  }

  async allows(url: string): Promise<boolean> {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return false;
    }
    const policy = await this.get(origin);
    if (!policy.available) return true;
    return robotsAllows(policy.text, url, this.userAgent);
  }

  /** Test seam: pre-seed a policy without performing network I/O. */
  seed(origin: string, policy: RobotsPolicy): void {
    this.cache.set(origin, policy);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Throttling
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Serialises requests per hostname to at most `requestsPerSecond`. */
export class HostThrottler {
  private lastRequest = new Map<string, number>();

  constructor(
    private readonly requestsPerSecond: number = 1,
    private readonly sleepFn: (ms: number) => Promise<void> = sleep,
  ) {}

  async wait(hostname: string): Promise<void> {
    const rate = Math.max(1, Math.min(Number(this.requestsPerSecond) || 1, 100));
    const interval = 1000 / rate;
    const previous = this.lastRequest.get(hostname) ?? 0;
    const wait = Math.max(0, previous + interval - Date.now());
    if (wait) await this.sleepFn(wait);
    this.lastRequest.set(hostname, Date.now());
  }

  reset(): void {
    this.lastRequest.clear();
  }
}

// ---------------------------------------------------------------------------
// Hardened fetch
// ---------------------------------------------------------------------------

export interface FetchedPage {
  url: string;
  status: number;
  html: string;
}

export interface FetchPageOptions {
  requestsPerSecond?: number;
  robots?: RobotsCache;
  throttler?: HostThrottler;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetch an HTML document with SSRF checks, robots policy, throttling, redirect
 * re-validation, content-type enforcement and a hard size cap.
 */
export async function fetchPage(url: string, options: FetchPageOptions = {}): Promise<FetchedPage> {
  const doFetch = options.fetchImpl ?? fetch;
  const robots = options.robots ?? new RobotsCache();
  const throttler = options.throttler ?? new HostThrottler(options.requestsPerSecond ?? 1);
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(current);

    if (!(await robots.allows(current))) {
      throw new Error("Blocked by robots.txt policy");
    }

    await throttler.wait(new URL(current).hostname);

    const response = await doFetch(current, {
      headers: {
        "User-Agent": CRAWLER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Redirect ${response.status} without Location header`);
      let next: string;
      try {
        next = new URL(location, current).toString();
      } catch {
        throw new Error("Invalid redirect URL");
      }
      current = next;
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("Response exceeds 5 MB limit");

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new Error("Response exceeds 5 MB limit");

    return {
      url: current,
      status: response.status,
      html: Buffer.from(buffer).toString("utf8"),
    };
  }

  throw new Error("Too many redirects");
}

/** Exponential backoff with a ceiling, used for transient crawl failures. */
export function backoffDelay(attempt: number, baseMs = 500, maxMs = 30_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}
