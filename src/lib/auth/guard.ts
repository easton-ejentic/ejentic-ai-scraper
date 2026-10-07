/**
 * Request guards for server components and API routes.
 *
 * Role hierarchy (highest first): ADMIN > OPERATOR > RESEARCHER > VIEWER.
 * A user satisfies a requirement when their rank is >= the required rank.
 *
 * When no user accounts are configured at all, `isAuthEnabled()` is false and
 * every guard passes through, so a fresh checkout is usable out of the box.
 * The moment accounts exist, nothing is reachable without a session.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type Role, type SessionUser } from "./session";
import { isAuthEnabled } from "./users";

export type { Role, SessionUser };

const ROLE_RANK: Record<Role, number> = {
  ADMIN: 4,
  OPERATOR: 3,
  RESEARCHER: 2,
  VIEWER: 1,
};

export function hasRole(user: SessionUser | null, required: Role): boolean {
  if (!user) return false;
  return (ROLE_RANK[user.role] ?? 0) >= (ROLE_RANK[required] ?? 0);
}

/** Session user for the current request, or null when signed out. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function authenticationRequired(): boolean {
  return isAuthEnabled();
}

export function unauthenticated(): NextResponse {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export function forbidden(required: Role): NextResponse {
  return NextResponse.json(
    { error: `This action requires the ${required} role or higher` },
    { status: 403 },
  );
}

/**
 * Guard for API route handlers.
 *
 * Returns `{ user, response: null }` when the request may proceed, otherwise
 * `{ user: null, response }` ready to be returned directly.
 *
 * Mutating verbs (POST/PATCH/PUT/DELETE) default to OPERATOR; reads default to
 * VIEWER. Pass `role` explicitly to tighten a specific route.
 */
export async function requireApiUser(
  request: Request,
  role?: Role,
): Promise<{ user: SessionUser | null; response: NextResponse | null }> {
  if (!isAuthEnabled()) {
    return { user: null, response: null };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: unauthenticated() };
  }

  const required: Role = role ?? (request.method === "GET" ? "VIEWER" : "OPERATOR");
  if (!hasRole(user, required)) {
    return { user: null, response: forbidden(required) };
  }

  return { user, response: null };
}

/** Guard for server components: redirects to /login when a session is missing. */
export async function requirePageUser(required: Role = "VIEWER"): Promise<SessionUser | null> {
  if (!isAuthEnabled()) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  return hasRole(user, required) ? user : null;
}
