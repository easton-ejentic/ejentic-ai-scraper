# Plugging this app into the main Ejentic AI website

The app is built to run in **either** mode, with no code changes — only
environment variables.

| | URL | Use when |
|---|---|---|
| **Standalone** | `https://app.ejenticai.com` | You want it on its own subdomain |
| **Sub-path** | `https://ejenticai.com/app` | You want it to live *inside* the main site's domain |
| **Iframe** | `https://ejenticai.com/tools/...` embeds `app.ejenticai.com` | The main site renders it inside a page of its own |

Everything below is read from `src/lib/site-config.ts`, so this file is the
only place you need to look.

---

> ### ⚠️ Two settings are build-time, not start-time
>
> `BASE_PATH` and `ALLOW_EMBEDDING` are read when you run `npm run build` —
> Next.js bakes the base path and the `headers()` result into the build output.
> Changing them and running `npm start` again has **no effect**; you must
> rebuild. Everything else on this page is read at runtime.
>
> **Set them in `.env.local`, not in your shell.** Next.js loads `.env.local`
> over the top of the process environment, so an explicit `BASE_PATH=` in
> `.env.local` silently overrides `BASE_PATH=/app npm run build` and you get a
> build with no prefix at all. This was measured, not guessed: with
> `BASE_PATH=` in `.env.local`, `BASE_PATH=/app npm run build` produced an app
> served at `/`. Editing `.env.local` to `BASE_PATH=/app` and rebuilding put it
> at `/app` immediately.
>
> Verify what you actually shipped:
>
> ```bash
> curl -sI http://localhost:3000/app | head -1   # expect 200 with a prefix, 404 without
> ```

## Option 1 — Sub-path mount (recommended)

Set one variable and rebuild. Next.js prefixes every route, `<Link>`, asset and
API call for you.

```bash
# .env.local  (or your host's environment settings)
BASE_PATH=/app
NEXT_PUBLIC_MAIN_SITE_URL=https://ejenticai.com
```

```bash
npm run build
npm start
```

The app is now at `https://ejenticai.com/app`.

Routes you get:

| Path | Who | What |
|---|---|---|
| `/app` | Public | Marketing home |
| `/app/explore` | **Public, no login** | Free live business search |
| `/app/how-it-works`, `/pricing`, `/about`, `/contact` | Public | Marketing pages |
| `/app/login` | Public | Sign-in |
| `/app/dashboard`, `/campaigns`, `/research`, `/settings`, … | **Login required** | The product |

### Reverse proxy (nginx)

```nginx
location /app/ {
    proxy_pass         http://127.0.0.1:3000/app/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

`X-Forwarded-For` matters: it is what the public search rate limiter keys on.

> If you use Next.js `rewrites` in the main site instead of a proxy, forward the
> full path — do **not** strip `/app` before handing the request over.

---

## Option 2 — Iframe embedding

Deploy the app standalone on its own origin, then frame it.

Main site:

```html
<iframe
  src="https://app.ejenticai.com/app/dashboard"
  style="width:100%;height:900px;border:0"
  allow="clipboard-write"
></iframe>
```

This app — **set before `npm run build`**, then rebuild:

```bash
ALLOW_EMBEDDING=true
NEXT_PUBLIC_MAIN_SITE_URL=https://ejenticai.com
SESSION_COOKIE_SAME_SITE=none   # HTTPS only
```

Verify it took effect:

```bash
curl -sI https://app.ejenticai.com/ | grep -i frame
# Content-Security-Policy: frame-ancestors 'self' https://ejenticai.com
```

If you still see `X-Frame-Options: DENY`, the build was made without
`ALLOW_EMBEDDING=true` — rebuild.

What `ALLOW_EMBEDDING=true` actually does (`next.config.ts`):

- removes `X-Frame-Options: DENY`
- adds `Content-Security-Policy: frame-ancestors 'self' https://ejenticai.com`

So **only** your origin can frame it — third parties still cannot clickjack it.
`SESSION_COOKIE_SAME_SITE=none` is required because a cross-site iframe is a
third-party context, and browsers drop `SameSite=Lax` cookies there. It forces
`Secure`, so this only works over HTTPS.

---

## Option 3 — Own subdomain

Simplest of all. Leave `BASE_PATH` empty, point `app.ejenticai.com` at the
running instance, and set `NEXT_PUBLIC_MAIN_SITE_URL` so the dashboard shows a
"Back to main site" link.

---

## Who can use what

The split is enforced in `src/proxy.ts` (redirect) and `requireApiUser()`
(API authorisation). The proxy check is optimistic — real enforcement is in the
API routes and server components.

**Public — no login:**

- `/` marketing home and all marketing pages
- `/explore` — live web search, returns real websites, stores nothing, throttled
  to 20 searches per 10 minutes per IP
- `/contact` — logs submissions (no email provider in this build)
- `/api/public/explore`, `/api/health`

**Login required:**

- `/dashboard`, `/campaigns`, `/companies`, `/research`, `/workflows`,
  `/opportunities`, `/qualified-leads`, `/scraper/*`, `/settings`
- every `/api/*` route except the two above

"Open app" in the marketing header points at `/dashboard`, so a visitor without
a session lands on `/login?next=%2Fdashboard` and returns to their destination
after signing in.

---

## Admin credentials

Configured via environment variables (already set in `.env.local` for
development):

```bash
EJENTIC_ADMIN_EMAIL=admin@ejenticai
EJENTIC_ADMIN_PASSWORD=ejentiAI444
EJENTIC_ADMIN_NAME=Ejentic Administrator
```

Roles: `ADMIN` > `OPERATOR` > `RESEARCHER` > `VIEWER`. Reads need `VIEWER`,
writes need `OPERATOR`, deleting campaigns needs `ADMIN`.

> The login identifier accepts `admin@ejenticai` (no TLD) — the pattern was
> relaxed at the sign-in route on purpose. The public contact form still uses
> the stricter RFC-style check.

---

## Checklist before going live

- [ ] `SESSION_SECRET` set to a real random value (the app refuses to run in
      production without it)
- [ ] `DATABASE_URL` pointing at PostgreSQL (the JSON file store is dev-only)
- [ ] `REDIS_URL` set, so crawl work is distributed
- [ ] At least one search API key — `BRAVE_SEARCH_API_KEY` has a free tier and
      is dramatically more reliable than the scraped fallbacks
- [ ] `BASE_PATH` (or iframe settings) set **before** `npm run build`
- [ ] `npm run build && npm start`, then check `/app/api/health`

`/app/api/health` reports the real state of each service — if a backing service
is missing it says so rather than returning a flat "ok".
