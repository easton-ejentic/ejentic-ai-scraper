const USER_AGENT = "EjenticAI-DiscoveryBot/0.1";

export interface FetchPageResult {
  url: string;
  status: number;
  contentType: string;
  html: string;
  durationMs: number;
}

export async function fetchPage(url: string): Promise<FetchPageResult> {
  const started = Date.now();
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
  }

  const html = await response.text();
  return {
    url: response.url,
    status: response.status,
    contentType,
    html,
    durationMs: Date.now() - started,
  };
}
