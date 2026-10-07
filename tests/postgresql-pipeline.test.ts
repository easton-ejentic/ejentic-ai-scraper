import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The PostgreSQL repository is the production path, and it is the one path the
 * other suites cannot reach (they all run against the JSON store). These tests
 * drive it with an in-memory stand-in for the Prisma client so the two TODOs
 * that used to sit in it — "discover workflows" and "generate opportunities" —
 * are covered rather than merely typechecked.
 *
 * What is asserted here is the behaviour that silently broke before: a crawl
 * must produce workflows, workflows must produce opportunities, regenerating
 * must not clobber a status a human set, and Json/DateTime columns must come
 * back as plain arrays and ISO strings.
 */

// --- In-memory Prisma stand-in -------------------------------------------

type Row = Record<string, unknown>;

function makeTable(key = "id") {
  const rows = new Map<string, Row>();
  return {
    rows,
    findMany(where?: (row: Row) => boolean) {
      return [...rows.values()].filter((row) => (where ? where(row) : true));
    },
    findUnique(id: string) {
      return rows.get(id);
    },
    findFirst(where: (row: Row) => boolean) {
      return [...rows.values()].find(where);
    },
    upsert(match: Row, create: Row, update: Row) {
      const id = String(create[key] ?? match[key]);
      const existing = rows.get(id);
      rows.set(id, existing ? { ...existing, ...update } : { ...create });
      return rows.get(id)!;
    },
    create(data: Row) {
      const id = String(data[key]);
      rows.set(id, { ...data });
      return rows.get(id)!;
    },
    update(id: string, data: Row) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`row ${id} not found`);
      rows.set(id, { ...existing, ...data });
      return rows.get(id)!;
    },
  };
}

const orderBy = (rows: Row[], sort: Record<string, "asc" | "desc">) => {
  const [field, direction] = Object.entries(sort)[0] ?? [];
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    const left = a[field] as number | string;
    const right = b[field] as number | string;
    if (left === right) return 0;
    const ascending = left > right;
    return (direction === "desc" ? !ascending : ascending) ? 1 : -1;
  });
};

const tables = {
  company: makeTable(),
  companyPage: makeTable(),
  evidence: makeTable(),
  workflow: makeTable(),
  opportunity: makeTable(),
  job: makeTable(),
  queueItem: makeTable(),
  activityLog: makeTable(),
};

function resetTables() {
  for (const table of Object.values(tables)) table.rows.clear();
}

const prismaMock = {
  job: {
    findFirst: async () => null,
    create: async ({ data }: { data: Row }) => tables.job.create(data),
    findMany: async () => [...tables.job.rows.values()],
    findUnique: async ({ where }: { where: Row }) =>
      tables.job.findUnique(String(where.id)) ?? null,
    update: async ({ where, data }: { where: Row; data: Row }) =>
      tables.job.update(String(where.id), data),
  },
  queueItem: {
    upsert: async ({ create }: { create: Row }) => tables.queueItem.create(create),
  },
  activityLog: {
    create: async ({ data }: { data: Row }) => tables.activityLog.create(data),
  },
  company: {
    findFirst: async ({ where }: { where: Row }) =>
      tables.company.findFirst((row) => row.domain === where.domain) ?? null,
    create: async ({ data }: { data: Row }) => tables.company.create(data),
    update: async ({ where, data }: { where: Row; data: Row }) =>
      tables.company.update(String(where.id), data),
    findMany: async () => [...tables.company.rows.values()],
    findUnique: async ({ where }: { where: Row }) =>
      tables.company.findUnique(String(where.id)) ?? null,
  },
  companyPage: {
    create: async ({ data }: { data: Row }) => tables.companyPage.create(data),
    findMany: async ({ where }: { where: Row }) =>
      tables.companyPage.findMany((row) =>
        where?.companyId ? row.companyId === where.companyId : true,
      ),
  },
  evidence: {
    create: async ({ data }: { data: Row }) => tables.evidence.create(data),
    findMany: async ({ where }: { where?: { id?: { in?: string[] } } }) =>
      tables.evidence.findMany((row) =>
        where?.id?.in ? where.id.in.includes(String(row.id)) : true,
      ),
  },
  workflow: {
    findMany: async ({ where, orderBy: sort }: { where?: Row; orderBy?: Record<string, "asc" | "desc"> } = {}) =>
      orderBy(
        tables.workflow.findMany((row) =>
          where?.companyId ? row.companyId === where.companyId : true,
        ),
        sort ?? {},
      ),
    findUnique: async ({ where }: { where: Row }) =>
      tables.workflow.findUnique(String(where.id)) ?? null,
    create: async ({ data }: { data: Row }) => tables.workflow.create(data),
    update: async ({ where, data }: { where: Row; data: Row }) =>
      tables.workflow.update(String(where.id), data),
    upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) =>
      tables.workflow.upsert(where, create, update),
  },
  opportunity: {
    findMany: async ({ orderBy: sort }: { orderBy?: Record<string, "asc" | "desc"> } = {}) =>
      orderBy([...tables.opportunity.rows.values()], sort ?? {}),
    findUnique: async ({ where }: { where: Row }) =>
      [...tables.opportunity.rows.values()].find(
        (row) => row.id === where.id || row.workflowId === where.workflowId,
      ) ?? null,
    create: async ({ data }: { data: Row }) => tables.opportunity.create(data),
    update: async ({ where, data }: { where: Row; data: Row }) =>
      tables.opportunity.update(String(where.id), data),
    upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) =>
      tables.opportunity.upsert(where, create, update),
  },
};

vi.mock("../src/lib/production/db", () => ({ prisma: prismaMock }));

// --- Fixtures -------------------------------------------------------------

