-- Workflow.companyName is part of the domain record and is required to derive
-- opportunities (the opportunity title and summary name the company). The
-- column was missing, so the PostgreSQL repository could not persist workflows
-- that matched the WorkflowRecord type.

ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "companyName" TEXT;

-- Backfill from the owning company so existing rows are not left blank.
UPDATE "Workflow" w
SET "companyName" = c."name"
FROM "Company" c
WHERE w."companyId" = c."id"
  AND (w."companyName" IS NULL OR w."companyName" = '');

-- Anything without a parent company row (should not happen: the relation
-- cascades) falls back to the company id rather than an empty string.
UPDATE "Workflow"
SET "companyName" = "companyId"
WHERE "companyName" IS NULL OR "companyName" = '';

ALTER TABLE "Workflow" ALTER COLUMN "companyName" SET NOT NULL;
