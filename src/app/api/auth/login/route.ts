import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { authStatus, findUserByEmail } from "@/lib/auth/users";
import { checkRateLimit, clearAttempts, recordFailedAttempt } from "@/lib/auth/rate-limit";

/**
 * Sign-in identifiers are deliberately loose about the domain part.
 *
 * A strict two-part domain check rejects perfectly valid internal accounts
 * such as `admin@ejenticai`, which has no TLD. Sign-in only needs a
 * non-empty local part and a non-empty domain; the real check is the password
 * comparison against a configured account, not the address format.
 *
 * The public contact form keeps the stricter pattern in
 * src/app/api/contact/route.ts, where a reachable address actually matters.
 */
const LOGIN_IDENTIFIER_PATTERN = /^[^\s@]+@[^\s@]+$/;

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: Request) {
  const status = authStatus();
  if (!status.enabled) {
    return NextResponse.json(
      { error: "Authentication is not configured - no user accounts exist" },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || !LOGIN_IDENTIFIER_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter your password" }, { status: 400 });
  }

  const key = `${clientKey(request)}:${email.toLowerCase()}`;
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const user = await findUserByEmail(email);
  // Always run a verification so a missing user and a wrong password take a
  // comparable amount of time and return the same message.
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA");

  if (!user || !valid) {
    recordFailedAttempt(key);
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  clearAttempts(key);

  const token = createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
