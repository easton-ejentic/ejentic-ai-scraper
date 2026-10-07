# Production migration plan

## Current state

The application still uses `.data/scraper.json` for runtime persistence. PostgreSQL + Redis are now defined as the target production infrastructure, but production traffic must not be switched until repository and worker migration is complete.

## Target

```text
Next.js API/UI
      |
      +---- PostgreSQL (system of record)
      |
      +---- Redis/BullMQ (durable job dispatch)
                    |
                 workers
                    |
              external websites
```

## Migration order

1. Run PostgreSQL and Redis.
2. Generate/apply Prisma schema.
3. Implement an async repository matching the current `job-store` contract.
4. Move job creation/status/queue/log/company/workflow/opportunity writes to PostgreSQL.
5. Replace JSON worker queue claiming with BullMQ jobs.
6. Add idempotency keys for URL processing and workflow synchronization.
7. Add worker heartbeat/recovery and stalled-job handling.
8. Backfill existing `.data/scraper.json` into PostgreSQL with a one-time migration script.
9. Run API and worker integration tests.
10. Switch `STORAGE_BACKEND=postgres` in staging.
11. Verify queue recovery after worker termination.
12. Only then enable PostgreSQL as the production system of record.

## Non-negotiable safety checks

- Keep SSRF protections in the worker.
- Validate redirect destinations after every redirect.
- Keep robots.txt behavior.
- Keep response-size limits.
- Never put credentials in crawler URLs.
- Never expose DATABASE_URL or REDIS_URL to client-side code.
