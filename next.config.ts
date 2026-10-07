import type { NextConfig } from "next";

/**
 * Mount point.
 *
 * Empty  -> the app owns the whole domain (standalone).
 * "/app" -> the app is served as a section of the main site, e.g.
 *           https://ejenticai.com/app. Next.js rewrites every internal link
 *           and route to include this prefix automatically.
 *
 * This is read at build time, so set it before `npm run build` / `npm run dev`.
 */
function basePath(): string {
  const raw = (process.env.BASE_PATH ?? "").trim();
  if (!raw || raw === "/") return "";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, "");
}

const configuredBasePath = basePath();

/** Origin of the parent site, used to allow-list framing. */
function mainSiteOrigin(): string | null {
  const raw = (process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const embeddingAllowed = String(process.env.ALLOW_EMBEDDING ?? "").toLowerCase() === "true";
const allowedFramingOrigin = mainSiteOrigin();

/**
 * By default the app refuses to be framed (clickjacking protection). When it is
 * genuinely embedded in the main site, `ALLOW_EMBEDDING=true` swaps the blanket
 * DENY for a CSP `frame-ancestors` allow-list so only the main site may frame
 * it - still no wildcard, still no framing by third parties.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  ...(embeddingAllowed
    ? [
        {
          key: "Content-Security-Policy",
          value: `frame-ancestors 'self'${allowedFramingOrigin ? ` ${allowedFramingOrigin}` : ""}`,
        },
      ]
    : [{ key: "X-Frame-Options", value: "DENY" }]),
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Sub-path mounting, e.g. BASE_PATH=/app -> https://ejenticai.com/app
  basePath: configuredBasePath || undefined,

  // Pin the workspace root to this project directory.
  //
  // Without this, Turbopack walks up the tree looking for a lockfile to infer
  // the project root from. A stray package-lock.json sitting in C:\Users\USER
  // made it treat the entire home directory as a candidate root, which it then
  // (sensibly) refused to use - hence the warning:
  //   "Next.js ignored package-lock.json in C:\Users\USER ... set turbopack.root"
  // npm scripts always run with cwd set to the project directory, so this is
  // stable and stops the upward search entirely.
  turbopack: {
    root: process.cwd(),
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
