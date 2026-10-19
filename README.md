# Ejentic AI — Lead Discovery & Scraper Control Platform

Operational lead-discovery infrastructure for Ejentic AI. This supports Ejentic AI's broader
lead / opportunity discovery process — it is not the Ejentic AI product itself.

It has three surfaces:

- **Public marketing site** (`/`, `/how-it-works`, `/platform`, `/pricing`, `/about`,
  `/contact`, `/privacy`, `/terms`) — the public-facing product site.
- **Public explorer** (`/explore`) — a free live business search that visitors can
  use **without an account**. Returns real websites; stores nothing.
- **Internal dashboard** (`/dashboard`, `/campaigns`, `/companies`, `/research`,
  `/workflows`, `/opportunities`, `/qualified-leads`, `/scraper/*`, `/settings`) —
  where you run discovery work. **Requires a valid login.**

The whole thing is designed to be dropped into the main Ejentic AI website — either
served under a sub-path such as `ejenticai.com/app`, or framed inside a page of the
main site. See [docs/INTEGRATING_WITH_MAIN_SITE.md](docs/INTEGRATING_WITH_MAIN_SITE.md).

---

## Quick start

```bash
npm install --legacy-peer-deps
npm run dev                    # app on http://localhost:3000
```

In a **second terminal**, start the crawler:

```bash
npm run worker
```

That's it for local use. The app runs on a local JSON file (`.data/scraper.json`) and a
durable file-backed queue; no database or Redis is required to try it.

