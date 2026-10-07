# Ejentic AI — Production Migration Guide

This guide walks through migrating from development (JSON persistence) to production (PostgreSQL + Redis).

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Development to Production Checklist](#dev-to-prod-checklist)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Data Migration](#data-migration)
6. [Deployment](#deployment)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

## Architecture Overview

### Development Mode (Current)
```
Next.js App    <->  .data/scraper.json
Worker Process <->  (direct file I/O)
```

**Persistence**: Synchronous JSON file read/write  
**Queue**: Polling-based (checks every 1s)  
**Database**: None  
**Suitable for**: Local development, testing, prototypes

### Production Mode
```
Next.js App    <->  PostgreSQL (Prisma ORM)
Worker Process <->  PostgreSQL
               <->  Redis/BullMQ (job queue)
```

**Persistence**: Transactional PostgreSQL database  
**Queue**: Redis-backed durable queue with BullMQ  
**Database**: PostgreSQL 17+  
**Suitable for**: Production deployments, multi-node workers, high throughput

---

## Dev-to-Prod Checklist

- [ ] PostgreSQL database created and accessible
- [ ] Redis instance running (or use Redis Cloud)
- [ ] Environment variables configured (.env or secrets manager)
- [ ] Prisma migrations deployed
- [ ] Data migrated from JSON to PostgreSQL (optional)
- [ ] API routes verified with production database
- [ ] Worker tested with production queue
- [ ] Monitoring and alerting configured
- [ ] Backups configured

---

## Database Setup

### Prerequisites
- PostgreSQL 17+ installed and running
- Node.js 20+ with npm installed
- Docker (optional, for local PostgreSQL + Redis)

### Option 1: Using Docker (Recommended for Local Dev)

```bash
# Start PostgreSQL and Redis using docker-compose
docker-compose up -d

# Verify services are running
docker ps | grep -E "postgres|redis"

# Get connection strings
# PostgreSQL: postgresql://postgres:postgres@localhost:5432/ejentic
# Redis: redis://localhost:6379
```

### Option 2: Manual Installation

**PostgreSQL:**
```bash
# macOS (Homebrew)
brew install postgresql@17
brew services start postgresql@17
createdb ejentic

# Ubuntu/Debian
sudo apt-get install postgresql-17
sudo -u postgres createdb ejentic

# Windows (using PostgreSQL installer)
# https://www.postgresql.org/download/windows/
```

**Redis:**
```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# Windows (using Windows Subsystem for Linux)
wsl sudo apt-get install redis-server
```

### Verify Connections

```bash
# PostgreSQL
psql postgresql://user:password@localhost:5432/ejentic -c "SELECT 1"

# Redis
redis-cli ping
# Should output: PONG
```

---

## Environment Configuration

### Create `.env.production` or `.env.local`

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ejentic"

# Cache & Job Queue
REDIS_URL="redis://localhost:6379"

# Worker Configuration
SCRAPER_WORKER_CONCURRENCY="5"
SCRAPER_POLL_MS="1000"

# Application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://api.ejentic.example.com"
```

### Environment Variable Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | - | PostgreSQL connection string (triggers production mode) |
| `REDIS_URL` | - | Redis connection string (optional, for BullMQ queue) |
| `SCRAPER_WORKER_CONCURRENCY` | 5 | Number of parallel workers processing queue items |
| `SCRAPER_POLL_MS` | 1000 | Milliseconds between queue polls in fallback mode |
| `NODE_ENV` | development | Set to `production` for production deployments |

### Production Secrets (Never in Source Control)

Use your platform's secrets management:
- **Docker/Kubernetes**: Secrets or ConfigMaps
- **AWS**: Secrets Manager or Parameter Store
- **Vercel**: Environment Variables in project settings
- **Heroku**: Config Vars
- **Azure**: Key Vault

Example with Vercel:
```bash
# Deploy with environment variables
vercel env add DATABASE_URL postgresql://...
vercel env add REDIS_URL redis://...
vercel deploy
```

---

## Data Migration

### Step 1: Deploy Database Schema

```bash
# Install/update Prisma client
npm install

# Generate database schema from Prisma schema
npm run db:generate

# Run migrations (creates tables)
npm run db:init
```

This command:
1. Runs `prisma migrate deploy` (applies all migrations)
2. Runs `npm run db:seed` (migrates data from JSON if present)

### Step 2: Verify Schema

```bash
# Open Prisma Studio to inspect database
npm run db:studio

# Or use psql directly
psql $DATABASE_URL

# List tables
\dt

# Count records in each table
SELECT 'jobs' as table_name, COUNT(*) as count FROM "Job"
UNION ALL
SELECT 'companies', COUNT(*) FROM "Company"
UNION ALL
SELECT 'workflows', COUNT(*) FROM "Workflow"
UNION ALL
SELECT 'opportunities', COUNT(*) FROM "Opportunity";
```

### Step 3: Test Data Access

```bash
# Start development server with DATABASE_URL set
DATABASE_URL="postgresql://..." npm run dev

# Test API endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/scraper/jobs
curl http://localhost:3000/api/companies
```

---

## Deployment

### For Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add DATABASE_URL <your-postgres-url>
vercel env add REDIS_URL <your-redis-url>

# Redeploy to apply env vars
vercel --prod
```

### For Docker

```bash
# Build production image
docker build -t ejentic-ai:latest .

# Run with environment variables
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -p 3000:3000 \
  ejentic-ai:latest
```

### For Kubernetes

```bash
# Create secrets
kubectl create secret generic ejentic-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..."

# Deploy using Helm or kubectl
kubectl apply -f k8s/deployment.yaml
```

### For Traditional VPS/EC2

```bash
# On production server:
git clone <repository>
cd ejentic_prod
npm ci --production
npm run build

# Set environment variables
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."
export NODE_ENV="production"

# Start application
pm2 start "npm start" --name ejentic

# Start worker process
pm2 start "npm run worker" --name ejentic-worker
```

---

## Monitoring & Troubleshooting

### Health Checks

```bash
# Application health
curl https://api.ejentic.example.com/api/health

# Should respond with:
# {
#   "status": "ok",
#   "service": "ejentic-ai-scraper",
#   "persistence": "available",
#   "timestamp": "2024-09-01T00:00:00Z"
# }
```

### Database Connection Issues

```bash
# Test PostgreSQL connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection string format
# postgresql://[username:password@]host[:port][/database]
# postgresql://postgres:postgres@localhost:5432/ejentic

# Verify Prisma can connect
npx prisma db execute --stdin < /dev/null
```

### Worker Issues

```bash
# Check worker logs
tail -f /var/log/ejentic/worker.log

# Verify queue depth
npx prisma studio
# Navigate to QueueItem table to see pending items

# Check Redis connectivity (if using BullMQ)
redis-cli INFO stats
redis-cli DBSIZE
```

### Performance Tuning

**Increase worker concurrency:**
```bash
SCRAPER_WORKER_CONCURRENCY=10 npm run worker
```

**Optimize database queries:**
```bash
# Enable Prisma query logging
DEBUG=prisma:* npm run dev
```

**Monitor database slow queries:**
```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Enable log_min_duration_statement
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

# View slow queries
SELECT query, mean_exec_time, calls FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;
```

---

## Rollback Plan

### Revert to JSON Persistence

If PostgreSQL fails and you need to revert to JSON:

1. **Unset DATABASE_URL environment variable**
2. **Redeploy application**
3. **Application automatically falls back to JSON mode**
4. **Historical data remains in .data/scraper.json**

```bash
# Revert commands
unset DATABASE_URL
npm run dev
# Application now uses .data/scraper.json
```

### Export Data from PostgreSQL

```bash
# Backup PostgreSQL data
pg_dump $DATABASE_URL > backup.sql

# Export to JSON for safety
npm run db:export  # (if implemented)
```

---

## Next Steps

1. **Set up PostgreSQL and Redis** (using docker-compose or manual install)
2. **Configure environment variables** for your deployment platform
3. **Run `npm run db:init`** to create schema and migrate data
4. **Deploy application** with DATABASE_URL set
5. **Monitor health endpoint** to verify production mode is active
6. **Configure backups** for PostgreSQL (critical for production)
7. **Set up alerts** for worker health and queue depth

---

## Support

- **Issues?** Check `/memories/repo/` for common solutions
- **Database help?** See [Prisma docs](https://www.prisma.io/docs/)
- **Redis help?** See [Redis docs](https://redis.io/documentation)
- **Deployment help?** See platform-specific docs (Vercel, AWS, Heroku, etc.)
