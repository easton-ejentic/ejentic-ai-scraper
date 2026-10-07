/**
 * Create (or update) the bootstrap administrator account in PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=... ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=... npm run db:admin
 *
 * Passwords are hashed with scrypt using the same format as src/lib/auth/password.ts
 * (scrypt$<salt>$<key>) so accounts created here work with the running app.
 */

import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@ejentic.local").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  const role = (process.env.ADMIN_ROLE || "ADMIN").toUpperCase();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. This script writes to PostgreSQL.");
    console.error("For JSON mode use EJENTIC_ADMIN_EMAIL / EJENTIC_ADMIN_PASSWORD in .env.local instead.");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("ADMIN_PASSWORD must be set and at least 8 characters long.");
    process.exit(1);
  }
  if (!["ADMIN", "OPERATOR", "RESEARCHER", "VIEWER"].includes(role)) {
    console.error(`ADMIN_ROLE must be one of ADMIN, OPERATOR, RESEARCHER, VIEWER (got ${role}).`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: { id: `user-${randomBytes(8).toString("hex")}`, email, name, role, passwordHash },
      update: { name, role, passwordHash },
    });
    console.log(`Administrator ready: ${user.email} (${user.role})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
