/**
 * Signed, stateless session cookies.
 *
 * Payload is base64url JSON; the signature is HMAC-SHA256 over that payload
 * using SESSION_SECRET. Cookies are httpOnly + sameSite=lax so they cannot be
 * read by client JavaScript, and `secure` is set whenever the app is served
 * over HTTPS in production.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ejentic_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export type Role = "ADMIN" | "OPERATOR" | "RESEARCHER" | "VIEWER";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

const DEV_SECRET = "ejentic-dev-session-secret-do-not-use-in-production";

let warnedAboutSecret = false;

function secret(): string {
  const configured = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn("[auth] SESSION_SECRET is not set - using an insecure development secret.");
  }
  return DEV_SECRET;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createSessionToken(user: SessionUser, ttlSeconds = SESSION_TTL_SECONDS): string {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify a token. Returns null when it is absent, tampered with, or expired. */
export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  if (!safeEqual(signature, sign(body))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * `lax` works for a standalone deployment and for a sub-path on the same
 * registrable domain (app.ejenticai.com framed by ejenticai.com is same-site).
 *
 * If the app is iframed from a *different* domain, the browser treats it as
 * cross-site and drops a lax cookie, so sign-in would silently fail. Set
 * SESSION_COOKIE_SAME_SITE=none for that case; it forces `secure`, which means
 * it only works over HTTPS.
 */
function sameSite(): "lax" | "strict" | "none" {
  const configured = String(process.env.SESSION_COOKIE_SAME_SITE ?? "").toLowerCase();
  if (configured === "none" || configured === "strict") return configured;
  return "lax";
}

export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  const policy = sameSite();
  return {
    httpOnly: true,
    sameSite: policy,
    // SameSite=None is only honoured by browsers when Secure is set.
    secure: process.env.NODE_ENV === "production" || policy === "none",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Read the session cookie out of a raw Cookie header (usable outside Next runtime). */
export function readSessionFromCookieHeader(header: string | null): SessionUser | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      return verifySessionToken(decodeURIComponent(rest.join("=")));
    }
  }
  return null;
}
