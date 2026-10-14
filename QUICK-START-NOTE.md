# Quick Start Note

*One page. Pin it next to your terminal. Full plain-English version: `Ejentic-Runbook-Plain-English.pdf`*

## What it is

An automated research intern. Point it at websites → it reads them, identifies companies,
spots repetitive human tasks (**workflows**), scores them 0–100, turns the best into AI-agent
**opportunities**, and shortlists the strongest as **qualified leads**.

## The one thing people get wrong

**There are two programs, and the website does none of the work.**

| Terminal | Command | Role |
|---|---|---|
| 1 | `npm run dev` | Reception desk — takes your order, writes a job. Fetches nothing. |
| 2 | `npm run worker` | Engine room — actually goes and crawls. |

No worker = jobs sit in the queue forever and it looks broken.
**Only ever run one worker** — it writes to a single JSON file with no locking.

## First time only

```bash
npm install --legacy-peer-deps   # flag is required, not optional
cp .env.example .env.local
npm run db:generate              # needed even without a database
```

Then set `EJENTIC_ADMIN_EMAIL`, `EJENTIC_ADMIN_PASSWORD`, `SESSION_SECRET` (generate it, don't invent it),
and ideally `BRAVE_SEARCH_API_KEY`.

> **Fails open.** No admin vars + no `DATABASE_URL` = **no login at all**, dashboard wide open.
> Fine on your laptop. Never deploy it that way.

## Every session

```bash
npm run dev      # terminal 1
npm run worker   # terminal 2
```
Check `http://localhost:3000/api/health` → auth status, search provider, backend.

## Opening the website

Open any browser and go to **`localhost:3000`**. Log in. **Bookmark it (Ctrl+D)** — after that
it's one click forever.

| Thing | Does it change? |
|---|---|
| The address `localhost:3000` | **Never.** Permanent. |
| The server (`npm run dev`) | **Yes** — only alive while running. |

> **"This site can't be reached" = the server isn't running.** Nothing is broken and the address
> is fine. Run `npm run dev` again. Same fix after a reboot or an accidentally closed terminal.

- **Phone / another PC on the same Wi-Fi:** use the *Network* address the server prints at startup,
  e.g. `http://172.20.10.2:3000` — copy your own from the terminal, don't guess.
- **It is not on the internet.** No domain name, nothing to send a client to. `localhost` is just
  your computer talking to itself. Nobody outside your machine can reach it.
- **Fast up-check:** `localhost:3000/api/health` → JSON means alive; "can't be reached" means off.

## Make a job

`/scraper/jobs/new` → **URL list first** (a URL you own — predictable) → later **Web search**.
Set a **URL limit** (hard cap on pages) and **politeness** (req/sec 1–5, retries). Create.

If all search providers fail, **no job is created** and it tells you why. It never invents results.

## Watch

`/scraper/queue` (waiting) · `/scraper/logs` (live feed) · `/scraper/jobs/[id]` (pause/resume/cancel)

## Read results — in this order, it's a funnel

1. `/campaigns` — folder for one question
2. `/companies` — who it found
3. `/research` — the dossier; **every quote has a source URL behind it**
4. `/workflows` — scored 0–100; press **Evaluate** to (re)score
5. `/opportunities` — where an agent could take over
6. `/qualified-leads` — score **≥ 75** *and* confidence **≥ 65%**

> The shortlist is a **triage aid, not a sales decision. A human reviews before outreach.**

## Before you push

```bash
npm run typecheck && npm run lint && npm test && npm run build   # CI runs exactly this on main
```
Lint should be 0/0. Tests: 171.

## Shut down

**Worker first (Ctrl+C), then the server.** The worker is the one writing to `.data/scraper.json`;
kill the server first and you can corrupt it.

## When it breaks

| Symptom | Cause |
|---|---|
| "This site can't be reached" | Server isn't running — `npm run dev`. The address is fine. |
| Nothing is happening | Worker isn't running |
| Worker refuses to start | One's already running — by design |
| No login screen | No admin vars set → auth disabled |
| Install fails | Missing `--legacy-peer-deps` |
| Search returns nothing | No Brave API key |
| Corrupt data | Killed server before worker → delete `.data/scraper.json` |
| Locked out in prod | Skipped `npm run db:seed` — with `DATABASE_URL` set, auth is always on |

## Safety

Never crawls localhost, private IPs, or cloud metadata (SSRF protection — worker refuses, tests enforce it).
Use a public URL you own. Keep req/sec low. Reset = delete `.data/scraper.json` (gitignored).

## Production

```bash
docker compose up -d          # Postgres 17 + Redis 8
# set DATABASE_URL + REDIS_URL
npx prisma migrate deploy
npm run db:seed               # REQUIRED — creates the admin
```
`BASE_PATH` and `ALLOW_EMBEDDING` are **build-time** — set them before `npm run build`, not in your shell.
