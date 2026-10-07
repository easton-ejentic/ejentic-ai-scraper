/**
 * Route-level access gate.
 *
 * This is an OPTIMISTIC check only: it redirects signed-out visitors away from
 * internal pages by looking for the presence of a session cookie. It does not
 * validate the cookie signature - that requires node:crypto, which is not
 * available in the proxy runtime.
 *
 * Real authorization happens in `requireApiUser()` for API routes and in the
 * server components themselves. Never treat this file as the security boundary.
 *
 * Cookie name is duplicated from `src/lib/auth/session.ts` on purpose, so this
 * module stays dependency-free and edge-safe.
 */

import { NextResponse, type NextRequest } from "next/server";
import { siteConfig, stripBasePath, withBasePath } from "@/lib/site-config";

const SESSION_COOKIE = "ejentic_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/scraper",
  "/campaigns",
  "/companies",
  "/workflows",
  "/opportunities",
  "/qualified-leads",
  "/research",
  "/settings",
];

/**
 * Mirrors `isAuthEnabled()` from src/lib/auth/users.ts without importing
 * node:crypto, which the proxy runtime cannot load.
 */
function authConfigured(): boolean {
  if (process.env.DATABASE_URL) return true;
  const adminEmail = process.env.EJENTIC_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.EJENTIC_ADMIN_PASSWORD || process.env.EJENTIC_ADMIN_PASSWORD_HASH;
  const userEmail = process.env.EJENTIC_USER_EMAIL?.trim();
  const userPassword = process.env.EJENTIC_USER_PASSWORD || process.env.EJENTIC_USER_PASSWORD_HASH;
  return Boolean((adminEmail && adminPassword) || (userEmail && userPassword));
}

export function proxy(request: NextRequest) {
  if (!authConfigured()) return NextResponse.next();

  // When mounted under a sub-path (BASE_PATH=/app) the incoming pathname
  // includes that prefix, so compare against the route-relative path.
  const { basePath } = siteConfig();
  const pathname = stripBasePath(request.nextUrl.pathname, basePath);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  // NextResponse.redirect does not add basePath for us, so include it here or
  // a mounted deployment would bounce users to a /login that does not exist.
  const loginUrl = new URL(withBasePath("/login", basePath), request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/scraper/:path*",
    "/campaigns/:path*",
    "/companies/:path*",
    "/workflows/:path*",
    "/opportunities/:path*",
    "/qualified-leads/:path*",
    "/research/:path*",
    "/settings/:path*",
  ],
};
