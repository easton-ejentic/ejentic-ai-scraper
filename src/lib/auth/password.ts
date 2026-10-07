/**
 * Password hashing with scrypt from the Node standard library.
 *
 * No external dependency, no bcrypt build step. Format:
 *   scrypt$<salt-base64url>$<derived-key-base64url>
 *
 * Comparison is constant-time via `timingSafeEqual`.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltPart, hashPart] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !saltPart || !hashPart) return false;

  try {
    const salt = Buffer.from(saltPart, "base64url");
    const expected = Buffer.from(hashPart, "base64url");
    const derived = await scryptAsync(password, salt, expected.length);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** True when the stored value looks like a hash this module produced. */
export function isHashed(value: string): boolean {
  return String(value || "").startsWith("scrypt$");
}
