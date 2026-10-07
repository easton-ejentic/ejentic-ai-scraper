/**
 * Deployment configuration for mounting this product inside another site.
 *
 * The app is designed to run either:
 *
 *  1. Standalone  - it owns the whole domain (BASE_PATH empty).
 *  2. As a section of the main Ejentic AI site - e.g. served at
 *     https://ejenticai.com/app by setting BASE_PATH=/app.
 *
 * Everything that varies between those two modes lives here so there is a
 * single place to look, and so the marketing site, dashboard and API all agree
 * on where they are mounted.
 *
 * Note: Next.js `<Link>` and `router.push()` apply `basePath` automatically.
 * Raw `<a href>` tags, `window.location` assignments and `NextResponse.redirect`
 * do NOT, so use `withBasePath()` for those.
 */

function normaliseBasePath(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  // Strip any trailing slash: "/app/" -> "/app"
  return withLeadingSlash.replace(/\/+$/, "");
}

function normaliseUrl(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export interface SiteConfig {
  /** e.g. "" when standalone, "/app" when mounted under the main site. */
  basePath: string;
  /** Origin of the parent marketing site, e.g. "https://ejenticai.com". */
  mainSiteUrl: string | null;
  /** True when the app may be embedded in an iframe by the parent site. */
  embeddingAllowed: boolean;
  /** Product name used in headings and page titles. */
  productName: string;
  /** Parent organisation name. */
  companyName: string;
  /** Shown on the public pages and in the login help text. */
  supportEmail: string;
}

export function siteConfig(): SiteConfig {
  return {
    basePath: normaliseBasePath(process.env.BASE_PATH),
    mainSiteUrl: normaliseUrl(process.env.NEXT_PUBLIC_MAIN_SITE_URL),
    embeddingAllowed: String(process.env.ALLOW_EMBEDDING ?? "").toLowerCase() === "true",
    productName: process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "Ejentic AI",
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "Ejentic AI",
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "hello@ejenticai.com",
  };
}

/**
 * Prefix an absolute app path with the configured base path.
 *
 * Use for raw anchors and redirects; not needed for `<Link href>`.
 */
export function withBasePath(path: string, basePath = siteConfig().basePath): string {
  if (!basePath) return path;
  if (!path.startsWith("/")) return path;
  // Avoid doubling up when a caller already included the prefix.
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}

/** Strip the configured base path, so code can compare route-relative paths. */
export function stripBasePath(pathname: string, basePath = siteConfig().basePath): string {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname;
}
