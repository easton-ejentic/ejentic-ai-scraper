import { describe, expect, it } from "vitest";
import { hashPassword, isHashed, verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  readSessionFromCookieHeader,
  verifySessionToken,
} from "@/lib/auth/session";
import { checkRateLimit, clearAttempts, recordFailedAttempt, resetAllAttempts } from "@/lib/auth/rate-limit";

const user = { id: "u1", email: "ops@ejentic.local", name: "Ops", role: "OPERATOR" as const };

describe("password hashing", () => {
  it("produces a scrypt hash and verifies the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(isHashed(hash)).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("right-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("salts each hash independently", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored values", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken(user);
    expect(verifySessionToken(token)).toMatchObject(user);
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken(user);
    const [body] = token.split(".");
    const forged = `${Buffer.from(
      JSON.stringify({ ...user, role: "ADMIN", exp: Math.floor(Date.now() / 1000) + 600 }),
    ).toString("base64url")}.${token.split(".")[1]}`;
    expect(verifySessionToken(forged)).toBeNull();
    expect(verifySessionToken(`${body}.bogus-signature`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(user, -10);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects missing or malformed tokens", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("no-dot-separator")).toBeNull();
  });

  it("reads the session out of a cookie header", () => {
    const token = createSessionToken(user);
    expect(readSessionFromCookieHeader(`ejentic_session=${token}; other=1`)).toMatchObject(user);
    expect(readSessionFromCookieHeader("other=1")).toBeNull();
    expect(readSessionFromCookieHeader(null)).toBeNull();
  });
});

describe("sign-in rate limiting", () => {
  it("locks out after repeated failures and unlocks when cleared", () => {
    resetAllAttempts();
    const key = "1.2.3.4:someone@example.com";

    for (let i = 0; i < 8; i += 1) recordFailedAttempt(key);
    expect(checkRateLimit(key).allowed).toBe(false);
    expect(checkRateLimit(key).retryAfterSeconds).toBeGreaterThan(0);

    clearAttempts(key);
    expect(checkRateLimit(key).allowed).toBe(true);
    resetAllAttempts();
  });

  it("does not block a fresh key", () => {
    resetAllAttempts();
    expect(checkRateLimit("9.9.9.9:nobody@example.com").allowed).toBe(true);
  });
});
