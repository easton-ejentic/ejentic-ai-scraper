-- Contact discovery: turn a qualified lead into a reachable person.
--
-- A qualified lead is a company name plus a workflow description; nobody can
-- email that. This table stores addresses extracted from crawled page text,
-- how they were classified, and the result of the DNS deliverability check.

CREATE TYPE "ContactKind" AS ENUM ('personal', 'role', 'generic', 'unknown');

CREATE TYPE "ContactVerification" AS ENUM (
    'unverified',
    'invalid',
    'disposable',
    'mx_missing',
    'mx_valid'
);

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "ContactKind" NOT NULL DEFAULT 'unknown',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceUrl" TEXT NOT NULL,
    "context" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "verification" "ContactVerification" NOT NULL DEFAULT 'unverified',
    "mxRecord" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contact_companyId_email_key" ON "Contact"("companyId", "email");
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");
CREATE INDEX "Contact_verification_idx" ON "Contact"("verification");
CREATE INDEX "Contact_kind_idx" ON "Contact"("kind");

ALTER TABLE "Contact"
    ADD CONSTRAINT "Contact_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
