# Runbook — running the whole platform end to end

Operational procedure for Ejentic AI Lead Discovery & Scraper Control Platform,
from a clean checkout to a reviewed shortlist of qualified leads.

The one thing people forget: **the web app and the crawler are separate
processes.** The app only enqueues work; nothing is ever fetched unless a worker
is running.

---

## Phase 0 — First-time setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
npm run db:generate          # prisma generate — the Postgres repo imports @prisma/client
```

`--legacy-peer-deps` is required: `vitest` declares a peer range for `@types/node`
that conflicts with the version pinned here.

Then set the minimum in `.env.local`:

```bash
EJENTIC_ADMIN_EMAIL=admin@ejentic.local
EJENTIC_ADMIN_PASSWORD=change-me
SESSION_SECRET=              # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
BRAVE_SEARCH_API_KEY=        # optional but strongly recommended
```

### About login (easy to trip over)

`authConfigured()` in `src/proxy.ts` returns true only if `DATABASE_URL` is set
**or** `EJENTIC_ADMIN_EMAIL` + `EJENTIC_ADMIN_PASSWORD` (or the `EJENTIC_USER_*`
pair) are set. With none of those, auth reports **DISABLED** and the dashboard is
simply open — no login prompt. That is deliberate: fail open rather than lock
everyone out. `/api/health` reports the status.

- Want to exercise the login flow? Set the admin vars above.
- Running with `DATABASE_URL`? Auth is always on, so you **must** seed a user with
  `npm run db:seed` or nobody can get in.

---

## Phase 1 — Start it

```bash
npm run dev        # terminal 1 → http://localhost:3000
npm run worker     # terminal 2 → NOTHING CRAWLS WITHOUT THIS
```

**Run only one worker at a time in development.** The JSON store has no
transactions, so two workers reading and rewriting the same file lose each
other's writes. The worker refuses to start if one is already running.

Verify it came up: `http://localhost:3000/api/health` reports auth status, the
active search provider, and which backend is live.

---

## Phase 2 — Create a job

Go to `/scraper/jobs/new` (or Control Center → New job).

1. **Pick a target type.**
   - **URL list** — best for a first smoke test. Paste a public URL you control.
   - **Web search** — the default. Describe businesses by name / niche / category /
     location, press **Find websites**, tick the real results. No URLs needed.
   - **Domain** — crawl one site, following same-origin links.
   - **Campaign** — run a saved search preset.
2. **Set the URL limit** — hard cap on how many pages the job will ever fetch.
3. **Set politeness** — workers, requests/sec (keep 1–5), retries.
4. **Create.**

If every search provider fails, no job is created and the app tells you why. It
never substitutes sample data.

---

## Phase 3 — Monitor

| Route | Shows |
|---|---|
| `/scraper/queue` | Pending URLs |
| `/scraper/logs` | Live activity feed |
| `/scraper/jobs/[id]` | One job's progress; pause / resume / cancel |

---

## Phase 4 — Review results

Work these in order — each stage feeds the next.

1. `/campaigns` — group jobs under one question (a niche, a region, a sector) and
   see everything from them rolled up.
2. `/companies` — companies discovered from crawled pages.
3. `/research` — the dossier: pages read, evidence with the URL behind every quote,
   workflows, inline evaluation.
4. `/workflows` — workflows detected from page text, scored 0–100 across seven
   dimensions. Hit **Evaluate** to (re)score.
5. `/opportunities` — agent opportunities generated from evaluated workflows.
6. `/qualified-leads` — the shortlist (score ≥ 75 **and** confidence ≥ 65%).

The qualified-leads threshold is provisional (`development-threshold-v1`). It is a
triage aid, not a sales decision — **a human reviews before outreach.**

Separately: public `/contact` submissions land in `/enquiries` (new / read /
archived). Nothing is emailed — there is no mail provider wired up.

---

## Phase 5 — Before you call it done

```bash
npm run typecheck
npm run lint        # expect 0 errors, 0 warnings
npm test            # 171 tests
npm run build
```

CI runs exactly this on push/PR to `main`, plus a `migrate` job that applies every
migration against a real PostgreSQL 17 service.

---

## Shutdown

Stop the **worker first**, then the dev server, so nothing is mid-write on
`.data/scraper.json`.

---

## Safety rules

- Never crawl localhost, private IPs, or cloud metadata endpoints. The worker
  refuses and the safety suite enforces it.
- Test against a public URL you own, or a known public HTML page.
- Keep requests/sec low and respect the target site.
- To reset all local data, delete `.data/scraper.json` (gitignored).

---

## Production shape

The backend is auto-selected from the environment:

| Var set | Persistence | Queue |
|---|---|---|
| neither | JSON file `.data/scraper.json` | durable file queue `.data/queue` |
| `DATABASE_URL` | PostgreSQL via Prisma | — |
| `REDIS_URL` | — | Redis + BullMQ |

```bash
docker compose up -d                 # PostgreSQL 17 + Redis 8
# set DATABASE_URL and REDIS_URL in .env.local
npx prisma migrate deploy
npm run db:admin                     # REQUIRED — creates the first login account
npm run dev && npm run worker
```

To run several workers in parallel you must set `DATABASE_URL` and `REDIS_URL`.

> **`db:admin`, not `db:seed`.** Setting `DATABASE_URL` turns auth on
> unconditionally (`authConfigured()` in `src/proxy.ts`), so the dashboard is
> locked from the first request — but only `db:admin` creates an account:
>
> ```bash
> DATABASE_URL=... ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=... npm run db:admin
> ```
>
> `npm run db:seed` is a **data** migration: it copies an existing
> `.data/scraper.json` into Postgres. It creates no users, and on a fresh clone
> (where `.data/` is gitignored) it has nothing to read and exits with an error.
> Run it only if you are carrying over existing dev data.

---

## Gotchas

- **`npm install` needs `--legacy-peer-deps`.**
- **`BASE_PATH` and `ALLOW_EMBEDDING` are build-time.** Set them in `.env.local`
  before `npm run build` — not in your shell, because Next.js loads the env file
  over the process environment, so a bare `BASE_PATH=` line ships an unprefixed
  build. Rebuild after changing them.
- **Builds can fail on `Failed to fetch Outfit from Google Fonts`.** That is
  network, not code. Retry, set `HTTP_PROXY`/`HTTPS_PROXY`, or self-host the font
  with `next/font/local`.
- **Scraped search engines are a last resort.** DuckDuckGo starts returning bot
  challenges after a handful of queries, and Bing has been observed silently
  answering a *different, simpler* query. Results must match every dimension you
  filled in or they are discarded. Set a real API key for dependable results.
- **Directory sites are filtered out automatically** (Checkatrade, Yell, Yelp,
  Thomson Local, Trustpilot, Companies House) — crawling them yields thousands of
  companies you did not ask for.
