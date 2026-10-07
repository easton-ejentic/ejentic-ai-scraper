# Production persistence foundation

This directory contains the production datastore foundation for Ejentic AI.

- PostgreSQL is the system of record.
- Redis is reserved for distributed queue coordination.
- The current application still defaults to `.data/scraper.json` until the repository migration is completed.
- Do not delete the JSON repository yet; it remains the development fallback.

Migration sequence:

1. Start infrastructure: `docker compose up -d postgres redis`
2. Copy `.env.example` to `.env.local` and configure `DATABASE_URL` and `REDIS_URL`.
3. Install dependencies: `npm install`.
4. Generate Prisma client: `npx prisma generate`.
5. Create migration: `npx prisma migrate dev --name production-foundation`.
6. Migrate the repository implementation and worker to Prisma/BullMQ in the next step.
7. Verify API, worker, queue recovery, and data integrity before switching production traffic.
