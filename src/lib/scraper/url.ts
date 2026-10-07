const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const IS_HTTP_SCHEME = /^https?:/i;

export function normalizeUrl(value: string): string | null {
  try {
    const raw = String(value ?? "").trim();
    // A value that already carries a scheme must be http(s). Reject anything else
    // outright rather than prefixing https://, which would silently turn
    // "ftp://host/path" into the nonsensical "https://ftp//host/path".
    if (HAS_SCHEME.test(raw) && !IS_HTTP_SCHEME.test(raw)) return null;

    const url = new URL(IS_HTTP_SCHEME.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