const PAGE_TEXT = `
  We handle client intake and onboarding for every new patient, collecting
  forms and documents. Our team processes documents and reviews records daily.
  Appointment scheduling and coordination is managed by the front desk, and
  billing and invoicing runs at the end of each month. We also produce
  reporting on data entry volumes for the practice manager.
`;

const crawl = {
  jobId: "job-1",
  url: "https://example.com/about",
  title: "Example Dental",
  description: "A dental practice in Bristol.",
  text: PAGE_TEXT,
};

type Repository = import("../src/lib/production/postgresql-repository").PostgreSQLRepository;
let repository: Repository;

beforeEach(async () => {
  resetTables();
  const repositoryModule = await import("../src/lib/production/postgresql-repository");
  repository = new repositoryModule.PostgreSQLRepository();
});

describe("PostgreSQL repository: discovery pipeline", () => {
  it("derives and persists workflows from a crawled page", async () => {
    const company = await repository.recordCompanyPage(crawl);
    expect(company).not.toBeNull();

    const workflows = await repository.listStoredWorkflows();
    expect(workflows.length).toBeGreaterThan(0);

    // Every derived workflow carries the identity the domain type requires.
    for (const workflow of workflows) {
      expect(workflow.companyId).toBe(company!.id);
      expect(workflow.companyName).toBeTruthy();
      expect(workflow.evaluation).toBeDefined();
      expect(Array.isArray(workflow.signals)).toBe(true);
      expect(Array.isArray(workflow.evidenceIds)).toBe(true);
    }
  });

  it("generates opportunities for the workflows it discovered", async () => {
    await repository.recordCompanyPage(crawl);

    const generated = await repository.generateAllStoredOpportunities();
    expect(generated.length).toBeGreaterThan(0);
    // The bug being guarded against: this used to just echo whatever already
    // existed, so it returned an empty list on a fresh database.
    expect(generated[0]!.score).toBeGreaterThan(0);
    expect(generated[0]!.capabilities.length).toBeGreaterThan(0);
  });

  it("stores one opportunity per workflow and refreshes rather than duplicates", async () => {
    await repository.recordCompanyPage(crawl);
    const first = await repository.generateAllStoredOpportunities();
    const workflowCount = (await repository.listStoredWorkflows()).length;

    const second = await repository.generateAllStoredOpportunities();
    expect(second.length).toBe(workflowCount);
    expect(new Set(second.map((item) => item.workflowId)).size).toBe(workflowCount);
    expect(second.map((item) => item.id).sort()).toEqual(first.map((item) => item.id).sort());
  });

  it("preserves a human-set status when regenerating", async () => {
    await repository.recordCompanyPage(crawl);
    const [opportunity] = await repository.generateAllStoredOpportunities();

    await repository.updateOpportunityStatus(opportunity!.id, "qualified");
    const regenerated = await repository.generateAllStoredOpportunities();

    const after = regenerated.find((item) => item.id === opportunity!.id);
    expect(after?.status).toBe("qualified");
  });

  it("returns Json columns as arrays and timestamps as ISO strings", async () => {
    await repository.recordCompanyPage(crawl);
    const [opportunity] = await repository.generateAllStoredOpportunities();

    expect(Array.isArray(opportunity!.risks)).toBe(true);
    expect(Array.isArray(opportunity!.implementationNotes)).toBe(true);
    expect(typeof opportunity!.createdAt).toBe("string");
    expect(opportunity!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof opportunity!.updatedAt).toBe("string");
  });

  it("merges evidence when the same page is crawled twice", async () => {
    await repository.recordCompanyPage(crawl);
    await repository.recordCompanyPage(crawl);

    const workflows = await repository.listStoredWorkflows();
    const intake = workflows.find((item) => item.name.includes("intake"));
    const uniqueSources = new Set(intake!.sourceUrls);
    expect(intake!.sourceUrls.length).toBe(uniqueSources.size);
    expect(new Set(intake!.evidenceIds).size).toBe(intake!.evidenceIds.length);
  });

  it("evaluates a workflow that was stored without a score", async () => {
    await repository.recordCompanyPage(crawl);
    const [workflow] = await repository.listStoredWorkflows();

    // Simulate a row written before scoring existed.
    tables.workflow.update(workflow!.id, { evaluation: null });

    const evaluated = await repository.evaluateStoredWorkflow(workflow!.id);
    expect(evaluated?.evaluation?.overallScore).toBeGreaterThan(0);
  });
});

/**
 * The Prisma `TargetType` enum spells the URL-list variant `url_list`, while the
 * domain type used everywhere else spells it `url-list`. Those two spellings
 * must be reconciled in both directions, otherwise a "url-list" job is rejected
 * by the enum on write and comes back as "url_list" on read - which no screen
 * or worker branch recognises.
 */
describe("PostgreSQL repository: job target type mapping", () => {
  const draft = {
    name: "Bristol dentists",
    targetType: "url-list" as const,
    urlLimit: 10,
    sources: { websites: true, search: false, directories: false, social: false },
    configuration: { workers: 2, requestsPerSecond: 1, retries: 1, javascriptRendering: false },
  };

  it("writes the Prisma enum spelling and returns the domain spelling", async () => {
    const created = await repository.createStoredJob(draft, ["https://example.com/"]);

    expect(created.targetType).toBe("url-list");
    expect(tables.job.rows.get(created.id)?.targetType).toBe("url_list");
  });

  it("round-trips every target type back out of the database", async () => {
    for (const targetType of ["campaign", "url-list", "domain", "search"] as const) {
      const created = await repository.createStoredJob(
        { ...draft, targetType },
        ["https://example.com/"],
      );
      expect(created.targetType).toBe(targetType);

      const readBack = await repository.getStoredJob(created.id);
      expect(readBack?.targetType).toBe(targetType);
    }
  });
});
