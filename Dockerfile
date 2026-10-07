# Ejentic AI Lead Discovery & Scraper Platform
#
# One image, two entry points:
#   web    -> `next start`          (the dashboard and public site)
#   worker -> `tsx src/worker/index.ts` (crawl workers; scale independently)
#
# Debian (not Alpine) on purpose: Prisma's query engine is downloaded for
# debian-openssl-3.0.x by default, and switching to musl here means adding
# binaryTargets to schema.prisma for no real benefit.

# ---------- dependencies ----------
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# `npm ci` honours the lockfile exactly and is what CI expects.
RUN npm ci

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generated client must exist before `next build` type-checks Prisma usage.
RUN npx prisma generate
RUN npm run build

# ---------- runtime ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# curl is used by the container healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY next.config.ts ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY public ./public
COPY scripts ./scripts
COPY src ./src
COPY --from=build /app/.next ./.next

# Prisma's generated client lives inside node_modules, so regenerate it here
# after the prune step rather than copying it between stages.
RUN npx prisma generate

# Never run as root in production.
RUN useradd --create-home --uid 1001 ejentic \
  && mkdir -p .data \
  && chown -R ejentic:ejentic /app
USER ejentic

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

# Apply migrations, then boot. `migrate deploy` is safe to run repeatedly and
# is a no-op when the schema is already current, so every replica can do it.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
