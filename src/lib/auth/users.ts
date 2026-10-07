/**
 * User directory.
 *
 * Two backends, one interface:
 *
 *  - PostgreSQL (preferred): the `User` table managed by Prisma. Populate it with
 *    `npm run db:seed`, which creates the bootstrap administrator.
 *  - Environment bootstrap: when DATABASE_URL is absent (JSON dev mode) the
 *    operator can define users through EJENTIC_ADMIN_EMAIL / EJENTIC_ADMIN_PASSWORD
 *    and optionally EJENTIC_USER_* for a second account.
 *
 * If neither source yields a user, authentication is reported as DISABLED and the
 * app stays open rather than locking everyone out. `authStatus()` is surfaced on
 * /api/health so a misconfigured deployment is obvious instead of silent.
 */

import { hashPassword, isHashed } from "./password";
import type { Role } from "./session";

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

export type AuthBackend = "database" | "environment" | "none";

function normaliseRole(value: string | undefined): Role {
  const role = String(value || "").toUpperCase();
  if (role === "ADMIN" || role === "OPERATOR" || role === "RESEARCHER" || role === "VIEWER") {
    return role;
  }
  return "VIEWER";
}

function envUser(
  prefix: "EJENTIC_ADMIN" | "EJENTIC_USER",
  fallbackRole: Role,
): AuthUserRecord | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  if (!email) return null;

  const password = process.env[`${prefix}_PASSWORD`];
  const passwordHash = process.env[`${prefix}_PASSWORD_HASH`];
  if (!password && !passwordHash) return null;

  return {
    id: `env-${prefix.toLowerCase()}`,
    email,
    name: process.env[`${prefix}_NAME`]?.trim() || email.split("@")[0],
    role: normaliseRole(prefix === "EJENTIC_ADMIN" ? "ADMIN" : process.env.EJENTIC_USER_ROLE ?? fallbackRole),
    // A pre-hashed value is used as-is; a plaintext value is hashed lazily on
    // first login attempt by `findUserByEmail`.
    passwordHash: passwordHash || `plain:${password}`,
  };
}

/** Users defined by environment variables (JSON / no-database mode). */
function envUsers(): AuthUserRecord[] {
  const users = [
    envUser("EJENTIC_ADMIN", "ADMIN"),
    envUser("EJENTIC_USER", "VIEWER"),
  ].filter((user): user is AuthUserRecord => Boolean(user));
  return users;
}

async function databaseUser(email: string): Promise<AuthUserRecord | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/production/db");
    const record = await prisma.user.findUnique({ where: { email } });
    if (!record) return null;
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: normaliseRole(record.role),
      passwordHash: record.passwordHash,
    };
  } catch (error) {
    console.error("[auth] User lookup failed", error);
    return null;
  }
}

/** Look up a user by email, hashing any plaintext bootstrap password on first use. */
export async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
  const normalised = String(email || "").trim().toLowerCase();
  if (!normalised) return null;

  const fromDatabase = await databaseUser(normalised);
  if (fromDatabase) return fromDatabase;

  const match = envUsers().find((user) => user.email === normalised);
  if (!match) return null;

  if (match.passwordHash.startsWith("plain:")) {
    const plaintext = match.passwordHash.slice("plain:".length);
    return { ...match, passwordHash: await hashPassword(plaintext) };
  }
  return match;
}

/** Which backend supplies users, and whether login is therefore meaningful. */
export function authBackend(): AuthBackend {
  if (process.env.DATABASE_URL) return "database";
  return envUsers().length ? "environment" : "none";
}

/**
 * Authentication is enabled only when at least one account exists.
 * With no users configured the dashboard stays open and /api/health reports
 * `auth: disabled` so the gap is visible rather than hidden.
 */
export function isAuthEnabled(): boolean {
  return authBackend() !== "none";
}

export function authStatus(): { enabled: boolean; backend: AuthBackend } {
  return { enabled: isAuthEnabled(), backend: authBackend() };
}

/** Convenience for seeding: build a stored hash for a plaintext password. */
export async function hashForStorage(password: string): Promise<string> {
  return isHashed(password) ? password : hashPassword(password);
}

/* -------------------------------------------------------------------------
 * Directory management
 *
 * Only the database backend can be administered at runtime. Environment users
 * are, by definition, defined in the environment: pretending to "delete" one
 * here would make the UI disagree with the process on the next restart, so
 * they are returned with `managed: false` and the API rejects writes to them.
 * ---------------------------------------------------------------------- */

export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** False for environment-defined accounts, which cannot be edited here. */
  managed: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

function prismaClient() {
  return import("@/lib/production/db").then((module) => module.prisma);
}

export class UserManagementUnavailable extends Error {
  constructor() {
    super(
      "User management requires a database. Set DATABASE_URL to manage accounts here; environment-defined accounts cannot be edited at runtime.",
    );
    this.name = "UserManagementUnavailable";
  }
}

/** Every known account: database rows first, then environment-defined ones. */
export async function listUsers(): Promise<DirectoryUser[]> {
  const managed = authBackend() === "database";

  if (!managed) {
    return envUsers().map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      managed: false,
      createdAt: null,
      lastLoginAt: null,
    }));
  }

  const prisma = await prismaClient();
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  const seen = new Set(rows.map((row) => row.email));
  const fromEnv = envUsers()
    .filter((user) => !seen.has(user.email))
    .map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      managed: false,
      createdAt: null,
      lastLoginAt: null,
    }));

  return [
    ...rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: normaliseRole(row.role),
      managed: true,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    })),
    ...fromEnv,
  ];
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  password: string;
}): Promise<DirectoryUser> {
  if (authBackend() !== "database") throw new UserManagementUnavailable();

  const email = String(input.email || "").trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const prisma = await prismaClient();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists");

  const row = await prisma.user.create({
    data: {
      id: `usr-${crypto.randomUUID()}`,
      email,
      name: String(input.name || email.split("@")[0]).trim(),
      role: input.role,
      passwordHash: await hashForStorage(input.password),
    },
  });

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normaliseRole(row.role),
    managed: true,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: null,
  };
}

export async function updateUser(
  id: string,
  patch: { name?: string; role?: Role; password?: string },
): Promise<DirectoryUser> {
  if (authBackend() !== "database") throw new UserManagementUnavailable();

  const prisma = await prismaClient();
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("Account not found");

  const data: { name?: string; role?: Role; passwordHash?: string } = {};
  if (patch.name !== undefined) data.name = String(patch.name).trim();
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.password) data.passwordHash = await hashForStorage(patch.password);

  const row = await prisma.user.update({ where: { id }, data });

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normaliseRole(row.role),
    managed: true,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  };
}

/**
 * Removes an account.
 *
 * Refuses to delete the last administrator: doing so would silently lock
 * everyone out of every ADMIN-only screen with no way back except the shell.
 */
export async function deleteUser(id: string): Promise<void> {
  if (authBackend() !== "database") throw new UserManagementUnavailable();

  const prisma = await prismaClient();
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("Account not found");

  if (normaliseRole(existing.role) === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      throw new Error("This is the last administrator account and cannot be deleted.");
    }
  }

  await prisma.user.delete({ where: { id } });
}