> **Don't blindly copy `.env.example` to `.env.local`.** That template ships a
> real-looking `DATABASE_URL`, and the app picks its backend purely from whether
> that variable is set. Copy it without a running PostgreSQL and every page that
> touches data will throw instead of degrading. Start with **no** `.env.local`
> (JSON mode), and only add `DATABASE_URL` once Postgres is actually up — then
> see [Production](#production).

> **Run only one worker at a time in development.** The JSON store has no
> transactions, so two workers reading and rewriting the same file lose each
> other's writes. The worker now refuses to start if another one is already
> running, so you will see a clear message instead of silent corruption. To run
> several workers in parallel, set `DATABASE_URL` and `REDIS_URL` (see
> [Production](#production)).

> `npm install` needs `--legacy-peer-deps` — `vitest` declares a peer range for
> `@types/node` that conflicts with the pinned version here.

---

## How to use it (the short version)

1. **Open the app** at http://localhost:3000. You land on the marketing homepage.
   Click **Open app** to reach the dashboard.
2. **Start the worker** (`npm run worker`). Nothing crawls without it — the web app
   only enqueues work; the worker does the fetching.
3. **Create a job**: go to `/scraper/jobs/new` (or Control Center → New job).
   - **Web search** (default) — describe the businesses you want by *name*,
     *niche/service*, *category* and/or *location*, press **Find websites**, and
     tick the ones you want. No URLs needed; the app searches the open web and
     queues whatever real websites come back.
   - **Domain** crawls one website and follows same-origin links.
   - **URL list** crawls exactly the URLs you paste.
   - **Campaign** runs a saved search preset.
   - **URL limit** caps how many pages the job will ever fetch.
   - **Workers / requests per second / retries** control politeness. Keep
     requests-per-second low (1–5) and respect the target site.
4. **Watch it run**: `/scraper/queue` shows pending URLs, `/scraper/logs` shows a
   live activity feed, `/scraper/jobs/[id]` shows one job's progress.
   Pause / resume / cancel from the job detail screen.
5. **Review results**:
   - `/campaigns` — group jobs under one question (a niche, a region, a sector) and
     see everything that came out of them rolled up in one place.
   - `/companies` — companies discovered from crawled pages.
   - `/research` — pick a company and read the dossier: pages read, evidence with
     the URL behind every quote, workflows, and inline evaluation.
   - `/workflows` — workflows detected from page text, each scored 0–100 across
     seven dimensions. Use **Evaluate** to (re)score.
   - `/opportunities` — agent opportunities generated from evaluated workflows.
   - `/qualified-leads` — the shortlist (score ≥ 75 **and** confidence ≥ 65%).
     This is a triage aid, not a sales decision — a human reviews before outreach.
6. **Check configuration** at `/settings`: which datastore and queue are live,
   which search provider is actually in use, and exactly which environment
   variable would improve results.

### The pipeline

```
SEARCH ("plumbers in Manchester") → WEB DISCOVERY → CANDIDATE WEBSITES
   → URL QUEUE → CRAWLING → COMPANY DISCOVERY → RESEARCH → EVIDENCE
   → WORKFLOW DISCOVERY → EVALUATION → OPPORTUNITY GENERATION
   → LEAD QUALIFICATION → QUALIFIED LEAD → HUMAN REVIEW
```

### Web search providers

Business discovery searches the open web and returns **only** what an engine
actually returned. If nothing is found, the job is not created and you are told
why — nothing is invented or filled in from a sample list.

Providers are tried in order with automatic failover. The first four need a
(free-tier) key or URL; the last two are scraped and rate-limit easily:

| Order | Provider | Enable with |
| --- | --- | --- |
| 1 | Brave | `BRAVE_SEARCH_API_KEY` |
| 2 | Serper | `SERPER_API_KEY` |
| 3 | Tavily | `TAVILY_API_KEY` |
| 4 | SearXNG | `SEARXNG_URL` (self-hosted = unlimited) |
| 5 | DuckDuckGo | always on (scraped) |
| 6 | Bing | always on (scraped) |

See `.env.example`. `/api/health` reports which provider is active.

**Scraped engines are a last resort.** DuckDuckGo starts returning bot
challenges after a handful of queries, and Bing has been observed silently
answering a *different, simpler* query (it returned dictionary definitions for
"emergency plumbing Manchester"). To stop that producing wrong leads, results
must match **every** dimension you filled in — name, trade and location — or
they are discarded. Set a real API key for dependable results.

Directories and listing sites (Checkatrade, Yell, Yelp, Thomson Local,
Trustpilot,Companies House…) are filtered out automatically: crawling them
yields thousands of companies you did not ask for rather than the businesses
themselves.

Every claim about a company traces back to a crawled page. The system never says
"this company does X" unless that text appeared in an actual fetched document with a
stored excerpt and a confidence value.

---

## Running with PostgreSQL and Redis (production shape)

The app auto-selects its backend from the environment:

| `DATABASE_URL` | Persistence |
|---|---|
| set | PostgreSQL via Prisma |
| unset | local JSON file (development only) |

| `REDIS_URL` | Queue |
|---|---|
| set | Redis + BullMQ |
| unset | durable file-backed queue under `.data/queue` |

To run the full stack locally you need Docker for Postgres/Redis (`docker-compose.yml`
is provided). Neither binary is required for the JSON-only path.

```bash
# 1. start infra
docker compose up -d

# 2. apply the schema
npm run db:init            # prisma migrate deploy + seed

# 3. create the first administrator
DATABASE_URL=... ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=... npm run db:admin

# 4. run
npm run dev
npm run worker
```

---

## Authentication

Roles, highest first: **ADMIN > OPERATOR > RESEARCHER > VIEWER**.
Reads need VIEWER; writes (POST/PATCH/PUT/DELETE) need OPERATOR.

- Sessions are HMAC-signed, httpOnly, `sameSite=lax`, 8-hour cookies.
- Passwords are hashed with scrypt from Node's standard library.
- Sign-in is rate limited (8 attempts per 15 minutes per IP+email).
- The public explorer is throttled separately (20 searches per 10 min per IP).

What is public and what is gated:

| | |
|---|---|
| Open to anyone | `/` and all marketing pages, `/explore`, `/contact`, `/login`, `/api/public/explore`, `/api/health` |
| Login required | `/dashboard`, `/campaigns`, `/companies`, `/research`, `/workflows`, `/opportunities`, `/qualified-leads`, `/scraper/*`, `/settings` and every other `/api/*` route |

**Open app** in the header points at `/dashboard`, so a visitor without a session
lands on `/login` and is returned to their destination after signing in.

**If no accounts exist, authentication is off and the dashboard is open** — so a fresh
checkout works immediately. `/api/health` reports `auth: unconfigured` so the gap is
visible rather than silent.

To turn it on without a database, in `.env.local`:

```
SESSION_SECRET=<random 32+ bytes>
EJENTIC_ADMIN_EMAIL=admin@ejentic.local
EJENTIC_ADMIN_PASSWORD=change-me
```

With PostgreSQL, use `npm run db:admin` instead. `SESSION_SECRET` is **required** in
production.

---

## Plugging it into the main Ejentic AI site

Two supported ways, both configuration-only. Full detail in
[docs/INTEGRATING_WITH_MAIN_SITE.md](docs/INTEGRATING_WITH_MAIN_SITE.md).

**Sub-path (recommended)** — set before `npm run build`, because `basePath` is read
at build time:

```bash
BASE_PATH=/app                              # -> ejenticai.com/app
NEXT_PUBLIC_MAIN_SITE_URL=https://ejenticai.com
```

Next.js then prefixes every route, `<Link>` and asset automatically. The proxy gate
and login redirects are base-path aware, so `/app/dashboard` bounces to
`/app/login?next=%2Fdashboard`, not a `/login` that doesn't exist.

**Iframe** — deploy it on its own origin and frame it:

```bash
ALLOW_EMBEDDING=true
NEXT_PUBLIC_MAIN_SITE_URL=https://ejenticai.com
SESSION_COOKIE_SAME_SITE=none   # HTTPS only
```

`ALLOW_EMBEDDING=true` swaps `X-Frame-Options: DENY` for a CSP
`frame-ancestors 'self' https://ejenticai.com` allow-list, so **only** your origin
can frame it. `SameSite=none` is needed because a cross-site iframe is a third-party
context where `Lax` cookies are dropped.

Runtime config lives in `src/lib/site-config.ts` — one place, read by the marketing
site, the dashboard and the API alike.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run worker` | Crawler worker (required for any crawling) |
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:init` | `prisma migrate deploy` + seed |
| `npm run db:admin` | Create/update the administrator account |
| `npm run db:studio` | Prisma Studio |

`GET /api/health` reports the real state of the database, queue and auth.

---

## Stack

- Next.js 16.3.3 (App Router, Turbopack), React 19.2.8, TypeScript 5
- Tailwind CSS 4, lucide-react
- `next/font/google` — **Outfit** (display) + **Inter** (body)
- Prisma 6 + PostgreSQL 17; BullMQ 5 + Redis

## Typography — do not change

- Display / headings / logo: **Outfit**, weights 500–800, via `next/font/google`.
- Body / UI: **Inter**, weights 300–500, via `next/font/google`.
- Do not use CSS `@import` for fonts.

---

## Crawler safety

Every outbound request passes through `src/lib/scraper/safety.ts`:

- **SSRF blocking** — private, loopback, link-local and cloud-metadata addresses are
  refused, both as literal IPs (IPv4 and IPv6, including IPv4-mapped) and after DNS
  resolution. Every redirect hop is re-validated, so a public host cannot redirect
  the crawler into an internal network.
- **robots.txt** — honoured when the host publishes a policy that applies to us.
- **Per-host throttling** — bounded request rate per origin.
- **Limits** — HTML content types only, 5 MB response cap, max 5 redirects,
  20 s timeout, exponential-backoff retries.

Crawling never happens inside an HTTP request: the API enqueues, the worker processes.

---

## What is deliberately NOT implemented

- CRM / marketing integrations (Salesforce, HubSpot, …) — **not implemented**.
- Email delivery for the contact form — it validates and logs submissions only.
- JavaScript/browser rendering — `javascriptRendering` exists in the job config but
  the crawler currently fetches static HTML only.
- Search-engine and directory source connectors — the toggles exist in the UI, the
  connectors do not.
- LLM-based workflow discovery — scoring is the transparent `heuristic-v1` heuristic.

These are marked in the UI and API rather than stubbed with fake data.

---

## Evaluation methodology

`src/lib/research/evaluation.ts` scores each workflow 0–10 on seven dimensions
(labor, repetition, information support, scalability, economic consequence,
AI plausibility, strategic advantage), averaged to a 0–100 overall score.

It is labelled `heuristic-v1` — a transparent, deterministic scaffold, **not** the
finalised Ejentic AI weighting and not an LLM judgment. Re-score with
`POST /api/workflows/evaluate` or `POST /api/workflows/:workflowId/evaluate`.

Qualified-lead thresholds (score ≥ 75, confidence ≥ 65%) are
`development-threshold-v1`, not a final sales policy.

---

## Remaining work

1. Final Ejentic AI scoring and qualification methodology (replace `heuristic-v1`).
2. LLM-assisted workflow discovery and evidence extraction.
3. Browser/JavaScript rendering for SPA-heavy sites.
4. Search-engine and directory source connectors.
5. Privacy / data-retention review before harvesting at scale.
6. Shared (Redis-backed) rate limiting — the current limiter is per-process.
7. Structured observability export (metrics/traces); currently JSON logs to stdout.
